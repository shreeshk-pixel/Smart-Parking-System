'use client';
// Create an account, then log in.
import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import ThemeToggle from '../../../components/ThemeToggle';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await api('/api/register', form); window.location.href = '/login?registered=1'; }
    catch (err) { setError(err.message); }
  }
  return (
    <div className="auth-card">
      <div className="auth-top"><ThemeToggle /></div>
      <h2>Create your <b>account</b></h2>
      <p className="sub">It takes a minute. You can book right after.</p>
      {error && <p className="msg error">{error}</p>}
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Full name</span><input value={form.name} onChange={set('name')} placeholder="Rahul Patil" required autoFocus /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required /></label>
        <label className="field"><span>Phone <small>(optional)</small></span><input value={form.phone} onChange={set('phone')} placeholder="98xxxxxxxx" /></label>
        <label className="field"><span>Password</span><input type="password" value={form.password} onChange={set('password')} placeholder="8+ characters, letters and numbers" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        <button className="btn cta" type="submit">Create account</button>
      </form>
      <p className="muted">Already registered? <Link href="/login"><b>Log in</b></Link></p>
    </div>
  );
}
