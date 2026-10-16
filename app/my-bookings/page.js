'use client';
// My Bookings: list, pay, cancel, and the QR pass for paid bookings.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, fmt } from '../../lib/api';

// Shows a QR image for one token
function QrPass({ token }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(token, { width: 140 }).then(setSrc); }, [token]);
  return src ? <div className="qr"><img src={src} alt="QR pass" /><p className="muted">Show this pass at entry and exit.</p></div> : null;
}

export default function MyBookings() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => api('/api/my_bookings').then(setRows).catch(e => setMsg({ text: e.message, ok: false }));
  useEffect(() => { load(); }, []);

  async function act(url, id, okText) {
    try { await api(url, { booking_id: id }); setMsg({ text: okText, ok: true }); load(); }
    catch (e) { setMsg({ text: e.message, ok: false }); }
  }

  return (
    <>
      <h1>My Bookings</h1>
      {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      {rows === null && <p className="muted">Loading…</p>}
      {rows?.length === 0 && <p className="muted">No bookings yet. <a href="/">Book a slot</a>.</p>}
      <div className="cards">
        {rows?.map(b => (
          <div className="card" key={b.id}>
            <h3>{b.location_name} · Slot {b.slot_number}</h3>
            <p><b>Vehicle:</b> {b.vehicle_number}<br /><b>From:</b> {fmt(b.start_time)}<br /><b>To:</b> {fmt(b.end_time)}</p>
            <p>Rs {b.amount} · <span className={`tag ${b.status}`}>{b.status}</span> <span className={`tag ${b.payment_status}`}>{b.payment_status}</span></p>
            {b.qr_token && (b.status === 'booked' || b.status === 'entered') && <QrPass token={b.qr_token} />}
            <div className="actions">
              {b.status === 'booked' && b.payment_status === 'pending' && <>
                <button className="btn" onClick={() => act('/api/pay', b.id, 'Payment done.')}>Pay now</button>
                <button className="btn danger" onClick={() => confirm('Cancel this booking?') && act('/api/cancel', b.id, 'Booking cancelled.')}>Cancel</button>
              </>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
