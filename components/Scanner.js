'use client';
// First scan = entry, second scan = exit (returns an OTP), then the OTP confirms the exit.
import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../lib/api';

export default function Scanner() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);   // {text, ok}
  const [exit, setExit] = useState(null);       // {booking_id, otp} when an exit OTP is issued
  const [otp, setOtp] = useState('');
  const last = useRef({ t: '', at: 0 });

  async function verify(t) {
    t = (t || '').trim(); if (!t) return;
    setExit(null); setResult({ text: 'Checking...', ok: true });
    try {
      const r = await api('/api/verify_qr', { qr_token: t });
      const who = `${r.user_name}, ${r.vehicle_number}, slot ${r.slot_number}`;
      if (r.action === 'entry') setResult({ text: `Entry allowed: ${who}`, ok: true });
      else {
        const late = r.overstay_minutes > 0;
        setResult({ text: `Exit requested: ${who}${late ? ` (overstayed by ${r.overstay_minutes} min)` : ''}`, ok: !late });
        setExit({ booking_id: r.booking_id, otp: r.otp });
      }
    } catch (e) { setResult({ text: e.message, ok: false }); }
  }

  async function confirmExit() {
    try {
      await api('/api/exit_otp', { booking_id: exit.booking_id, otp: otp.trim() });
      setResult({ text: 'Exit complete. Booking closed.', ok: true }); setExit(null); setOtp('');
    } catch (e) { setResult({ text: e.message, ok: false }); }
  }

  // Camera scanner. The camera reads the same code many times a second, so repeats within 5 s are ignored.
  useEffect(() => {
    const sc = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 }, false);
    sc.render(t => {
      if (t === last.current.t && Date.now() - last.current.at < 5000) return;
      last.current = { t, at: Date.now() }; setToken(t); verify(t);
    }, () => {});
    return () => { sc.clear().catch(() => {}); };
  }, []);

  return (
    <div className="layout">
      <div className="panel">
        <div id="reader" />
        <p className="muted">Point the camera at the user's QR pass, or paste the code below.</p>
        <label>QR code <input value={token} onChange={e => setToken(e.target.value)} /></label>
        <button className="btn" onClick={() => verify(token)}>Verify</button>
      </div>
      <div className="panel">
        {result && <p className={`msg ${result.ok ? 'ok' : 'err'}`}>{result.text}</p>}
        {exit && <>
          <h2>Exit OTP</h2>
          <p>Demo OTP sent to the user: <b>{exit.otp}</b></p>
          <label>Enter OTP <input maxLength={6} inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value)} /></label>
          <button className="btn" onClick={confirmExit}>Confirm exit</button>
        </>}
      </div>
    </div>
  );
}
