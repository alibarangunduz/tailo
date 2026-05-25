// Augment the Auth.js Session type so `session.user.id` (the database user id we
// attach in the session callback) is available everywhere with full typing.
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}
