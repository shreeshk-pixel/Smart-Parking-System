'use client';
// My Bookings: countdown hero for the current booking, ticket-style QR passes,
// mock payment sheet, ticket details sheet, and history.
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { Ico } from './Icons';

const C = 565.5; // ring circumference (2 * pi * 90)
const hm = s => (s ? String(s).slice(11, 16) : '');
const day = s => (s ? new Date(String(s).replace(' ', 'T')).toLocaleDateString([], { day: '2-digit', month: 'short' }) : '');
const pad = n => String(n).padStart(2, '0');
const fmtDur = sec => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
const TypeIcon = ({ t }) => <svg><use href={`#i-${t === 'B' ? 'bike' : 'car'}`} /></svg>;

// Which booking gets the big countdown: inside the gate > running now > next upcoming
function pickHero(active) {
  const now = Date.now() / 1000;
  return active.find(b => b.status === 'entered')
    || active.find(b => b.start_ts <= now && b.end_ts > now)
    || active.filter(b => b.start_ts > now).sort((a, b) => a.start_ts - b.start_ts)[0] || null;
}

function Countdown({ b }) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(t); }, []);
  const total = b.end_ts - b.start_ts;
  let frac, label, txt, done = false;
  if (now < b.start_ts) { txt = fmtDur(b.start_ts - now); label = 'Starts in'; frac = 0; }
  else if (now <= b.end_ts) { txt = fmtDur(b.end_ts - now); label = b.status === 'entered' ? 'Parking time left' : 'Time left in your slot'; frac = (now - b.start_ts) / total; }
  else { txt = fmtDur(now - b.end_ts); label = 'Over time, please exit'; frac = 1; done = true; }
  return (
    <div className="stack">
      <div className={'timer' + (done ? ' done' : '')} id="timer">
        <svg className="ring" viewBox="0 0 200 200">
          <circle className="glow" cx="100" cy="100" r="78" /><circle className="track" cx="100" cy="100" r="90" />
          <circle className="prog" cx="100" cy="100" r="90" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, frac)))} />
        </svg>
        {b.vehicle_type === 'C' ? <img className="car" src="/assets/img/car-top.png" alt="" /> : <svg className="bike-art"><use href="#i-bike" /></svg>}
      </div>
      <div className="clock"><div className="t">{txt}</div><div className="l">{label}</div></div>
    </div>
  );
}

function Qr({ text }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(text, { width: 300, margin: 1 }).then(setSrc).catch(() => {}); }, [text]);
  return <div className="qr">{src && <img src={src} width={150} height={150} alt="QR pass" />}</div>;
}

function Content() {
  const params = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [ticket, setTicket] = useState(null);
  const [busy, setBusy] = useState(false);
  const autoPay = useRef(params.get('pay'));

  const load = useCallback(async () => {
    const r = await api('/api/my_bookings');
    setRows(r);
    return r;
  }, []);
  useEffect(() => {
    load().then(r => {
      const want = autoPay.current;
      if (want) {
        const b = r.find(x => String(x.id) === want && x.payment_status === 'pending' && x.status === 'booked');
        if (b) setPayFor(b);
        autoPay.current = null; router.replace('/my-bookings');
      }
    }).catch(e => setMsg({ text: e.message, ok: false }));
  }, [load, router]);

  async function pay() {
    if (!payFor) return;
    setBusy(true);
    try {
      await api('/api/pay', { booking_id: payFor.id });
      const id = payFor.id; setPayFor(null);
      setMsg({ text: 'Payment done. Your QR pass is ready.', ok: true });
      const r = await load(); setTicket(r.find(x => x.id === id) || null);
    } catch (e) { setMsg({ text: e.message, ok: false }); setPayFor(null); }
    setBusy(false);
  }
  async function cancel(b) {
    if (!confirm('Cancel this booking?')) return;
    try { await api('/api/cancel', { booking_id: b.id }); setMsg({ text: 'Booking cancelled.', ok: true }); load(); }
    catch (e) { setMsg({ text: e.message, ok: false }); }
  }

  if (!rows) return <p className="muted">Loading your bookings…</p>;
  const active = rows.filter(b => b.status === 'booked' || b.status === 'entered');
  const past = rows.filter(b => !active.includes(b));
  const hero = pickHero(active);
  const openPay = b => { setTicket(null); setMethod('UPI'); setPayFor(b); };

  return (
    <>
      {msg && <p className={'msg ' + (msg.ok ? 'ok' : 'err')} style={{ marginBottom: 16 }}>{msg.text}</p>}

      {!rows.length && (
        <div className="card empty-state"><img src="/assets/img/car-top-sm.png" alt="" /><b style={{ color: 'var(--text)' }}>No bookings yet</b>
          <span>Find a lot on the map and book your first slot.</span><Link className="btn" href="/">Find parking</Link></div>
      )}

      {hero && (
        <section className="active-hero" aria-label="Current booking">
          <Countdown b={hero} key={hero.id} />
          <div className="hero-info">
            <div className="row"><span className={'tag ' + hero.status}>{hero.status === 'entered' ? 'Parked' : hero.status}</span><span className={'tag ' + hero.payment_status}>{hero.payment_status}</span></div>
            <div><div className="plate">{hero.vehicle_number}</div><div className="sub">{hero.location_name}</div></div>
            <div className="hero-facts">
              <div><small>Slot</small><b>{hero.slot_label}</b></div>
              <div><small>Floor</small><b>{hero.floor_name}</b></div>
              <div><small>Time slot</small><b>{hm(hero.start_time)} - {hm(hero.end_time)}</b></div>
              <div><small>Price</small><b>Rs {hero.amount}</b></div>
            </div>
            {hero.payment_status === 'pending'
              ? <button className="btn cta" type="button" onClick={() => openPay(hero)}>Pay Rs {hero.amount} to get your pass</button>
              : <button className="btn cta" type="button" onClick={() => setTicket(hero)}>View ticket details</button>}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="section">
          <h2 className="section-title">Passes &amp; payments</h2>
          <div className="cards">
            {active.map(b => {
              const paid = b.payment_status === 'paid';
              return (
                <article className="ticket" key={b.id}>
                  <div className="ticket-top">
                    <div className="row-between"><div className="loc-card"><span className={'p-logo' + (paid ? ' ok' : '')} style={{ width: 52, height: 52, fontSize: 22 }}>P</span>
                      <div className="meta"><b>{b.location_name}</b><span className="muted">Booking #{b.id}</span></div></div></div>
                    <div className="row-between"><span className="slot-big">{b.slot_label}</span>
                      <span className="row"><span className={'tag ' + b.status}>{b.status}</span><span className={'tag ' + b.payment_status}>{b.payment_status}</span></span></div>
                    <div className="facts">
                      <div><small>Floor</small><b>{b.floor} · {b.floor_name}</b></div>
                      <div><small>Vehicle</small><b>{b.type_name} · {b.vehicle_number}</b></div>
                      <div><small>Date</small><b>{day(b.start_time)}</b></div>
                      <div><small>Time</small><b>{hm(b.start_time)} - {hm(b.end_time)}</b></div>
                    </div>
                  </div>
                  <div className="ticket-cut"><span /></div>
                  <div className="ticket-bottom">
                    {paid ? <>
                      {b.qr_token && <Qr text={b.qr_token} />}
                      <p className="qr-note">Show this pass at the gate for entry and exit</p>
                      <button className="btn secondary block" type="button" onClick={() => setTicket(b)}>Ticket details</button>
                    </> : <>
                      <div className="total-row"><div><small>Total</small><b>Rs {b.amount}</b></div></div>
                      <div className="actions">
                        <button className="btn" type="button" data-pay={b.id} onClick={() => openPay(b)}>Pay now</button>
                        <button className="btn ghost-danger" type="button" onClick={() => cancel(b)}>Cancel</button>
                      </div>
                    </>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section">
          <h2 className="section-title">History</h2>
          <div className="history">
            {past.map(b => (
              <button type="button" key={b.id} className="hist-item" onClick={() => setTicket(b)} style={{ font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span className="vico"><TypeIcon t={b.vehicle_type} /></span>
                <span className="meta"><b>{b.location_name}</b><span className="muted">{b.slot_label} · {day(b.start_time)} {hm(b.start_time)}-{hm(b.end_time)}</span></span>
                <span className="right"><b>Rs {b.amount}</b><span className={'tag ' + b.status}>{b.status}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Payment sheet (mock payment, like the kit's "Select payment method") */}
      {payFor && (
        <div className="modal" id="payModal" role="dialog" aria-modal="true" aria-labelledby="payTitle" onClick={e => e.target === e.currentTarget && setPayFor(null)}>
          <div className="modal-box">
            <div className="modal-head"><button className="back-btn" type="button" onClick={() => setPayFor(null)} aria-label="Back"><Ico name="back" /></button><span className="muted">Mock payment · no real money</span></div>
            <h2 id="payTitle">Select payment <b>method</b></h2>
            <div className="stack-sm">
              {[['UPI', <svg key="w"><use href="#i-wallet" /></svg>, 'UPI / Wallet', 'Pay with any UPI app'],
                ['Mastercard', <span key="m" className="mc"><i /><i /></span>, '3056 •••• 5904', 'Mastercard · 06/28'],
                ['Card', <svg key="c"><use href="#i-card" /></svg>, '4111 •••• 1111', 'Visa debit · 09/27']].map(([m, logo, title, sub]) => (
                <button key={m} type="button" data-m={m} className={'pay-opt' + (method === m ? ' active' : '')} onClick={() => setMethod(m)}>
                  <span className="logo">{logo}</span><span><b>{title}</b><small>{sub}</small></span><span className="radio" />
                </button>
              ))}
            </div>
            <div className="zone-card"><div><div className="k">Slot</div><div className="zone">{payFor.slot_label}</div></div><div className="thumb"><svg><use href="#i-pin" /></svg></div>
              <div><div className="k">Time slot</div><div className="time">{day(payFor.start_time)} · {hm(payFor.start_time)} - {hm(payFor.end_time)}</div></div><div className="price">Rs {payFor.amount}</div></div>
            <button className="btn cta" id="payBtn" type="button" disabled={busy} onClick={pay}>Pay Rs {payFor.amount}</button>
          </div>
        </div>
      )}

      {/* Ticket details sheet (kit's "Parking ticket details") */}
      {ticket && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tTitle" onClick={e => e.target === e.currentTarget && setTicket(null)}>
          <div className="modal-box">
            <div className="modal-head"><button className="back-btn" type="button" onClick={() => setTicket(null)} aria-label="Back"><Ico name="back" /></button>
              <span className={'tag ' + ticket.status}>{ticket.status}</span></div>
            <h2 id="tTitle">Parking ticket <b>details</b></h2>
            <div className="card loc-card"><span className={'p-logo' + (ticket.payment_status === 'paid' ? ' ok' : '')}>P</span>
              <div className="meta"><b style={{ fontSize: 17 }}>{ticket.vehicle_number}</b><span className="muted">{ticket.location_name}</span>
                <span className="muted">Slot <b style={{ color: 'var(--text)' }}>{ticket.slot_label}</b> · {ticket.floor_name} · {ticket.type_name}</span></div></div>
            <div><h3 style={{ marginBottom: 8 }}>Log activities</h3><div className="log">
              {[['Booked', ticket.created_at], ['Paid' + (ticket.payment_ref ? ' · ' + ticket.payment_ref : ''), ticket.payment_status === 'paid' ? (ticket.paid_at || true) : null],
                ['Entered the gate', ticket.entry_time], ['Exited', ticket.exit_time]].map(([label, when]) => (
                <div key={label} className={'log-item' + (when ? '' : ' pending')}><span className="dot" />
                  <span className="t">{when === true ? '✓' : when ? hm(when) : '--:--'}</span>
                  <small>{label}{when && when !== true ? ' · ' + day(when) : ''}</small></div>
              ))}
            </div></div>
            <hr className="divider" />
            <div className="total-row"><div className="row" style={{ gap: 16 }}><span className="pay-opt" style={{ padding: 0, border: 0, background: 'none', cursor: 'default' }}><span className="logo" style={{ width: 60, height: 60 }}><span className="mc"><i /><i /></span></span></span>
              <div><small>{ticket.payment_status === 'paid' ? 'Paid · mock payment' : 'Not paid yet'}</small><b>Rs {ticket.amount}</b></div></div>
              {ticket.payment_status === 'pending' && ticket.status === 'booked' && <button className="btn" type="button" onClick={() => openPay(ticket)}>Pay now</button>}</div>
            <button className="btn cta dark" type="button" onClick={() => setTicket(null)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function MyBookings() {
  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Your parking</span><h1>My <b>bookings</b></h1><p>Pay to unlock your QR pass, then show it at the gate for entry and exit.</p></div>
        <Link className="btn dark" href="/"><Ico name="plus" className="ico sm" /> New booking</Link>
      </div>
      <Suspense><Content /></Suspense>
    </>
  );
}
