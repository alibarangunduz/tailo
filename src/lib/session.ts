// Server-side session helpers. Per the Next.js guidance (verify authorization in
// each route/server function, not only in proxy), these are the authoritative
// auth checks: every data route derives the user id here and scopes its queries
// to it, so one user can never read or mutate another's records.
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

// The signed-in user's id, or null if there is no session.
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// Standard 401 response for unauthenticated API requests.
export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

// For server components / layouts: returns the signed-in user's id, or redirects
// to the sign-in page (preserving where they were headed) if there is none.
export async function requireUserIdOrRedirect(callbackUrl?: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect(callbackUrl ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/signin');
  }
  return userId;
}
