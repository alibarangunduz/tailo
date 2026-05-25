'use client';

// Shows the signed-in user's name with a sign-out control. Reads the session
// client-side via useSession; server-side checks remain the security boundary.
import { useSession, signOut } from 'next-auth/react';

export function UserNav() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  const label = session.user.name || session.user.email || 'Account';

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-gray-400 sm:inline">{label}</span>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
      >
        Sign out
      </button>
    </div>
  );
}
