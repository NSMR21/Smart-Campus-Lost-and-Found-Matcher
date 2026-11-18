// Small presentational components (server-safe: no hooks).
import Link from 'next/link';
import { STRONG_MATCH } from '@/lib/constants';

const STATUS_STYLE = {
  OPEN: 'b-blue', MATCHED: 'b-violet', RECOVERED: 'b-green', CLOSED: 'b-gray',
  AVAILABLE: 'b-teal', CLAIM_PENDING: 'b-amber', CLAIM_APPROVED: 'b-indigo', RETURNED: 'b-green', DISPOSED: 'b-gray',
  PENDING: 'b-amber', APPROVED: 'b-green', REJECTED: 'b-red', WITHDRAWN: 'b-gray',
  SUGGESTED: 'b-blue', CONFIRMED: 'b-green', DISMISSED: 'b-gray',
  STUDENT: 'b-teal', STAFF: 'b-indigo', ADMIN: 'b-violet',
  HANDED_OVER: 'b-green', SCHEDULED: 'b-amber', CANCELLED: 'b-gray',
};

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${STATUS_STYLE[status] ?? 'b-gray'}`}>{status.replace(/_/g, ' ')}</span>;
}

export function ScoreBar({ value, label }) {
  if (value === null || value === undefined) return <span className="muted small">-</span>;
  const pct = Math.round(Number(value) * 100);
  const color = value >= 0.75 ? '#059669' : value >= STRONG_MATCH ? '#4f46e5' : value >= 0.45 ? '#d97706' : '#94a3b8';
  return (
    <div className="score" title={label ?? `${pct}% match`}>
      <div className="score-track"><div className="score-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="score-label" style={{ color }}>{pct}%</span>
    </div>
  );
}

const SWATCH = {
  black: '#111827', white: '#ffffff', grey: '#9ca3af', silver: '#d1d5db', red: '#ef4444', blue: '#3b82f6',
  green: '#22c55e', yellow: '#facc15', orange: '#f97316', pink: '#ec4899', purple: '#a855f7', brown: '#92400e',
  gold: '#d4a017', multicolor: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', other: '#e5e7eb',
};

export function ColorChip({ color }) {
  return (
    <span className="chip"><span className="swatch" style={{ background: SWATCH[color] ?? '#e5e7eb' }} />{color}</span>
  );
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value ?? 0}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T'));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T'));
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function daysAgo(days) {
  if (days === null || days === undefined) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Card for a lost / found report in a grid. */
export function ItemCard({ kind, item }) {
  const id = kind === 'lost' ? item.lost_id : item.found_id;
  const date = kind === 'lost' ? item.lost_date : item.found_date;
  return (
    <Link href={`/${kind}/${id}`} className="card item-card">
      <div className="spread">
        <span className="tiny muted mono">{kind === 'lost' ? 'L' : 'F'}-{id}</span>
        <StatusBadge status={item.status} />
      </div>
      <div className="title">{item.title}</div>
      <div className="desc">{item.description}</div>
      <div className="meta">
        <span>{item.category_name}</span>
        <span>{item.location_name}, {item.building_name}</span>
        <span>{formatDate(date)}</span>
      </div>
      <div className="row">
        <ColorChip color={item.color} />
        {item.brand && <span className="chip">{item.brand}</span>}
        {kind === 'lost' && item.best_match_score !== null && item.best_match_score !== undefined && (
          <span className="chip">best match {Math.round(item.best_match_score * 100)}%</span>
        )}
      </div>
    </Link>
  );
}

/** Horizontal stacked bars. series = [{key, label, color}] */
export function BarList({ rows, labelKey, series, max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => series.reduce((s, x) => s + Number(r[x.key] ?? 0), 0)));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="legend">
        {series.map((s) => <span key={s.key} style={{ '--c': s.color }}>{s.label}</span>)}
      </div>
      <div className="bars">
        {rows.map((r) => {
          const total = series.reduce((s, x) => s + Number(r[x.key] ?? 0), 0);
          return (
            <div className="bar-row" key={r[labelKey]}>
              <span className="nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r[labelKey]}</span>
              <div className="bar-track">
                {series.map((s) => (
                  <div key={s.key} className="bar-seg" title={`${s.label}: ${r[s.key] ?? 0}`}
                    style={{ width: `${(100 * Number(r[s.key] ?? 0)) / top}%`, background: s.color }} />
                ))}
              </div>
              <span className="bold" style={{ textAlign: 'right' }}>{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Grouped vertical bars, one group per row. */
export function ColumnChart({ rows, labelKey, series }) {
  const top = Math.max(1, ...rows.flatMap((r) => series.map((s) => Number(r[s.key] ?? 0))));
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="legend">
        {series.map((s) => <span key={s.key} style={{ '--c': s.color }}>{s.label}</span>)}
      </div>
      <div className="columns">
        {rows.map((r) => (
          <div className="column-group" key={r[labelKey]}>
            <div className="column-bars">
              {series.map((s) => (
                <div key={s.key} className="column-bar" title={`${s.label}: ${r[s.key] ?? 0}`}
                  style={{ height: `${(100 * Number(r[s.key] ?? 0)) / top}%`, background: s.color }} />
              ))}
            </div>
            <span className="tiny muted nowrap">{r[labelKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
