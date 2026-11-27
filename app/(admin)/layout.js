// Admin pages sit inside the admin app shell. A separate route group, so the admin menu and pages are
// separate code that customers never download. middleware.js answers 404 to anyone who isn't an admin.
import AdminShell from '../../components/AdminShell';

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
