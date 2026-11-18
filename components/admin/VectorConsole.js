'use client';

import { useCallback, useEffect, useState } from 'react';

const STATUSES = ['OPEN', 'MATCHED', 'RECOVERED', 'CLOSED', 'AVAILABLE', 'CLAIM_PENDING', 'CLAIM_APPROVED', 'RETURNED', 'DISPOSED'];

async function call(url, method = 'GET', body) {
  const res = await fetch(url, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export default function VectorConsole() {
  const [data, setData] = useState(null);
  const [kind, setKind] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('black phone with a cracked screen');
  const [search, setSearch] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await call(`/api/vector${kind ? `?kind=${kind}` : ''}`));
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      setMessage({ ok: true, text: res.message ?? 'Done' });
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setSearch(await call('/api/vector/search', 'POST', { q, kind: kind || undefined }));
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const s = data?.stats;
  return (
    <div className="stack">
      {message && <div className={`alert ${message.ok ? 'alert-success' : 'alert-error'}`}>{message.text}</div>}

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-label">Table</div><div className="kpi-value" style={{ fontSize: 18 }}>{s?.table ?? '...'}</div>
          <div className="kpi-hint">{s?.location}</div></div>
        <div className="card kpi"><div className="kpi-label">Documents</div><div className="kpi-value">{s?.total ?? '-'}</div>
          <div className="kpi-hint">{s ? `${s.lost} lost · ${s.found} found` : ''}</div></div>
        <div className="card kpi"><div className="kpi-label">Vector size</div><div className="kpi-value">{s?.dimension ?? '-'}</div>
          <div className="kpi-hint">{s ? Object.entries(s.byModel).map(([m, n]) => `${m} (${n})`).join(', ') : ''}</div></div>
        <div className="card kpi"><div className="kpi-label">Table version</div><div className="kpi-value">{s?.version ?? '-'}</div>
          <div className="kpi-hint">every write creates a new version</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card card-body stack">
          <h3>Indexes</h3>
          <div className="row">{s?.indices.map((ix) => <span key={ix.name} className="chip">{ix.name} · {ix.type}</span>)}</div>
          <p className="small muted mt-0">{s?.vectorIndexNote}</p>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={busy}
              onClick={() => window.confirm('Drop and rebuild the vector table from MySQL?') && act(() => call('/api/vector/sync', 'POST'))}>
              {busy ? 'Working...' : 'Rebuild from MySQL (create)'}</button>
          </div>
        </div>
        <form className="card card-body stack" onSubmit={runSearch}>
          <h3>Nearest-neighbour query (read)</h3>
          <div className="row">
            <input value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" disabled={busy}>Search</button>
          </div>
          {search && (
            <div className="small">
              <div className="muted tiny">query vector [{search.preview.join(', ')}, ...] ({search.dimension} dims, {search.model})</div>
              <table className="table"><tbody>{search.hits.map((h) => (
                <tr key={h.id}><td className="mono tiny">{h.id}</td><td>{h.title}</td>
                  <td className="bold">{(h.similarity * 100).toFixed(1)}%</td></tr>))}</tbody></table>
            </div>
          )}
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div><h2>Documents</h2><p className="small muted">Metadata columns of item_vectors (the 384-number vector column is not shown)</p></div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All kinds</option><option value="lost">lost</option><option value="found">found</option>
          </select>
        </div>
        <div className="table-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}><table className="table">
          <thead><tr><th>id</th><th>title</th><th>event date</th><th>status (update)</th><th>updated</th><th /></tr></thead>
          <tbody>{data?.documents.map((d) => (
            <tr key={d.id}>
              <td className="mono small">{d.id}</td>
              <td>{d.title}<div className="tiny muted">cat {d.category_id} · loc {d.location_id} · user {d.user_id}</div></td>
              <td className="small nowrap">{d.event_date}</td>
              <td><select value={d.status} disabled={busy} style={{ width: 'auto' }}
                onChange={(e) => act(() => call(`/api/vector/${d.id}`, 'PATCH', { status: e.target.value }))}>
                {STATUSES.map((st) => <option key={st}>{st}</option>)}</select></td>
              <td className="tiny muted nowrap">{d.updated_at?.slice(0, 19).replace('T', ' ')}</td>
              <td className="nowrap">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(() => call(`/api/vector/${d.id}`, 'POST'))}>Re-embed</button>
                <button className="btn btn-ghost btn-sm" disabled={busy}
                  onClick={() => window.confirm(`Delete ${d.id} from the vector DB?`) && act(() => call(`/api/vector/${d.id}`, 'DELETE'))}>Delete</button>
              </td>
            </tr>))}</tbody>
        </table></div>
      </div>
    </div>
  );
}
