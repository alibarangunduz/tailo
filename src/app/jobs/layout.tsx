// Server layout: gates the (client) job search page behind a session.
import { requireUserIdOrRedirect } from '@/lib/session';

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  await requireUserIdOrRedirect('/jobs');
  return <>{children}</>;
}
