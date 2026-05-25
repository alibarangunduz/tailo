'use client';

// Wraps the app in the Auth.js client SessionProvider so client components can
// read the session via useSession(). Server-side checks remain authoritative.
import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
