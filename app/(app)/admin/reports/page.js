'use client';
// Admin reports: pick a date range, preview it, then download the same numbers as PDF or CSV.
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { Ico } from '../../../../components/Icons';

const IST = 330 * 60000;
const istDate = (days = 0) => new Date(Date.now() + IST + days * 86400000).toISOString().slice(0, 10);
const monthStart = () => istDate().slice(0, 8) + '01';
const rs = n => '₹ ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs0 = n => '₹ ' + Math.round(Number(n || 0)).toLocaleString('en-IN');

export default function ReportsPage() {
  const [range, setRange] = useState({ from: istDate(-30), to: istDate() });
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(rg = range) {
    setBusy(true); setErr('');
    try { setR(await api(`/api/admin/report?from=${rg.from}&to=${rg.to}`)); } catch (e) { setErr(e.message); setR(null); }
    setBusy(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const quick = (from) => { const rg = { from, to: istDate() }; setRange(rg); load(rg); };
  const q = r ? `from=${r.meta.from}&to=${r.meta.to}` : '';
  const s = r?.summary;

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Admin</span><h1>Reports &amp; <b>exports</b></h1><p>Bookings, users, slot occupancy by floor and type, and revenue for a date range. Admin only.</p></div>
      </div>

      <form className="card stack" onSubmit={e => { e.preventDefault(); load(); }}>
        <div className="form-grid">
          <label className="field"><span>From</span><input type="date" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} required /></label>
          <label className="field"><span>To</span><input type="date" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} required /></label>
          <button className="btn dark" disabled={busy}>{busy ? 'Loading…' : 'Update preview'}</button>
        </div>
        <div className="row">
          <span className="muted">Quick ranges:</span>
          <button type="button" className="btn sm secondary" onClick={() => quick(istDate())}>Today</button>
          <button type="button" className="btn sm secondary" onClick={() => quick(istDate(-6))}>Last 7 days</button>
          <button type="button" className="btn sm secondary" onClick={() => quick(istDate(-30))}>Last 30 days</button>
          <button type="button" className="btn sm secondary" onClick={() => quick(monthStart())}>This month</button>
        </div>
        <p className="muted">A booking counts in the range when its start time falls between the two dates (both included). Times are IST.</p>
      </form>

      {err && <p className="msg error" style={{ marginTop: 16 }}>{err}</p>}
      {r && <>
        <section className="section">
          <div className="download-card">
            <div><h3>Download {r.meta.from} to {r.meta.to}</h3><p>Both files contain everything below plus the full bookings and users lists.</p></div>
            <div className="report-actions">
              <a className="btn" href={`/api/admin/report?format=pdf&${q}`}><Ico name="download" className="ico sm" /> PDF report</a>
              <a className="btn secondary" href={`/api/admin/report?format=csv&${q}`}><Ico name="download" className="ico sm" /> CSV (Excel)</a>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Summary</h2>
          <div className="stats">
            <div className="stat hero"><span className="value">{s.total_bookings}</span><span className="label">Bookings</span></div>
            <div className="stat yellow"><span className="value">{rs0(s.revenue_paid)}</span><span className="label">Revenue (paid)</span></div>
            <div className="stat"><span className="value">{rs0(s.pending_amount)}</span><span className="label">Pending payment</span></div>
            <div className="stat"><span className="value">{s.booked_hours}</span><span className="label">Hours booked</span></div>
            <div className="stat"><span className="value">{r.inventory.total.occupancy_pct}%</span><span className="label">Avg occupancy</span></div>
            <div className="stat"><span className="value">{s.unique_customers}</span><span className="label">Customers</span></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {Object.entries(s.status).map(([k, v]) => <span key={k} className={'tag ' + k}>{k}: {v}</span>)}
          </div>
        </section>

        <section className="section grid-2">
          <div className="card flush"><div className="card-head" style={{ padding: '16px 16px 0' }}><h3>Occupancy by floor</h3></div><div className="table-wrap"><table className="table">
            <thead><tr><th>Floor</th><th className="num">Slots</th><th className="num">Bookings</th><th className="num">Hours</th><th className="num">Occupancy</th></tr></thead>
            <tbody>{Object.entries(r.inventory.by_floor).map(([f, a]) => (
              <tr key={f}><td><b>{f}</b> <span className="muted">{r.floor_names[f]}</span></td><td className="num">{a.active_slots}</td><td className="num">{a.bookings}</td><td className="num">{a.booked_hours}</td><td className="num">{a.occupancy_pct}%</td></tr>
            ))}</tbody></table></div></div>
          <div className="card flush"><div className="card-head" style={{ padding: '16px 16px 0' }}><h3>Revenue by floor and type</h3></div><div className="table-wrap"><table className="table">
            <thead><tr><th>Group</th><th className="num">Bookings</th><th className="num">Hours</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {Object.entries(r.revenue.by_floor).map(([f, a]) => <tr key={f}><td>Floor <b>{f}</b></td><td className="num">{a.bookings}</td><td className="num">{a.hours}</td><td className="num">{rs(a.revenue)}</td></tr>)}
              {Object.entries(r.revenue.by_type).map(([t, a]) => <tr key={t}><td><b>{t}</b> · {r.type_names[t]}</td><td className="num">{a.bookings}</td><td className="num">{a.hours}</td><td className="num">{rs(a.revenue)}</td></tr>)}
            </tbody></table></div></div>
        </section>

        <section className="section">
          <h2>Revenue by location</h2>
          <div className="card flush"><div className="table-wrap"><table className="table">
            <thead><tr><th>Location</th><th className="num">Bookings</th><th className="num">Hours</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {!Object.keys(r.revenue.by_location).length && <tr><td colSpan={4} className="empty">No bookings in this range.</td></tr>}
              {Object.entries(r.revenue.by_location).map(([k, a]) => <tr key={k}><td>{k}</td><td className="num">{a.bookings}</td><td className="num">{a.hours}</td><td className="num">{rs(a.revenue)}</td></tr>)}
            </tbody></table></div></div>
        </section>

        <section className="section">
          <h2>Bookings <span className="muted">({r.bookings.length})</span></h2>
          <div className="card flush"><div className="table-wrap"><table className="table wide">
            <thead><tr><th>#</th><th>User</th><th>Location</th><th>Slot</th><th>Vehicle</th><th>Start</th><th>End</th><th className="num">Amount</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>
              {!r.bookings.length && <tr><td colSpan={10} className="empty">No bookings in this range.</td></tr>}
              {r.bookings.map(b => (
                <tr key={b.id}><td>{b.id}</td><td>{b.user_name}</td><td>{b.location_name}</td><td><span className="slot-pill">{b.slot_label}</span></td>
                  <td className="code">{b.vehicle_number}</td><td style={{ whiteSpace: 'nowrap' }}>{b.start_time}</td><td style={{ whiteSpace: 'nowrap' }}>{b.end_time}</td>
                  <td className="num">{b.amount}</td><td><span className={'tag ' + b.status}>{b.status}</span></td><td><span className={'tag ' + b.payment_status}>{b.payment_status}</span></td></tr>
              ))}
            </tbody></table></div></div>
        </section>
      </>}
    </>
  );
}
