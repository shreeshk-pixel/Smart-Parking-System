'use client';
// App frame for logged-in pages: left sidebar on desktop, top bar + slide-out drawer + bottom tab bar on phones.
// The drawer is a plain checkbox (#navToggle) toggled by <label>s, so it opens even before JavaScript loads.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { Ico } from './Icons';
import ThemeToggle from './ThemeToggle';
import { api } from '../lib/api';

const UserCtx = createContext(null);
export const useCurrentUser = () => useContext(UserCtx);

function NavItem({ href, icon, text, path }) {
  const active = href === '/' || href === '/admin' ? path === href : path.startsWith(href);
  return (
    <Link href={href} className={'nav-item' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
      <Ico name={icon} /><span>{text}</span>
    </Link>
  );
}

function Brand({ home }) {
  return <Link className="brand" href={home}><span className="brand-mark">P</span><span>Smart<b>Park</b></span></Link>;
}

export default function AppShell({ user, children }) {
  const path = usePathname() || '/';
  const isAdmin = user?.role === 'admin';
  const home = isAdmin ? '/admin' : '/';
  // Close the phone drawer after navigating
  useEffect(() => { const t = document.getElementById('navToggle'); if (t) t.checked = false; }, [path]);
  async function logout() { try { await api('/api/logout', {}); } catch {} window.location.href = '/login'; }

  return (
    <UserCtx.Provider value={user}>
      <input type="checkbox" id="navToggle" className="nav-toggle" aria-label="Open menu" />
      <div className="shell">
        <aside className="sidebar" aria-label="Main navigation">
          <div className="sidebar-head">
            <Brand home={home} />
            <label htmlFor="navToggle" className="icon-btn only-mobile" aria-label="Close menu"><Ico name="close" /></label>
          </div>
          {/* Admins only manage the system (they don't book); normal users never see the admin pages */}
          {!isAdmin && (
            <nav className="nav-group">
              <span className="nav-label">Parking</span>
              <NavItem href="/" icon="map" text="Find parking" path={path} />
              <NavItem href="/my-bookings" icon="ticket" text="My bookings" path={path} />
            </nav>
          )}
          {isAdmin && (
            <nav className="nav-group">
              <span className="nav-label">Admin</span>
              <NavItem href="/admin" icon="dash" text="Dashboard" path={path} />
              <NavItem href="/admin/locations" icon="pin" text="Locations" path={path} />
              <NavItem href="/admin/slots" icon="grid" text="Slots" path={path} />
              <NavItem href="/admin/scan" icon="scan" text="Scan pass" path={path} />
              <NavItem href="/admin/reports" icon="report" text="Reports" path={path} />
            </nav>
          )}
          <div className="sidebar-foot">
            <ThemeToggle variant="switch" />
            <div className="user-card">
              <span className="avatar">{(user?.name || '?').slice(0, 1).toUpperCase()}</span>
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
          {isAdmin ? <>
            <NavItem href="/admin" icon="dash" text="Dashboard" path={path} />
            <NavItem href="/admin/slots" icon="grid" text="Slots" path={path} />
            <NavItem href="/admin/scan" icon="scan" text="Scan" path={path} />
            <NavItem href="/admin/reports" icon="report" text="Reports" path={path} />
          </> : <>
            <NavItem href="/" icon="map" text="Find" path={path} />
            <NavItem href="/my-bookings" icon="ticket" text="Bookings" path={path} />
          </>}
          <label htmlFor="navToggle" className="nav-item"><Ico name="menu" /><span>More</span></label>
        </nav>
      </div>
    </UserCtx.Provider>
  );
}
