import Link from 'next/link';
import { requirePageSession } from '@/lib/auth';
import { getAuditLog } from '@/lib/data';
import { PageHeader, StatusBadge, formatDateTime } from '@/components/ui';

export const metadata = { title: 'Audit log - Campus Lost & Found' };

const TABLES = ['lost_items', 'found_items', 'claims', 'users', 'role_permissions'];

export default async function AuditPage({ searchParams }) {
  await requirePageSession('AUDIT_VIEW');
  const sp = await searchParams;
  const table = TABLES.includes(sp.table) ? sp.table : '';
  const rows = await getAuditLog({ table });
  return (
    <>
      <PageHeader title="Audit log" subtitle="Written by AFTER triggers. changed_by comes from the session variable @app_user_id set by the API." />
      <div className="tabs" style={{ marginBottom: 14 }}>
        <Link className={`tab ${table ? '' : 'active'}`} href="/admin/audit">All</Link>
        {TABLES.map((t) => <Link key={t} className={`tab ${table === t ? 'active' : ''}`} href={`/admin/audit?table=${t}`}>{t}</Link>)}
      </div>
      <div className="card"><div className="table-wrap"><table className="table">
        <thead><tr><th>#</th><th>When</th><th>Table</th><th>Record</th><th>Action</th><th>Change</th><th>By</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.log_id}>
            <td className="mono tiny">{r.log_id}</td>
            <td className="small nowrap">{formatDateTime(r.changed_at)}</td>
            <td className="mono small">{r.table_name}</td>
            <td className="mono small">{r.record_id}</td>
            <td><span className={`badge ${r.action === 'DELETE' ? 'b-red' : r.action === 'INSERT' ? 'b-teal' : 'b-indigo'}`}>{r.action}</span></td>
            <td className="small">{r.old_value && <><StatusBadge status={r.old_value} /> → </>}
              {r.new_value && (/^[A-Z_]+$/.test(r.new_value) ? <StatusBadge status={r.new_value} /> : <span className="mono">{r.new_value}</span>)}</td>
            <td className="small">{r.changed_by_name ?? <span className="muted">system</span>}</td>
          </tr>))}</tbody>
      </table></div></div>
    </>
  );
}
