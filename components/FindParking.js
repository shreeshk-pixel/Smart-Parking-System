'use client';
// Find Parking: lots as pins on a Leaflet map -> vehicle picker (Bike B / Car C) -> floor tabs with free counts
// -> slot bays drawn like a car park -> zone card -> booking.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { api } from '../lib/api';
import { Ico } from './Icons';
import { useCurrentUser } from './AppShell';

const FLOOR_ORDER = ['LG', 'G', 'F1', 'F2', 'F3'];
const CAR_IMG = '/assets/img/car-top-sm.png';

// Date -> "YYYY-MM-DDTHH:MM" for a datetime-local input
function toInput(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fmtTime = v => { const d = new Date(v); return isNaN(d) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kit-style round "P" pins: green = slots free, red = full, yellow = selected lot
const pinIcon = (l, active) => L.divIcon({
  className: '', iconSize: [46, 56], iconAnchor: [23, 56], popupAnchor: [0, -50],
  html: `<div class="pin ${l.free_slots > 0 ? '' : 'full'} ${active ? 'active' : ''}"><span class="head">P</span><span class="tail"></span></div>`,
});

export default function FindParking() {
  const user = useCurrentUser();
  const mapDiv = useRef(null);
  const markers = useRef({});
  const [loc, setLoc] = useState(null);
  const [data, setData] = useState(null);          // { slots, floors, floor_names, type_names }
  const [floor, setFloor] = useState('');          // '' = all floors
  const [type, setType] = useState('');            // '' = both types
  const [selected, setSelected] = useState(null);
  const [start, setStart] = useState(() => toInput(new Date()));
  const [end, setEnd] = useState(() => toInput(new Date(Date.now() + 3600000)));
  const [vehicle, setVehicle] = useState('');
  const [msg, setMsg] = useState(null);            // { text, ok, booking }

  // Build the map once
  useEffect(() => {
    const map = L.map(mapDiv.current, { zoomControl: false }).setView([15.8497, 74.4977], 13); // Belagavi
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    api('/api/locations').then(locs => {
      locs.forEach(l => {
        const m = L.marker([l.latitude, l.longitude], { icon: pinIcon(l, false), title: l.name }).addTo(map);
        m.bindTooltip(`<b>${esc(l.name)}</b><br>${l.free_slots}/${l.total_slots} free · Rs ${l.price_per_hour}/hr`, { direction: 'top', offset: [0, -50] });
        m.on('click', () => setLoc(l));
        markers.current[l.id] = { m, l };
      });
      if (locs.length) map.fitBounds(locs.map(l => [l.latitude, l.longitude]), { padding: [50, 50] });
      window.__locs = locs; // handy for tests
    }).catch(e => setMsg({ text: e.message, ok: false }));
    const fix = setTimeout(() => map.invalidateSize(), 300); // layout settles after fonts / sidebar
    window.__selectLocation = l => setLoc(l);
    return () => { clearTimeout(fix); map.remove(); markers.current = {}; };
  }, []);

  // Highlight the selected pin
  useEffect(() => {
    Object.values(markers.current).forEach(({ m, l }) => m.setIcon(pinIcon(l, loc && l.id === loc.id)));
    if (loc) { setFloor(''); loadSlots(); }
  }, [loc]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSlots() {
    if (!loc) return;
    setSelected(null);
    try {
      const q = `location_id=${loc.id}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      setData(await api('/api/slots?' + q));
    } catch (e) { setMsg({ text: e.message, ok: false }); }
  }
  // Re-check availability when the times change
  useEffect(() => { if (loc) loadSlots(); }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = (f, t = type) => {
    const types = t ? [t] : ['B', 'C'];
    return types.reduce((a, k) => ({ free: a.free + data.floors[f][k].free, total: a.total + data.floors[f][k].total }), { free: 0, total: 0 });
  };
  const sumFloors = t => FLOOR_ORDER.reduce((a, f) => { const c = counts(f, t); return { free: a.free + c.free, total: a.total + c.total }; }, { free: 0, total: 0 });

  function pickType(t) {
    const next = type === t ? '' : t; // tap again to show both
    setType(next);
    if (selected && next && selected.vehicle_type !== next) setSelected(null);
  }

  async function book() {
    if (!selected) return;
    try {
      const r = await api('/api/book', { slot_id: selected.id, vehicle_number: vehicle.trim(), start_time: start, end_time: end });
      setMsg({ ok: true, booking: r });
      loadSlots();
    } catch (e) { setMsg({ text: e.message, ok: false }); }
  }

  const list = data ? data.slots.filter(s => (!floor || s.floor === floor) && (!type || s.vehicle_type === type)) : [];
  const hrs = Math.max(1, Math.ceil((new Date(end) - new Date(start)) / 3600000));
  const bike = data && sumFloors('B'), car = data && sumFloors('C');

  return (
    <div className="find">
      <div className="map-wrap">
        <div id="map" ref={mapDiv} role="application" aria-label="Parking map" />
        <span className="map-title">Parking map · tap a pin</span>
      </div>

      <section className="sheet" aria-label="Booking panel">
        <div>
          <span className="eyebrow">Hi, {(user?.name || '').split(' ')[0]}</span>
          <h1>Book your car <b>Parking</b></h1>
        </div>

        {!loc ? (
          <div className="card empty-state">
            <img src={CAR_IMG} alt="" />
            <b style={{ color: 'var(--text)' }}>Pick a parking lot</b>
            <span>Tap a pin on the map to see its floors and free slots.</span>
          </div>
        ) : (
          <div className="card loc-card">
            <span className={'p-logo' + (loc.free_slots ? ' ok' : '')}>P</span>
            <div className="meta">
              <h3>{loc.name}</h3>
              <span className="muted">{loc.address} · Rs {loc.price_per_hour}/hour</span>
              <div className="row">
                <span className="tag soft">{loc.floors} floors</span>
                <span className={'tag ' + (loc.free_slots ? 'free' : 'full')}>{loc.free_slots}/{loc.total_slots} free now</span>
              </div>
            </div>
          </div>
        )}

        {loc && data && (
          <div className="stack">
            <div className="vehicle-pick" role="group" aria-label="Vehicle type">
              <button type="button" className={'vcard' + (type === 'B' ? ' active' : '')} data-type="B" onClick={() => pickType('B')}>
                <span className="vico"><svg><use href="#i-bike" /></svg></span><b>Bike · B</b><small>{bike.free} of {bike.total} free</small>
              </button>
              <button type="button" className={'vcard' + (type === 'C' ? ' active' : '')} data-type="C" onClick={() => pickType('C')}>
                <span className="vico"><svg><use href="#i-car" /></svg></span><b>Car · C</b><small>{car.free} of {car.total} free</small>
              </button>
            </div>

            <div className="form-grid times">
              <label className="field"><span>Start</span><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
              <label className="field"><span>End</span><input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
            </div>

            <div className="stack-sm">
              <div className="row-between"><span className="label">Floor</span><button type="button" className="btn sm secondary" onClick={loadSlots}>Refresh</button></div>
              <div className="floor-tabs">
                {[['', 'All', sumFloors(type)], ...FLOOR_ORDER.map(f => [f, f, counts(f)])].map(([f, label, c]) => (
                  <button key={label} type="button" data-floor={f} title={f ? data.floor_names[f] : 'All floors'}
                    className={`floor-tab ${floor === f ? 'active' : ''} ${c.free === 0 ? 'full' : ''}`} onClick={() => setFloor(f)}>
                    <span className="fl">{label}</span><span className="cnt">{c.free}/{c.total}</span>
                  </button>
                ))}
              </div>
            </div>

            <details className="disclosure">
              <summary>Availability by floor</summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="avail"><tbody>
                  <tr><th>Floor</th><th>Bike</th><th>Car</th><th>Load</th></tr>
                  {FLOOR_ORDER.map(f => {
                    const b = data.floors[f].B, c = data.floors[f].C, tot = b.total + c.total;
                    const p = tot ? Math.round(100 * (tot - b.free - c.free) / tot) : 0;
                    const cell = x => (x.total ? `${x.free}/${x.total}` : '–');
                    return (
                      <tr key={f} className={floor === f ? 'sel' : ''}>
                        <td><b>{f}</b> <span className="muted">{data.floor_names[f]}</span></td><td>{cell(b)}</td><td>{cell(c)}</td>
                        <td><div className={'bar ' + (p > 80 ? 'high' : p > 50 ? 'mid' : '')} title={`${p}% occupied`}><span style={{ width: p + '%' }} /></div></td>
                      </tr>
                    );
                  })}
                </tbody></table>
              </div>
            </details>

            <div id="slots">
              {!list.length && <p className="empty-state">No slots match this floor and vehicle type.</p>}
              {FLOOR_ORDER.filter(f => list.some(s => s.floor === f)).map(f => {
                const c = counts(f);
                return (
                  <div className="floor-group" key={f}>
                    <h4>{f} · {data.floor_names[f]} <span className={'tag ' + (c.free ? 'free' : 'full')}>{c.free} free</span></h4>
                    <div className="lot"><div className="slot-grid">
                      {list.filter(s => s.floor === f).map(s => (
                        <button key={s.id} type="button" disabled={!s.available} onClick={() => setSelected(s)}
                          className={`slot ${s.available ? 'free' : 'taken'}${selected?.id === s.id ? ' selected' : ''}`}
                          title={`${s.slot_label}: ${data.floor_names[s.floor]}, ${data.type_names[s.vehicle_type]} slot ${s.slot_no} (${s.available ? 'free' : 'taken'})`}>
                          <span className="art">{!s.available && (s.vehicle_type === 'C' ? <img src={CAR_IMG} alt="" /> : <svg><use href="#i-bike" /></svg>)}</span>
                          <span className="lbl">{s.slot_label}</span>
                        </button>
                      ))}
                    </div></div>
                  </div>
                );
              })}
            </div>
            <div className="key">
              <span><i style={{ border: '2px solid var(--green)' }} />Free</span>
              <span><i style={{ background: 'var(--surface-3)' }} />Taken</span>
              <span><i style={{ background: 'var(--yellow)' }} />Selected</span>
            </div>

            <div className={'zone-card' + (selected ? '' : ' placeholder')}>
              <div><div className="k">Slot</div><div className="zone">{selected ? selected.slot_label : '--'}</div></div>
              <div className="thumb"><svg><use href="#i-pin" /></svg></div>
              <div><div className="k">Time slot</div><div className="time">{selected ? `${fmtTime(start)} - ${fmtTime(end)} · ${data.floor_names[selected.floor]}` : 'Pick a free slot'}</div></div>
              <div className="price">{selected ? `Rs ${hrs * loc.price_per_hour}` : ''}</div>
            </div>
            <label className="field"><span>Vehicle number</span><input id="vehicle" value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="KA22AB1234" autoComplete="off" /></label>
            <button id="bookBtn" className="btn cta" disabled={!selected} onClick={book}>Start booking</button>
          </div>
        )}
        {msg && (msg.booking ? (
          <p className="msg ok">Booked <b>{msg.booking.slot_label}</b> ({msg.booking.floor_name}), booking #{msg.booking.booking_id}, Rs {msg.booking.amount}.{' '}
            <Link href={`/my-bookings?pay=${msg.booking.booking_id}`}><b>Pay now →</b></Link></p>
        ) : <p className={'msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</p>)}
      </section>
    </div>
  );
}
