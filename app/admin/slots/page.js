'use client';
// Admin slot management: add, edit, delete (or deactivate if it has bookings).
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

const empty = { id: null, location_id: '', slot_number: '', vehicle_type: 'car', is_active: true };

export default function SlotsAdmin() {
  const [data, setData] = useState({ locations: [], slots: [] });
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState(null);

  const load = () => api('/api/admin/slots').then(setData).catch(e => setMsg({ text: e.message, ok: false }));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      await api('/api/admin/slots', form, form.id ? 'PUT' : 'POST');
      setMsg({ text: form.id ? 'Slot updated.' : 'Slot added.', ok: true }); setForm(empty); load();
    } catch (err) { setMsg({ text: err.message, ok: false }); }
  }
  async function remove(s) {
    if (!confirm(`Delete slot ${s.slot_number}?`)) return;
    try { const r = await api('/api/admin/slots', { id: s.id }, 'DELETE'); setMsg({ text: r.message || 'Slot removed.', ok: true }); load(); }
    catch (err) { setMsg({ text: err.message, ok: false }); }
  }

  return (
    <>
      <h1>Manage Slots</h1>
      {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      <form className="box" onSubmit={save}>
        <h2>{form.id ? `Edit slot ${form.slot_number}` : 'Add a slot'}</h2>
        <label>Location
          <select value={form.location_id} onChange={e => setForm({ ...form, location_id: e.target.value })} required>
            <option value="">Choose…</option>
            {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label>Slot number <input value={form.slot_number} onChange={e => setForm({ ...form, slot_number: e.target.value })} placeholder="A1" required /></label>
        <label>Vehicle type
          <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })}>
            <option value="car">Car</option><option value="bike">Bike</option>
          </select>
        </label>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
        <button className="btn">{form.id ? 'Save changes' : 'Add slot'}</button>
        {form.id && <button type="button" className="btn" onClick={() => setForm(empty)}>Cancel edit</button>}
      </form>
      <h2>All slots</h2>
      <table className="table">
        <thead><tr><th>Location</th><th>Slot</th><th>Type</th><th>Active</th><th></th></tr></thead>
        <tbody>
          {data.slots.map(s => (
            <tr key={s.id}>
              <td>{s.location_name}</td><td>{s.slot_number}</td><td>{s.vehicle_type}</td><td>{s.is_active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn" onClick={() => setForm({ ...s, is_active: !!s.is_active })}>Edit</button>
                <button className="btn danger" onClick={() => remove(s)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
