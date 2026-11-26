'use client';
// Admin: manage slots. Names are built from floor + type + number (e.g. F1-B12).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api';

const FLOORS = { LG: 'Lower Ground', G: 'Ground', F1: 'Floor 1', F2: 'Floor 2', F3: 'Floor 3' };
const TYPES = { B: 'Bike', C: 'Car' };
const Opts = ({ map, all }) => <>{all && <option value="">All</option>}{Object.entries(map).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</>;

function SlotRow({ s, onSaved, onMsg }) {
  const [f, setF] = useState({ floor: s.floor, vehicle_type: s.vehicle_type, slot_no: String(s.slot_no), is_active: s.is_active });
  useEffect(() => { setF({ floor: s.floor, vehicle_type: s.vehicle_type, slot_no: String(s.slot_no), is_active: s.is_active }); }, [s]);
  async function save() {
    try { const r = await api('/api/admin/slots', { id: s.id, ...f }, 'PUT'); onMsg({ text: r.message, ok: true }); onSaved(); }
    catch (e) { onMsg({ text: e.message, ok: false }); }
  }
  async function del() {
    if (!confirm(`Delete slot ${s.slot_label}?`)) return;
    try { const r = await api('/api/admin/slots', { id: s.id }, 'DELETE'); onMsg({ text: r.message, ok: true }); onSaved(); }
    catch (e) { onMsg({ text: e.message, ok: false }); }
  }
  return (
    <tr>
      <td><span className="slot-pill">{s.slot_label}</span></td>
      <td><select value={f.floor} onChange={e => setF({ ...f, floor: e.target.value })}><Opts map={FLOORS} /></select></td>
      <td><select value={f.vehicle_type} onChange={e => setF({ ...f, vehicle_type: e.target.value })}><Opts map={TYPES} /></select></td>
      <td><input type="number" min="1" max="99" value={f.slot_no} onChange={e => setF({ ...f, slot_no: e.target.value })} style={{ width: 80 }} /></td>
      <td><input type="checkbox" checked={f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} /></td>
      <td><div className="actions">
        <button className="btn sm" type="button" onClick={save}>Save</button>
        <button className="btn sm ghost-danger" type="button" onClick={del}>Delete</button>
      </div></td>
    </tr>
  );
}

export default function SlotsAdmin() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState({ loc: '', floor: '', type: '' });
  const [one, setOne] = useState({ location_id: '', floor: 'G', vehicle_type: 'C', slot_no: '' });
  const [many, setMany] = useState({ location_id: '', floor: 'G', vehicle_type: 'B', count: '5' });
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (f = filter) => {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const d = await api('/api/admin/slots' + (q ? '?' + q : ''));
    setData(d);
    setOne(o => ({ ...o, location_id: o.location_id || String(d.loc) }));
    setMany(m => ({ ...m, location_id: m.location_id || String(d.loc) }));
    if (!f.loc) setFilter(x => ({ ...x, loc: String(d.loc) }));
  }, [filter]);
  useEffect(() => { load().catch(e => setMsg({ text: e.message, ok: false })); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e, body) {
    e.preventDefault();
    try { const r = await api('/api/admin/slots', body); setMsg({ text: r.message, ok: true }); load(); }
    catch (err) { setMsg({ text: err.message, ok: false }); }
  }
  const LocSelect = ({ value, onChange }) => (
    <select value={value} onChange={onChange}>{data?.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
  );
  const count = (f, t) => data?.counts.find(c => c.floor === f && c.vehicle_type === t)?.active || 0;

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Admin</span><h1>Manage <b>slots</b></h1><p>Slot names are built from floor + type + number, e.g. <span className="slot-pill">F1-B12</span>.</p></div>
      </div>
      {msg && <p className={'msg ' + (msg.ok ? 'success' : 'error')} style={{ marginBottom: 16 }}>{msg.text}</p>}

      <div className="grid-2">
        <form className="card stack" onSubmit={e => add(e, one)}>
          <div className="card-head" style={{ margin: 0 }}><h3>Add one slot</h3><p>Leave the number blank to use the next one.</p></div>
          <div className="form-grid">
            <label className="field"><span>Location</span><LocSelect value={one.location_id} onChange={e => setOne({ ...one, location_id: e.target.value })} /></label>
            <label className="field"><span>Floor</span><select value={one.floor} onChange={e => setOne({ ...one, floor: e.target.value })}><Opts map={FLOORS} /></select></label>
            <label className="field"><span>Type</span><select value={one.vehicle_type} onChange={e => setOne({ ...one, vehicle_type: e.target.value })}><Opts map={TYPES} /></select></label>
            <label className="field"><span>Number</span><input type="number" min="1" max="99" placeholder="auto" value={one.slot_no} onChange={e => setOne({ ...one, slot_no: e.target.value })} /></label>
          </div>
          <button className="btn dark">Add slot</button>
        </form>
        <form className="card stack" onSubmit={e => add(e, { ...many, action: 'bulk' })}>
          <div className="card-head" style={{ margin: 0 }}><h3>Add many slots</h3><p>Appends after the highest number on that floor.</p></div>
          <div className="form-grid">
            <label className="field"><span>Location</span><LocSelect value={many.location_id} onChange={e => setMany({ ...many, location_id: e.target.value })} /></label>
            <label className="field"><span>Floor</span><select value={many.floor} onChange={e => setMany({ ...many, floor: e.target.value })}><Opts map={FLOORS} /></select></label>
            <label className="field"><span>Type</span><select value={many.vehicle_type} onChange={e => setMany({ ...many, vehicle_type: e.target.value })}><Opts map={TYPES} /></select></label>
            <label className="field"><span>How many</span><input type="number" min="1" max="50" value={many.count} onChange={e => setMany({ ...many, count: e.target.value })} /></label>
          </div>
          <button className="btn">Add slots</button>
        </form>
      </div>

      <section className="section">
        <form className="card stack" onSubmit={e => { e.preventDefault(); load(filter); }}>
          <div className="form-grid">
            <label className="field"><span>Location</span><LocSelect value={filter.loc} onChange={e => setFilter({ ...filter, loc: e.target.value })} /></label>
            <label className="field"><span>Floor</span><select value={filter.floor} onChange={e => setFilter({ ...filter, floor: e.target.value })}><Opts map={FLOORS} all /></select></label>
            <label className="field"><span>Type</span><select value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}><Opts map={TYPES} all /></select></label>
            <button className="btn secondary">Filter</button>
          </div>
          <div className="row">
            {Object.keys(FLOORS).map(f => <span key={f} className="tag soft"><b>{f}</b>&nbsp;· Bike {count(f, 'B')} · Car {count(f, 'C')}</span>)}
          </div>
        </form>
      </section>

      <section className="section">
        <div className="card flush"><div className="table-wrap"><table className="table">
          <thead><tr><th>Label</th><th>Floor</th><th>Type</th><th>No.</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {data && !data.slots.length && <tr><td colSpan={6} className="empty">No slots for this filter.</td></tr>}
            {data?.slots.map(s => <SlotRow key={s.id} s={s} onSaved={() => load()} onMsg={setMsg} />)}
          </tbody></table></div></div>
      </section>
    </>
  );
}
