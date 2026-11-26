'use client';
// Admin page: add a new parking location (click the map for lat/lng) and see all locations.
// New lots get the same number of bike and car slots on every floor (LG, G, F1, F2, F3).
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '../../../../lib/api';
// Leaflet needs the browser, so load the map only on the client
const LocationPicker = dynamic(() => import('../../../../components/LocationPicker'), { ssr: false, loading: () => <p className="muted">Loading map…</p> });

const empty = { name: '', address: '', latitude: '', longitude: '', price_per_hour: '20', car_slots: '4', bike_slots: '6' };

export default function LocationsAdmin() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value }); // update one field

  const load = () => api('/api/admin/locations').then(setList).catch(e => setMsg({ text: e.message, ok: false }));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      const r = await api('/api/admin/locations', form);
      setMsg({ text: `${r.message} ${r.slots_created} slots created across 5 floors.`, ok: true });
      setForm(empty); load();
    } catch (err) { setMsg({ text: err.message, ok: false }); }
  }

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Admin</span><h1>Parking <b>locations</b></h1><p>Add a lot by clicking the map. Every lot gets floors LG, G, F1, F2 and F3.</p></div>
      </div>
      {msg && <p className={'msg ' + (msg.ok ? 'success' : 'error')} style={{ marginBottom: 16 }}>{msg.text}</p>}
      <div className="grid-2">
        <form className="card stack" onSubmit={save}>
          <div className="card-head" style={{ margin: 0 }}><h3>Add a location</h3><p>Click on the map to set the position, or type it.</p></div>
          <label className="field"><span>Name</span><input value={form.name} onChange={set('name')} required /></label>
          <label className="field"><span>Address</span><input value={form.address} onChange={set('address')} required /></label>
          <div className="form-grid">
            <label className="field"><span>Latitude</span><input type="number" step="any" value={form.latitude} onChange={set('latitude')} required /></label>
            <label className="field"><span>Longitude</span><input type="number" step="any" value={form.longitude} onChange={set('longitude')} required /></label>
            <label className="field"><span>Price per hour (₹)</span><input type="number" min="0" step="any" value={form.price_per_hour} onChange={set('price_per_hour')} /></label>
            <label className="field"><span>Bike slots per floor</span><input type="number" min="0" max="99" value={form.bike_slots} onChange={set('bike_slots')} /></label>
            <label className="field"><span>Car slots per floor</span><input type="number" min="0" max="99" value={form.car_slots} onChange={set('car_slots')} /></label>
          </div>
          <button className="btn dark">Add location</button>
        </form>
        <section className="card stack">
          <h3>Position</h3>
          <LocationPicker lat={form.latitude} lng={form.longitude} onPick={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))} />
        </section>
      </div>
      <section className="section">
        <h2>All locations</h2>
        <div className="card flush"><div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Address</th><th>Lat, Lng</th><th className="num">₹/hr</th><th className="num">Floors</th><th className="num">Slots</th></tr></thead>
          <tbody>
            {list.map(l => (
              <tr key={l.id}><td><b>{l.name}</b></td><td>{l.address}</td><td className="code">{Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}</td>
                <td className="num">{l.price_per_hour}</td><td className="num">{l.floors}</td><td className="num">{l.slots}</td></tr>
            ))}
          </tbody></table></div></div>
      </section>
    </>
  );
}
