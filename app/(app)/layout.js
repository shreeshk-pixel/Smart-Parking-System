// Customer pages sit inside the customer app shell (sidebar / tab bar).
// middleware.js already sent guests to /login and keeps each role on its own pages, so this layout
// doesn't need to read the session. That keeps every page static: the browser can prefetch them and
// navigating between pages doesn't wait for the server. Data comes from the APIs, which check the session.
import CustomerShell from '../../components/CustomerShell';

export default function AppLayout({ children }) {
  return <CustomerShell>{children}</CustomerShell>;
}
