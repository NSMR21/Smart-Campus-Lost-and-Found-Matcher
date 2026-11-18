'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function send(url, method, body) {
  const res = await fetch(url, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run(fn, success) {
    setBusy(true);
    setMessage(null);
    try {
      const data = await fn();
      setMessage({ ok: true, text: data?.message ?? success });
      router.refresh();
      return true;
    } catch (err) {
      setMessage({ ok: false, text: err.message });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const view = message && (
    <div className={`alert ${message.ok ? 'alert-success' : 'alert-error'} small`}>{message.text}</div>);
  return { run, busy, view };
}

export function CategoryManager({ categories }) {
  const { run, busy, view } = useAction();
  const [form, setForm] = useState({ category_name: '', parent_category_id: '', is_high_value: false });

  return (
    <div className="stack">
      <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => send('/api/admin/categories', 'POST', form), 'Category added.')) {
          setForm({ category_name: '', parent_category_id: '', is_high_value: false });
        }
      }}>
        <div className="field" style={{ flex: 1 }}><label>New category</label>
          <input value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} required /></div>
        <div className="field" style={{ flex: 1 }}><label>Parent</label>
          <select value={form.parent_category_id} onChange={(e) => setForm({ ...form, parent_category_id: e.target.value })}>
            <option value="">(top level)</option>
            {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.full_path}</option>)}
          </select></div>
        <label className="row small"><input type="checkbox" checked={form.is_high_value}
          onChange={(e) => setForm({ ...form, is_high_value: e.target.checked })} /> high value</label>
        <button className="btn btn-primary" disabled={busy}>Add</button>
      </form>
      {view}
      <div className="table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}><table className="table"><tbody>
        {categories.map((c) => (
          <tr key={c.category_id}>
            <td style={{ paddingLeft: 14 + c.depth * 22 }}>{c.depth > 0 ? '└ ' : ''}<span className={c.depth === 0 ? 'bold' : ''}>{c.category_name}</span>
              {c.is_high_value ? <span className="badge b-red" style={{ marginLeft: 6 }}>HIGH VALUE</span> : null}</td>
            <td style={{ width: 60 }}><button className="btn btn-ghost btn-sm" disabled={busy}
              onClick={() => run(() => send(`/api/admin/categories/${c.category_id}`, 'DELETE'), 'Category deleted.')}>Delete</button></td>
          </tr>))}
      </tbody></table></div>
    </div>
  );
}

export function LocationManager({ buildings, locations }) {
  const { run, busy, view } = useAction();
  const [form, setForm] = useState({ building_id: '', location_name: '', floor_no: '', is_collection_point: false });

  return (
    <div className="stack">
      <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => send('/api/admin/locations', 'POST', form), 'Location added.')) {
          setForm({ building_id: '', location_name: '', floor_no: '', is_collection_point: false });
        }
      }}>
        <div className="field"><label>Building</label>
          <select value={form.building_id} onChange={(e) => setForm({ ...form, building_id: e.target.value })} required>
            <option value="">Select...</option>
            {buildings.map((b) => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
          </select></div>
        <div className="field" style={{ flex: 1 }}><label>Location name</label>
          <input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} required /></div>
        <div className="field" style={{ width: 80 }}><label>Floor</label>
          <input value={form.floor_no} onChange={(e) => setForm({ ...form, floor_no: e.target.value })} /></div>
        <label className="row small"><input type="checkbox" checked={form.is_collection_point}
          onChange={(e) => setForm({ ...form, is_collection_point: e.target.checked })} /> collection point</label>
        <button className="btn btn-primary" disabled={busy}>Add</button>
      </form>
      {view}
      <div className="table-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}><table className="table"><tbody>
        {locations.map((l) => (
          <tr key={l.location_id}>
            <td>{l.location_name}{l.is_collection_point ? <span className="badge b-teal" style={{ marginLeft: 6 }}>DESK</span> : null}
              <div className="tiny muted">{l.building_name} · {l.zone}{l.floor_no !== null ? ` · floor ${l.floor_no}` : ''}</div></td>
            <td style={{ width: 60 }}><button className="btn btn-ghost btn-sm" disabled={busy}
              onClick={() => run(() => send(`/api/admin/locations/${l.location_id}`, 'DELETE'), 'Location deleted.')}>Delete</button></td>
          </tr>))}
      </tbody></table></div>
    </div>
  );
}

export function Housekeeping() {
  const { run, busy, view } = useAction();
  const [disposeDays, setDisposeDays] = useState(45);
  const [remindDays, setRemindDays] = useState(30);
  return (
    <div className="stack">
      <div className="row">
        <span className="small">Remind owners of open reports with no match older than</span>
        <input type="number" value={remindDays} min={1} onChange={(e) => setRemindDays(e.target.value)} style={{ width: 80 }} />
        <span className="small">days</span>
        <button className="btn btn-secondary btn-sm" disabled={busy}
          onClick={() => run(() => send('/api/admin/housekeeping', 'POST', { task: 'remind', days: Number(remindDays) }))}>
          Run sp_remind_stale_reports</button>
      </div>
      <div className="row">
        <span className="small">Dispose / donate items unclaimed for more than</span>
        <input type="number" value={disposeDays} min={30} onChange={(e) => setDisposeDays(e.target.value)} style={{ width: 80 }} />
        <span className="small">days</span>
        <button className="btn btn-secondary btn-sm" disabled={busy}
          onClick={() => window.confirm('Dispose all matching unclaimed items?') &&
            run(() => send('/api/admin/housekeeping', 'POST', { task: 'dispose', days: Number(disposeDays) }))}>
          Run sp_dispose_unclaimed</button>
      </div>
      {view}
    </div>
  );
}
