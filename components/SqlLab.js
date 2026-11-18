'use client';

import { useState } from 'react';

const MODE_LABEL = { read: ['READ', 'b-teal'], rollback: ['RUN + ROLLBACK', 'b-amber'], script: ['WORKBENCH SCRIPT', 'b-gray'] };

function ResultView({ result }) {
  if (result.error) return <div className="alert alert-error small mono">{result.error}</div>;
  if (!result.columns) {
    return <div className="alert alert-info small">{result.affectedRows} row(s) affected
      {result.insertId ? ` · insert id ${result.insertId}` : ''} · {result.ms} ms</div>;
  }
  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table className="table">
          <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i}>{row.map((v, j) => (
                <td key={j} className="small" style={{ whiteSpace: String(v ?? '').length > 80 ? 'pre-wrap' : 'nowrap' }}>
                  {v === null ? <span className="muted">NULL</span> : String(v)}</td>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tiny muted" style={{ padding: '6px 14px' }}>
        {result.rowCount} row(s){result.rowCount > result.rows.length ? ` (showing ${result.rows.length})` : ''} · {result.ms} ms</div>
    </div>
  );
}

function Block({ block }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [label, cls] = MODE_LABEL[block.mode] ?? MODE_LABEL.script;

  async function run() {
    setBusy(true);
    const res = await fetch('/api/sql-lab', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: block.id }),
    });
    const data = await res.json().catch(() => ({}));
    setState(res.ok ? data : { error: data.error ?? 'Failed' });
    setBusy(false);
  }

  return (
    <div className="card" id={block.id}>
      <div className="card-header">
        <div>
          <div className="row"><span className="mono tiny muted">{block.id}</span><h3>{block.title}</h3></div>
          {block.concept && <p className="small muted">{block.concept}</p>}
        </div>
        <div className="row">
          <span className={`badge ${cls}`}>{label}</span>
          {block.mode !== 'script' && <button className="btn btn-primary btn-sm" onClick={run} disabled={busy}>{busy ? 'Running...' : 'Run'}</button>}
        </div>
      </div>
      <div className="card-body stack" style={{ gap: 10 }}>
        <pre className="sql">{block.sql}</pre>
        {state?.error && <div className="alert alert-error small">{state.error}</div>}
        {state?.results?.map((r, i) => (
          <div key={i} className="stack" style={{ gap: 6 }}>
            {state.results.length > 1 && <div className="tiny muted mono">#{i + 1} {r.sql.split('\n')[0].slice(0, 90)}</div>}
            <ResultView result={r} />
          </div>
        ))}
        {state?.rolledBack && <div className="tiny muted">Transaction rolled back - the database was not changed.</div>}
      </div>
    </div>
  );
}

export default function SqlLab({ files }) {
  const [active, setActive] = useState(files[0]?.file);
  const current = files.find((f) => f.file === active);
  return (
    <div className="stack">
      <div className="tabs">
        {files.map((f) => (
          <button key={f.file} className={`tab ${f.file === active ? 'active' : ''}`} onClick={() => setActive(f.file)}>
            {f.title.split(':')[0].split(' - ')[0]} <span className="tiny">({f.blocks.length})</span>
          </button>
        ))}
      </div>
      {current && (
        <>
          <p className="small muted mt-0">File <code>db/queries/{current.file}</code> · {current.title}</p>
          {current.blocks.map((b) => <Block key={b.id} block={b} />)}
        </>
      )}
    </div>
  );
}
