// Auth.js (NextAuth v5) configuration. Users, accounts, and sessions are stored
// in our own Neon database via the Prisma adapter (database session strategy),
// so app data can foreign-key to User and the credit ledger (Phase 7) can join
// to it directly. Google is the only sign-in provider for now; it reads
// AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (and AUTH_SECRET) from the environment.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: 'database' },
  pages: { signIn: '/signin' },
  callbacks: {
    // Surface the database user id on the session so route handlers and server
    // components can scope every query to the signed-in user.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
