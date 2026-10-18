// Stand-in for `@/auth`. Route tests mock that module with this one, so the real
// `getCurrentUserId()` in src/lib/session.ts runs against a controllable session:
//
//   vi.mock('@/auth', () => import('../helpers/auth-mock'));
//   signInAs('user-a');
import { vi } from 'vitest';

export const auth = vi.fn();

// Signs the next requests in as `userId`, or signs out with null.
export function signInAs(userId: string | null) {
  auth.mockResolvedValue(
    userId ? { user: { id: userId }, expires: '2099-01-01T00:00:00.000Z' } : null,
  );
}
