// /api/master-cv, /api/master-cv/[id] and /api/history against a mocked Prisma.
// The focus is the load-bearing auth rules: every query is scoped by the
// signed-in user, and another user's record answers 404, never 403 or 200.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as collection from '@/app/api/master-cv/route';
import * as item from '@/app/api/master-cv/[id]/route';
import * as history from '@/app/api/history/route';
import { LIMITS } from '@/lib/guardrails';
import { allWhereClauses, prisma, resetPrisma } from '../helpers/prisma-mock';
import { signInAs } from '../helpers/auth-mock';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));

const USER = 'user-a';
const json = (method: string, body: unknown) =>
  new Request('http://localhost/api/master-cv', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

// Every recorded where clause must carry the caller's user id, either directly
// or (for writes keyed by a just-verified id) be preceded by a scoped check.
function expectAllScopedTo(userId: string) {
  for (const { model, method, where } of allWhereClauses()) {
    if (method === 'findUnique' || method === 'delete' || method === 'deleteMany') continue;
    expect(where, `${model}.${method}`).toMatchObject({ userId });
  }
}

beforeEach(() => {
  resetPrisma();
  signInAs(USER);
});

describe('GET /api/master-cv', () => {
  it('lists only the caller’s CVs, without their content', async () => {
    prisma.masterCV.findMany.mockResolvedValue([{ id: 'cv1', name: 'Main' }]);
    const res = await collection.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: 'cv1', name: 'Main' }]);
    const args = prisma.masterCV.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER });
    expect(args.select.content).toBeUndefined();
  });
});

describe('POST /api/master-cv', () => {
  it('creates the CV owned by the caller', async () => {
    prisma.masterCV.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data }));
    const res = await collection.POST(json('POST', { name: 'Main', content: 'CV text' }));
    expect(res.status).toBe(201);
    expect(prisma.masterCV.create).toHaveBeenCalledWith({
      data: { name: 'Main', content: 'CV text', userId: USER },
    });
  });

  it('ignores a userId smuggled in the body', async () => {
    prisma.masterCV.create.mockResolvedValue({});
    await collection.POST(json('POST', { name: 'x', content: 'y', userId: 'user-b' }));
    expect(prisma.masterCV.create.mock.calls[0][0].data.userId).toBe(USER);
  });

  it('rejects oversized content before writing', async () => {
    const res = await collection.POST(
      json('POST', { name: 'Main', content: 'a b '.repeat(LIMITS.cvChars) }),
    );
    expect(res.status).toBe(413);
    expect(prisma.masterCV.create).not.toHaveBeenCalled();
  });

  it('rejects a missing name with 400', async () => {
    const res = await collection.POST(json('POST', { content: 'CV text' }));
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/master-cv', () => {
  it('updates only a CV the caller owns', async () => {
    prisma.masterCV.updateMany.mockResolvedValue({ count: 1 });
    prisma.masterCV.findUnique.mockResolvedValue({ id: 'cv1', name: 'Renamed' });
    const res = await collection.PUT(json('PUT', { id: 'cv1', name: 'Renamed' }));
    expect(res.status).toBe(200);
    expect(prisma.masterCV.updateMany).toHaveBeenCalledWith({
      where: { id: 'cv1', userId: USER },
      data: { name: 'Renamed' },
    });
  });

  it('answers 404 for another user’s CV', async () => {
    prisma.masterCV.updateMany.mockResolvedValue({ count: 0 });
    const res = await collection.PUT(json('PUT', { id: 'theirs', name: 'x' }));
    expect(res.status).toBe(404);
    expect(prisma.masterCV.findUnique).not.toHaveBeenCalled();
  });

  it('requires an id', async () => {
    expect((await collection.PUT(json('PUT', { name: 'x' }))).status).toBe(400);
  });
});

describe('GET /api/master-cv/[id]', () => {
  it('returns the caller’s CV', async () => {
    prisma.masterCV.findFirst.mockResolvedValue({ id: 'cv1', content: 'text' });
    const res = await item.GET(new Request('http://localhost'), ctx('cv1'));
    expect(res.status).toBe(200);
    expect(prisma.masterCV.findFirst).toHaveBeenCalledWith({ where: { id: 'cv1', userId: USER } });
  });

  it('answers 404 (not 403) for another user’s CV', async () => {
    prisma.masterCV.findFirst.mockResolvedValue(null);
    const res = await item.GET(new Request('http://localhost'), ctx('theirs'));
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/master-cv/[id]', () => {
  it('deletes the CV and its tailored versions after an ownership check', async () => {
    prisma.masterCV.findFirst.mockResolvedValue({ id: 'cv1' });
    prisma.tailoredCV.deleteMany.mockResolvedValue({ count: 2 });
    prisma.masterCV.delete.mockResolvedValue({});
    const res = await item.DELETE(new Request('http://localhost'), ctx('cv1'));
    expect(res.status).toBe(204);
    expect(prisma.masterCV.findFirst.mock.calls[0][0].where).toEqual({ id: 'cv1', userId: USER });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.tailoredCV.deleteMany).toHaveBeenCalledWith({ where: { masterCVId: 'cv1' } });
  });

  it('answers 404 and deletes nothing for another user’s CV', async () => {
    prisma.masterCV.findFirst.mockResolvedValue(null);
    const res = await item.DELETE(new Request('http://localhost'), ctx('theirs'));
    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.masterCV.delete).not.toHaveBeenCalled();
  });
});

describe('GET /api/history', () => {
  it('returns only the caller’s tailored CVs', async () => {
    prisma.tailoredCV.findMany.mockResolvedValue([]);
    const res = await history.GET();
    expect(res.status).toBe(200);
    expect(prisma.tailoredCV.findMany.mock.calls[0][0].where).toEqual({ userId: USER });
  });
});

describe('scoping across the suite of calls', () => {
  it('every list or lookup query carries the user id', async () => {
    prisma.masterCV.findMany.mockResolvedValue([]);
    prisma.masterCV.findFirst.mockResolvedValue(null);
    prisma.masterCV.updateMany.mockResolvedValue({ count: 0 });
    prisma.tailoredCV.findMany.mockResolvedValue([]);
    await collection.GET();
    await collection.PUT(json('PUT', { id: 'x', name: 'y' }));
    await item.GET(new Request('http://localhost'), ctx('x'));
    await item.DELETE(new Request('http://localhost'), ctx('x'));
    await history.GET();
    expectAllScopedTo(USER);
  });
});
