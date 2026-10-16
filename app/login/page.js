'use client';
// Login form. Admins go to the dashboard, everyone else to the map.
import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault(); setError('');
    try {
      const user = await api('/api/login', { email, password });
      window.location.href = user.role === 'admin' ? '/admin' : '/';
    } catch (err) { setError(err.message); }
  }
  return (
    <form className="box" onSubmit={submit}>
      <h1>Login</h1>
      {error && <p className="msg err">{error}</p>}
      <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <button className="btn">Login</button>
      <p className="muted">No account? <Link href="/register">Register</Link></p>
    </form>
  );
}
