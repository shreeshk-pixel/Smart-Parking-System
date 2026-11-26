'use client';
// Gate scanner: first scan of a paid pass = entry. Second scan = exit: the admin asks the customer for the
// 6-digit exit code shown on their ticket, types it here, and a match completes the booking.
import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../lib/api';

export default function Scanner() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);   // {text, ok}
  const [exit, setExit] = useState(null);       // {booking_id, locked_minutes} when an exit is requested
  const [code, setCode] = useState('');
  const last = useRef({ t: '', at: 0 });

  async function verify(t) {
    t = (t || '').trim(); if (!t) return;
    setExit(null); setResult({ text: 'Checking...', ok: true });
    try {
      const r = await api('/api/verify_qr', { qr_token: t });
      const who = `${r.user_name}, ${r.vehicle_number}, slot ${r.slot_label} (${r.floor_name})`;
      if (r.action === 'entry') setResult({ text: `Entry allowed: ${who}`, ok: true });
      else {
        const late = r.overstay_minutes > 0;
        setResult({ text: `Exit requested: ${who}${late ? ` (overstayed by ${r.overstay_minutes} min)` : ''}`, ok: !late });
        setExit({ booking_id: r.booking_id, locked_minutes: r.locked_minutes }); setCode('');
      }
    } catch (e) { setResult({ text: e.message, ok: false }); }
  }

  async function confirmExit() {
    try {
      await api('/api/exit_code', { booking_id: exit.booking_id, code: code.trim() });
      setResult({ text: 'Exit complete. Booking closed.', ok: true }); setExit(null); setCode('');
    } catch (e) { setResult({ text: e.message, ok: false }); }
  }

  // Camera scanner. The camera reads the same code many times a second, so repeats within 5 s are ignored.
  useEffect(() => {
    let sc;
    try {
      sc = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 }, false);
      sc.render(t => {
        if (t === last.current.t && Date.now() - last.current.at < 5000) return;
        last.current = { t, at: Date.now() }; setToken(t); verify(t);
      }, () => {});
    } catch { /* no camera support: the paste box still works */ }
    return () => { sc?.clear().catch(() => {}); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid-2">
      <section className="card stack">
        <h2>Scan a pass</h2>
        <div className="scan-frame"><div id="reader" /></div>
        <p className="muted">Point the camera at the user's QR pass, or paste the code below.</p>
        <label className="field"><span>QR code</span><input id="token" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste the pass code" /></label>
        <button id="verify" className="btn cta" onClick={() => verify(token)}>Verify pass</button>
      </section>
      <section className="card stack">
        <h2>Result</h2>
        {result && <p className={'msg ' + (result.ok ? 'ok' : 'err')}>{result.text}</p>}
        {!result && <div className="empty-state"><img src="/assets/img/car-top-sm.png" alt="" /><span>Scan or paste a pass to see the booking here.</span></div>}
        {exit && (
          <div className="stack">
            <h3>Exit code</h3>
            <div className="zone-card"><div><div className="k">Ask the customer</div><div style={{ fontWeight: 600 }}>Their 6-digit exit code is on their ticket in My bookings.</div></div></div>
            {exit.locked_minutes > 0 && <p className="msg err">Too many wrong codes: exit locked for {exit.locked_minutes} more min.</p>}
            <form className="stack" onSubmit={e => { e.preventDefault(); confirmExit(); }}>
              <label className="field"><span>Customer's exit code</span><input id="exitCode" className="otp-input" maxLength={6} inputMode="numeric" autoComplete="off" placeholder="______" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
              <button className="btn cta green" type="submit" disabled={code.length !== 6}>Confirm exit</button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
