'use client';
// Admin page: add a new parking location (click the map for lat/lng) and see all locations.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '../../../lib/api';
// Leaflet needs the browser, so load the map only on the client
const LocationPicker = dynamic(() => import('../../../components/LocationPicker'), { ssr: false, loading: () => <p>Loading map…</p> });

const empty = { name: '', address: '', latitude: '', longitude: '', price_per_hour: '20', car_slots: '4', bike_slots: '4' };

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
      setMsg({ text: `${r.message} ${r.slots_created} slots created.`, ok: true });
      setForm(empty); load();
    } catch (err) { setMsg({ text: err.message, ok: false }); }
  }

  return (
    <>
      <h1>Parking Locations</h1>
      {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      <form className="box" onSubmit={save}>
        <h2>Add a location</h2>
        <label>Name <input value={form.name} onChange={set('name')} required /></label>
        <label>Address <input value={form.address} onChange={set('address')} required /></label>
        <p>Click on the map to set the position, or type latitude/longitude below.</p>
        <LocationPicker lat={form.latitude} lng={form.longitude}
          onPick={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))} />
        <label>Latitude <input type="number" step="any" value={form.latitude} onChange={set('latitude')} required /></label>
        <label>Longitude <input type="number" step="any" value={form.longitude} onChange={set('longitude')} required /></label>
        <label>Price per hour (Rs) <input type="number" min="0" step="any" value={form.price_per_hour} onChange={set('price_per_hour')} /></label>
        <label>Car slots to create (A1, A2…) <input type="number" min="0" max="100" value={form.car_slots} onChange={set('car_slots')} /></label>
        <label>Bike slots to create (B1, B2…) <input type="number" min="0" max="100" value={form.bike_slots} onChange={set('bike_slots')} /></label>
        <button className="btn">Add location</button>
      </form>
      <h2>All locations</h2>
      <table className="table">
        <thead><tr><th>Name</th><th>Address</th><th>Lat, Lng</th><th>Rs/hr</th><th>Slots</th></tr></thead>
        <tbody>
          {list.map(l => (
            <tr key={l.id}><td>{l.name}</td><td>{l.address}</td><td>{Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}</td><td>{l.price_per_hour}</td><td>{l.slots}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
