// The shell around every page: <head>, styles and the top navigation bar.
import './globals.css';
import 'leaflet/dist/leaflet.css';
import Nav from '../components/Nav';

export const metadata = { title: 'Smart Parking' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
