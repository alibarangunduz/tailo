import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from '@/app/api/settings/route';
import { LIMITS } from '@/lib/guardrails';
import { prisma, resetPrisma } from '../helpers/prisma-mock';
import { signInAs } from '../helpers/auth-mock';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('@/lib/db', () => import('../helpers/prisma-mock'));

const USER = 'user-a';
const put = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );

beforeEach(() => {
  resetPrisma();
  signInAs(USER);
  prisma.settings.upsert.mockImplementation(async (args) => ({ userId: USER, ...args.update }));
});

describe('GET /api/settings', () => {
  it('returns the caller’s existing row without writing', async () => {
    prisma.settings.findUnique.mockResolvedValue({ userId: USER, name: 'Jordan Example' });
    const res = await GET();
    expect(await res.json()).toMatchObject({ name: 'Jordan Example' });
    expect(prisma.settings.findUnique).toHaveBeenCalledWith({ where: { userId: USER } });
    expect(prisma.settings.upsert).not.toHaveBeenCalled();
  });

  it('seeds a new row from the caller’s own account name and email only', async () => {
    prisma.settings.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ name: 'Jordan Example', email: 'jordan@example.com' });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: USER });
    expect(prisma.settings.upsert).toHaveBeenCalledWith({
      where: { userId: USER },
      update: {},
      create: {
        userId: USER,
        name: 'Jordan Example',
        email: 'jordan@example.com',
        phone: '',
        linkedin: '',
        website: '',
      },
    });
  });

  it('seeds empty fields when the account has no name', async () => {
    prisma.settings.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ name: null, email: 'jordan@example.com' });
    await GET();
    expect(prisma.settings.upsert.mock.calls[0][0].create.name).toBe('');
  });
});

describe('PUT /api/settings', () => {
  const header = {
    name: 'Jordan Example',
    email: 'jordan@example.com',
    phone: '',
    linkedin: 'linkedin.com/in/jordan',
    website: '',
  };

  it('saves the header to the caller’s row only', async () => {
    const res = await put(header);
    expect(res.status).toBe(200);
    const args = prisma.settings.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: USER });
    expect(args.create.userId).toBe(USER);
  });

  it('requires a name and an email', async () => {
    expect((await put({ ...header, name: '' })).status).toBe(400);
    expect((await put({ ...header, email: undefined })).status).toBe(400);
    expect(prisma.settings.upsert).not.toHaveBeenCalled();
  });

  it('caps every field', async () => {
    const res = await put({ ...header, website: 'w'.repeat(LIMITS.shortFieldChars + 1) });
    expect(res.status).toBe(413);
    expect(prisma.settings.upsert).not.toHaveBeenCalled();
  });
});
