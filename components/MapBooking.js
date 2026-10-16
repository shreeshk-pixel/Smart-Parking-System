'use client';
// Leaflet map of locations + slot grid + booking form.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../lib/api';
import { useUser } from '../lib/useUser';

// Turns a Date into the "YYYY-MM-DDTHH:MM" text a datetime-local input expects
function toInput(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function MapBooking() {
  const user = useUser();
  const mapDiv = useRef(null);
  const [loc, setLoc] = useState(null);           // selected location
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);  // selected slot
  const [start, setStart] = useState(toInput(new Date()));
  const [end, setEnd] = useState(toInput(new Date(Date.now() + 3600000)));
  const [vehicle, setVehicle] = useState('');
  const [msg, setMsg] = useState(null);           // {text, ok}

  // Build the map once
  useEffect(() => {
    const map = L.map(mapDiv.current).setView([15.8497, 74.4977], 13); // Belagavi
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const d = L.DomUtil.create('div', 'legend');
      d.innerHTML = '<b>Parking</b><br><i style="background:green"></i> Slots free<br><i style="background:red"></i> Full';
      return d;
    };
    legend.addTo(map);
    api('/api/locations').then(locs => {
      locs.forEach(l => {
        const m = L.circleMarker([l.latitude, l.longitude], { radius: 12, color: l.free_slots > 0 ? 'green' : 'red', fillOpacity: 0.7 }).addTo(map);
        m.bindPopup(`<b>${l.name}</b><br>${l.free_slots}/${l.total_slots} free<br>Rs ${l.price_per_hour}/hr`);
        m.on('click', () => setLoc(l));
      });
      if (locs.length) map.fitBounds(locs.map(l => [l.latitude, l.longitude]), { padding: [40, 40] });
    }).catch(e => setMsg({ text: e.message, ok: false }));
    return () => map.remove();
  }, []);

  // Load slots whenever the location changes
  useEffect(() => { if (loc) loadSlots(); }, [loc]);

  async function loadSlots() {
    setSelected(null);
    try {
      const q = `location_id=${loc.id}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      setSlots(await api('/api/slots?' + q));
    } catch (e) { setMsg({ text: e.message, ok: false }); }
  }

  async function book() {
    try {
      const r = await api('/api/book', { slot_id: selected.id, vehicle_number: vehicle.trim(), start_time: start, end_time: end });
      setMsg({ text: `Booked! Booking #${r.booking_id}, amount Rs ${r.amount}. Pay for it on My Bookings.`, ok: true });
      loadSlots();
    } catch (e) { setMsg({ text: e.message, ok: false }); }
  }

  return (
    <div className="layout">
      <div id="map" ref={mapDiv} />
      <div className="panel">
        <h2>{loc ? loc.name : 'Click a marker on the map'}</h2>
        {loc && <>
          <p className="muted">{loc.address} · Rs {loc.price_per_hour} per hour</p>
          <label>Start <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>End <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></label>
          <button className="btn" onClick={loadSlots}>Check slots</button>
          <div className="slot-grid">
            {slots.map(s => (
              <button key={s.id} disabled={!s.available} onClick={() => setSelected(s)}
                className={`slot ${s.available ? 'free' : 'taken'} ${selected?.id === s.id ? 'selected' : ''}`}>
                {s.slot_number} {s.vehicle_type === 'bike' ? '🏍' : '🚗'}
              </button>
            ))}
          </div>
          <p className="muted">Green is free and red is taken. Click a green slot to book it.</p>
          {user ? <>
            <label>Vehicle number <input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="KA22AB1234" /></label>
            <button className="btn" disabled={!selected} onClick={book}>Book selected slot</button>
          </> : <p><a href="/login">Log in</a> to book a slot.</p>}
        </>}
        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
