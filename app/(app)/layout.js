// Every logged-in page sits inside the app shell (sidebar / tab bar). middleware.js already sent guests to /login.
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import AppShell from '../../components/AppShell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const user = await getSession();
  if (!user) redirect('/login');
  return <AppShell user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>{children}</AppShell>;
}
