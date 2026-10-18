import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from '@/app/api/settings/route';
import { defaultCvHeader } from '@/lib/cv-header';
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
  it('seeds the caller’s row from the default header on first read', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.settings.upsert).toHaveBeenCalledWith({
      where: { userId: USER },
      update: {},
      create: { userId: USER, ...defaultCvHeader },
    });
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
