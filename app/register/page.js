'use client';
// Registration form. New accounts are always normal users.
import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await api('/api/register', form); setDone(true); }
    catch (err) { setError(err.message); }
  }
  if (done) return <div className="box panel"><p className="msg ok">Account created. <Link href="/login">Log in now</Link>.</p></div>;
  return (
    <form className="box" onSubmit={submit}>
      <h1>Register</h1>
      {error && <p className="msg err">{error}</p>}
      <label>Name <input value={form.name} onChange={set('name')} required /></label>
      <label>Email <input type="email" value={form.email} onChange={set('email')} required /></label>
      <label>Phone <input value={form.phone} onChange={set('phone')} /></label>
      <label>Password <input type="password" minLength={6} value={form.password} onChange={set('password')} required /></label>
      <button className="btn">Create account</button>
    </form>
  );
}
