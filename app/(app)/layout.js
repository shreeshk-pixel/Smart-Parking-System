// Every logged-in page sits inside the app shell (sidebar / tab bar).
// middleware.js already sent guests to /login and keeps each role on its own pages, so this layout
// doesn't need to read the session. That keeps every page static: the browser can prefetch them and
// navigating between pages doesn't wait for the server. Data comes from the APIs, which check the session.
import AppShell from '../../components/AppShell';

export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
