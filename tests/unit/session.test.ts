import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { getCurrentUserId, requireUserIdOrRedirect, unauthorized } from '@/lib/session';
import { auth, signInAs } from '../helpers/auth-mock';

vi.mock('@/auth', () => import('../helpers/auth-mock'));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

describe('session helpers', () => {
  beforeEach(() => {
    auth.mockReset();
    vi.mocked(redirect).mockClear();
  });

  it('returns the session user id, or null when signed out', async () => {
    signInAs('user-a');
    expect(await getCurrentUserId()).toBe('user-a');
    signInAs(null);
    expect(await getCurrentUserId()).toBeNull();
  });

  it('treats a session without a user id as signed out', async () => {
    auth.mockResolvedValue({ user: {}, expires: '' });
    expect(await getCurrentUserId()).toBeNull();
  });

  it('unauthorized() is a JSON 401', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('requireUserIdOrRedirect returns the id when signed in', async () => {
    signInAs('user-a');
    expect(await requireUserIdOrRedirect('/tailor')).toBe('user-a');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('requireUserIdOrRedirect sends a signed-out user to sign in, keeping the target', async () => {
    signInAs(null);
    await expect(requireUserIdOrRedirect('/history?x=1')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/signin?callbackUrl=%2Fhistory%3Fx%3D1');
  });
});
