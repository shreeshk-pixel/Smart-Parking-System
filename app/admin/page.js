'use client';
// Admin dashboard: stat cards + recent bookings.
import { useEffect, useState } from 'react';
import { api, fmt } from '../../lib/api';

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/admin_stats').then(setS).catch(e => setError(e.message)); }, []);
  const v = x => (s ? x : '…');

  return (
    <>
      <h1>Admin Dashboard</h1>
      {error && <p className="msg err">{error}</p>}
      <div className="stats">
        <div className="stat"><span>{v(s?.total_slots)}</span>Active slots</div>
        <div className="stat"><span>{v(s?.occupied_now)}</span>Occupied now</div>
        <div className="stat"><span>{v(s && s.total_slots - s.occupied_now)}</span>Free now</div>
        <div className="stat"><span>{v(s?.today_bookings)}</span>Bookings today</div>
        <div className="stat"><span>{v(s?.revenue)}</span>Revenue (Rs)</div>
      </div>
      <h2>Recent bookings</h2>
      <table className="table">
        <thead><tr><th>#</th><th>User</th><th>Vehicle</th><th>Location / Slot</th><th>Time</th><th>Status</th><th>Payment</th></tr></thead>
        <tbody>
          {s?.recent.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td><td>{b.user_name}</td><td>{b.vehicle_number}</td>
              <td>{b.location_name} / {b.slot_number}</td><td>{fmt(b.start_time)}<br />{fmt(b.end_time)}</td>
              <td><span className={`tag ${b.status}`}>{b.status}</span></td>
              <td><span className={`tag ${b.payment_status}`}>{b.payment_status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
