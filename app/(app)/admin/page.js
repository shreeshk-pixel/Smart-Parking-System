'use client';
// Admin dashboard: live stats, occupancy by floor and type, latest bookings.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { Ico } from '../../../components/Icons';

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/admin_stats').then(setS).catch(e => setErr(e.message)); }, []);
  const v = k => (s ? s[k] : '-');

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Admin</span><h1>Parking <b>dashboard</b></h1><p>Live occupancy across all lots, by floor and vehicle type.</p></div>
        <Link className="btn dark" href="/admin/reports"><Ico name="download" className="ico sm" /> Download report</Link>
      </div>
      {err && <p className="msg err">{err}</p>}
      <div className="stats">
        <div className="stat hero"><span className="stat-ico"><Ico name="grid" /></span><span className="value">{v('total_slots')}</span><span className="label">Active slots</span></div>
        <div className="stat yellow"><span className="stat-ico"><Ico name="car" /></span><span className="value">{v('occupied_now')}</span><span className="label">Occupied now</span></div>
        <div className="stat green"><span className="stat-ico"><Ico name="check" style={{ color: 'var(--green)' }} /></span><span className="value">{s ? s.total_slots - s.occupied_now : '-'}</span><span className="label">Free now</span></div>
        <div className="stat"><span className="stat-ico"><Ico name="ticket" /></span><span className="value">{v('today_bookings')}</span><span className="label">Bookings today</span></div>
        <div className="stat"><span className="stat-ico"><Ico name="wallet" /></span><span className="value">{s ? Number(s.revenue).toLocaleString('en-IN') : '-'}</span><span className="label">Revenue (₹, paid)</span></div>
      </div>

      <section className="section">
        <h2>Occupancy by floor</h2>
        <div className="card flush"><div className="table-wrap"><table className="table">
          <thead><tr><th>Floor</th><th className="num">Bike free / total</th><th className="num">Car free / total</th><th className="num">Occupied</th><th style={{ width: '30%' }}>Load</th></tr></thead>
          <tbody>
            {s && Object.keys(s.floor_names).map(f => {
              const b = s.floors[f].B, c = s.floors[f].C, tot = b.total + c.total, occ = tot - b.free - c.free, p = tot ? Math.round(100 * occ / tot) : 0;
              return (
                <tr key={f}><td><b>{f}</b> <span className="muted">{s.floor_names[f]}</span></td><td className="num">{b.free} / {b.total}</td>
                  <td className="num">{c.free} / {c.total}</td><td className="num">{occ} ({p}%)</td>
                  <td><div className={'bar ' + (p > 80 ? 'high' : p > 50 ? 'mid' : '')}><span style={{ width: p + '%' }} /></div></td></tr>
              );
            })}
          </tbody></table></div></div>
      </section>

      <section className="section">
        <h2>Recent bookings</h2>
        <div className="card flush"><div className="table-wrap"><table className="table wide">
          <thead><tr><th>#</th><th>User</th><th>Vehicle</th><th>Location</th><th>Slot</th><th>Time</th><th className="num">Amount</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>
            {s && !s.recent.length && <tr><td colSpan={9} className="empty">No bookings yet.</td></tr>}
            {s && s.recent.map(b => (
              <tr key={b.id}><td>{b.id}</td><td>{b.user_name}</td><td className="code">{b.vehicle_number}</td><td>{b.location_name}</td>
                <td><span className="slot-pill">{b.slot_label}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>{b.start_time}<br /><span className="muted">to {b.end_time}</span></td><td className="num">{b.amount}</td>
                <td><span className={'tag ' + b.status}>{b.status}</span></td><td><span className={'tag ' + b.payment_status}>{b.payment_status}</span></td></tr>
            ))}
          </tbody></table></div></div>
      </section>
    </>
  );
}
