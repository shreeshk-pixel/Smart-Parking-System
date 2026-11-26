'use client';
// Login form. Admins go to the dashboard, everyone else to the map (or back to the page they asked for).
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, prefetchApi } from '../../../lib/api';
import ThemeToggle from '../../../components/ThemeToggle';

// Only same-site paths are allowed after login (no "//evil.com", "/\\evil.com" or "https://..."),
// and only paths that belong to the role (admin pages for admins, customer pages for customers).
function safeNext(next, role) {
  if (!next || !/^\/[A-Za-z0-9\-_/?=&.%]*$/.test(next) || next.startsWith('//')) return null;
  try {
    const u = new URL(next, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    if (u.pathname.startsWith('/admin') !== (role === 'admin')) return null;
    return u.pathname + u.search;
  } catch { return null; }
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const user = await api('/api/login', { email, password });
      const next = params.get('next');
      const home = user.role === 'admin' ? '/admin' : '/';
      const target = safeNext(next, user.role) || home;
      // Start loading the landing page's data now, and switch pages without a full reload
      prefetchApi(target === '/admin' ? '/api/admin_stats' : target === '/' ? '/api/locations' : '/api/my_bookings').catch(() => {});
      router.replace(target);
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <div className="auth-card">
      <div className="auth-top"><ThemeToggle /></div>
      <h2>Welcome <b>back</b></h2>
      <p className="sub">Log in to see the parking map and book a slot.</p>
      {error && <p className="msg error">{error}</p>}
      {params.get('registered') && <p className="msg success">Account ready. Please log in.</p>}
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus /></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required /></label>
        <button className="btn cta" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="muted">New here? <Link href="/register"><b>Create an account</b></Link></p>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
