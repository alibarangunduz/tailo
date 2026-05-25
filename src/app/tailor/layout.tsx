// Server layout: gates the (client) tailor page behind a session. The page
// itself relies on user-scoped API routes for data; this redirect is the UX
// guard that keeps anonymous visitors out.
import { requireUserIdOrRedirect } from '@/lib/session';

export default async function TailorLayout({ children }: { children: React.ReactNode }) {
  await requireUserIdOrRedirect('/tailor');
  return <>{children}</>;
}
