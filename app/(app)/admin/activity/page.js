'use client';
// Admin page: the security / activity log (newest first). Read-only.
import { useEffect, useState } from 'react';
import { apiCached } from '../../../../lib/api';

const LABELS = {
  login: 'Logged in', login_failed: 'Failed login', login_blocked: 'Login blocked (too many tries)', logout: 'Logged out',
  register: 'Registered', slot_add: 'Added slot(s)', slot_edit: 'Edited slot', slot_delete: 'Deleted slot',
  location_add: 'Added location', qr_entry: 'QR entry', qr_exit_otp: 'Exit OTP issued', qr_rejected: 'Rejected QR',
  exit_otp_wrong: 'Wrong exit OTP', exit_completed: 'Exit completed', report_export: 'Exported report',
};
const BAD = new Set(['login_failed', 'login_blocked', 'qr_rejected', 'exit_otp_wrong']);

export default function Activity() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { apiCached('/api/admin/audit', setRows).catch(e => setError(e.message)); }, []);
  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Admin</span><h1>Activity <b>log</b></h1><p>Logins, failed logins, admin changes, QR scans and report exports. Latest 200.</p></div>
      </div>
      {error && <p className="msg error">{error}</p>}
      <div className="card flush"><div className="table-wrap"><table className="table">
        <thead><tr><th>When (IST)</th><th>Who</th><th>What</th><th>Target</th><th>IP</th></tr></thead>
        <tbody>
          {rows === null && <tr><td colSpan={5} className="muted">Loading…</td></tr>}
          {rows && rows.length === 0 && <tr><td colSpan={5} className="muted">Nothing yet.</td></tr>}
          {rows && rows.map(r => (
            <tr key={r.id}>
              <td className="code">{r.at}</td>
              <td>{r.actor_name ? <b>{r.actor_name}</b> : null} <span className="muted">{r.actor_email}</span></td>
              <td><span className={'tag ' + (BAD.has(r.action) ? 'full' : 'soft')}>{LABELS[r.action] || r.action}</span></td>
              <td className="code">{r.target ?? ''}</td>
              <td className="code">{r.ip}</td>
            </tr>
          ))}
        </tbody></table></div></div>
    </>
  );
}
