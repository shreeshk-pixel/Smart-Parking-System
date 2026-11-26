// Root of every page: <head>, theme-before-paint script, styles and the shared icon sprite.
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { IconSprite } from '../components/Icons';

export const metadata = { title: { default: 'Smart Parking', template: '%s · Smart Parking' } };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#130F26' };

// Runs before the first paint: saved choice, else the system setting (avoids a white flash in dark mode)
const THEME_SCRIPT = "(function(){try{var t=localStorage.getItem('sp-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preload" href="/assets/fonts/lexend-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body className="layout-app">
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
