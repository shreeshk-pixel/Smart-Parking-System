'use client';
// App frame for logged-in pages: left sidebar on desktop, top bar + slide-out drawer + bottom tab bar on phones.
// The drawer is a plain checkbox (#navToggle) toggled by <label>s, so it opens even before JavaScript loads.
// The menu itself comes from CustomerShell or AdminShell, so the admin menu (page names and API paths) is
// only in the admin pages' code: customers' browsers never download it.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { Ico } from './Icons';
import ThemeToggle from './ThemeToggle';
import { api, prefetchApi, clearApiCache } from '../lib/api';

const UserCtx = createContext(null);
export const useCurrentUser = () => useContext(UserCtx);


// Name / role for the sidebar, from the display-only sp_user cookie (set at login); falls back to /api/me
function readUserCookie() {
  try {
    const v = document.cookie.split('; ').find((c) => c.startsWith('sp_user='))?.slice(8);
    if (!v) return null;
    return JSON.parse(decodeURIComponent(escape(atob(v.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch { return null; }
}

// item.api = the API the page loads first (a URL or a function returning one): warmed on hover
function NavItem({ item: { href, icon, text, api: pageApi }, home, path }) {
  const active = href === home ? path === href : path.startsWith(href);
  const warm = () => { const u = typeof pageApi === 'function' ? pageApi() : pageApi; if (u) prefetchApi(u, 10000).catch(() => {}); };
  return (
    <Link href={href} prefetch onMouseEnter={warm} onFocus={warm} onTouchStart={warm}
          className={'nav-item' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
      <Ico name={icon} /><span>{text}</span>
    </Link>
  );
}

function Brand({ home }) {
  return <Link className="brand" href={home}><span className="brand-mark">P</span><span>Smart<b>Park</b></span></Link>;
}

// role: 'admin' | 'customer'; menu: {label, items}; tabs: phone tab bar items; warmUrls: () => API URLs to load
// after the first paint; warmCode: optional () => import(...) for a big page chunk to fetch early
export default function AppShell({ children, role, home, menu, tabs, warmUrls, warmCode }) {
  const path = usePathname() || '/';
  const isAdmin = role === 'admin';
  const [user, setUser] = useState(null);
  useEffect(() => {
    const u = readUserCookie();
    if (u) setUser(u); else api('/api/me').then(setUser).catch(() => {});
  }, []);
  // After the first paint, quietly load the data for the other pages of this role
  useEffect(() => {
    const run = () => {
      (warmUrls ? warmUrls() : []).forEach((u) => prefetchApi(u, 15000).catch(() => {}));
      if (warmCode) warmCode().catch(() => {});
    };
    const id = 'requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 1200);
    return () => ('cancelIdleCallback' in window ? cancelIdleCallback(id) : clearTimeout(id));
  }, [warmUrls, warmCode]);
  // Close the phone drawer after navigating
  useEffect(() => { const t = document.getElementById('navToggle'); if (t) t.checked = false; }, [path]);
  async function logout() { clearApiCache(); try { await api('/api/logout', {}); } catch {} window.location.href = '/login'; }

  return (
    <UserCtx.Provider value={user}>
      <input type="checkbox" id="navToggle" className="nav-toggle" aria-label="Open menu" />
      <div className="shell">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar-head">
            <Brand home={home} />
            <label htmlFor="navToggle" className="icon-btn only-mobile" aria-label="Close menu"><Ico name="close" /></label>
          </div>
          <nav className="nav-group">
            <span className="nav-label">{menu.label}</span>
            {menu.items.map((it) => <NavItem key={it.href} item={it} home={home} path={path} />)}
          </nav>
          <div className="sidebar-foot">
            <ThemeToggle variant="switch" />
            <div className="user-card">
              <span className="avatar">{(user?.name || ' ').slice(0, 1).toUpperCase()}</span>
              <span className="user-meta"><b>{user?.name}</b><small>{isAdmin ? 'Administrator' : user?.email}</small></span>
              <button type="button" className="icon-btn" onClick={logout} title="Log out" aria-label="Log out"><Ico name="logout" /></button>
            </div>
          </div>
        </aside>
        <label htmlFor="navToggle" className="scrim" aria-hidden="true" />
        <div className="main">
          <header className="topbar">
            <label htmlFor="navToggle" className="icon-btn" aria-label="Open menu"><Ico name="menu" /></label>
            <Brand home={home} />
            <ThemeToggle />
          </header>
          <main className={'content' + (path === '/' ? ' wide' : '')}>{children}</main>
          <footer className="footer">Smart Parking Management System · Belagavi · Floors LG · G · F1 · F2 · F3 · B = bike, C = car</footer>
        </div>
        {/* Phone bottom tab bar (hidden on desktop, where the sidebar is always visible) */}
        <nav className="tabbar" aria-label="Quick navigation">
          {tabs.map((it) => <NavItem key={it.href} item={it} home={home} path={path} />)}
          <label htmlFor="navToggle" className="nav-item"><Ico name="menu" /><span>More</span></label>
        </nav>
      </div>
    </UserCtx.Provider>
  );
}
