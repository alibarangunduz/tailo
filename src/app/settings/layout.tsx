// Server layout: gates the (client) settings page behind a session.
import { requireUserIdOrRedirect } from '@/lib/session';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUserIdOrRedirect('/settings');
  return <>{children}</>;
}
