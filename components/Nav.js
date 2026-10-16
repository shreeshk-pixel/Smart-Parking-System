'use client';
// Top bar. Shows different links for guests, users and admins.
import Link from 'next/link';
import { useUser } from '../lib/useUser';
import { api } from '../lib/api';

export default function Nav() {
  const user = useUser();
  async function logout() { await api('/api/logout', {}); window.location.href = '/login'; }
  return (
    <nav className="nav">
      <Link href="/"><b>Smart Parking</b></Link>
      {user && <Link href="/my-bookings">My Bookings</Link>}
      {user?.role === 'admin' && <>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/slots">Slots</Link>
        <Link href="/admin/scan">Scan</Link>
      </>}
      {user && <><span>Hi, {user.name}</span><a href="#" onClick={logout}>Logout</a></>}
      {user === null && <><Link href="/login">Login</Link><Link href="/register">Register</Link></>}
    </nav>
  );
}
