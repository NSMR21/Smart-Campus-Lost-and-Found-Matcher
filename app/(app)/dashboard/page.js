import Link from 'next/link';
import { requirePageSession, can } from '@/lib/auth';
import { getStudentDashboard, getStaffDashboard } from '@/lib/data';
import { Kpi, PageHeader, StatusBadge, ScoreBar, Empty, formatDate, formatDateTime } from '@/components/ui';

export const metadata = { title: 'Dashboard - Campus Lost & Found' };

export default async function DashboardPage({ searchParams }) {
  const session = await requirePageSession();
  const { denied } = await searchParams;

  return (
    <>
      <PageHeader title={`Hello, ${session.name}`} subtitle={`Signed in as ${session.role.toLowerCase()}`}>
        {can(session, 'REPORT_LOST') && <Link className="btn btn-primary" href="/lost/new">Report lost item</Link>}
        {can(session, 'REPORT_FOUND') && <Link className="btn btn-secondary" href="/found/new">Report found item</Link>}
      </PageHeader>
      {denied && <div className="alert alert-warning" style={{ marginBottom: 16 }}>
        You do not have permission to open that page.</div>}
      {can(session, 'CLAIM_VERIFY') ? <StaffDashboard /> : <StudentDashboard userId={session.userId} />}
    </>
  );
}

async function StudentDashboard({ userId }) {
  const { lost, suggestions, claims, recentFound, counts } = await getStudentDashboard(userId);
  return (
    <div className="stack">
      <div className="grid grid-4">
        <Kpi label="My lost reports" value={counts.my_lost} />
        <Kpi label="Items I found" value={counts.my_found} hint={`${counts.my_returned} returned to owners`} />
        <Kpi label="Pending claims" value={counts.my_pending_claims} />
        <Kpi label="Match suggestions" value={suggestions.length} hint="for your open reports" />
      </div>

      <div className="card">
        <div className="card-header">
          <div><h2>Possible matches for your lost items</h2>
            <p className="small muted">Ranked by rule score (SQL) + description similarity (vector DB)</p></div>
        </div>
        {suggestions.length === 0 ? <Empty>No suggestions yet. We will notify you when something similar is found.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Your report</th><th>Found item</th><th>Found at</th><th>Match</th><th /></tr></thead>
            <tbody>{suggestions.map((m) => (
              <tr key={m.match_id}>
                <td><Link href={`/lost/${m.lost_id}`}>{m.lost_title}</Link></td>
                <td>{m.found_title}<div className="tiny muted">{m.found_category} · {formatDate(m.found_date)}</div></td>
                <td className="small">{m.found_location}</td>
                <td><ScoreBar value={m.total_score} /></td>
                <td><Link className="btn btn-sm btn-primary" href={`/found/${m.found_id}?lost=${m.lost_id}`}>View &amp; claim</Link></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h2>My lost reports</h2><Link className="small" href="/lost?mine=1">View all</Link></div>
          {lost.length === 0 ? <Empty>You have not reported anything lost.</Empty> : (
            <table className="table"><tbody>{lost.map((l) => (
              <tr key={l.lost_id}>
                <td><Link href={`/lost/${l.lost_id}`}>{l.title}</Link>
                  <div className="tiny muted">{l.category_name} · {l.building_name} · {formatDate(l.lost_date)}</div></td>
                <td><StatusBadge status={l.status} /></td>
              </tr>))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h2>My claims</h2><Link className="small" href="/claims">View all</Link></div>
          {claims.length === 0 ? <Empty>No claims yet.</Empty> : (
            <table className="table"><tbody>{claims.map((c) => (
              <tr key={c.claim_id}>
                <td><Link href={`/claims/${c.claim_id}`}>{c.found_title}</Link>
                  <div className="tiny muted">Claimed {formatDateTime(c.claimed_at)}</div>
                  {c.claim_status === 'APPROVED' && !c.return_id &&
                    <div className="tiny" style={{ color: 'var(--success)' }}>Collect from {c.held_at}</div>}</td>
                <td><StatusBadge status={c.return_id ? 'RETURNED' : c.claim_status} /></td>
              </tr>))}</tbody></table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h2>Found on campus this week</h2><Link className="small" href="/found">Browse all</Link></div>
        {recentFound.length === 0 ? <Empty>Nothing new this week.</Empty> : (
          <table className="table"><tbody>{recentFound.map((f) => (
            <tr key={f.found_id}>
              <td><Link href={`/found/${f.found_id}`}>{f.title}</Link></td>
              <td className="small muted">{f.category_name}</td>
              <td className="small muted">{f.building_name}</td>
              <td className="small muted">{formatDate(f.found_date)}</td>
              <td><StatusBadge status={f.status} /></td>
            </tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}

async function StaffDashboard() {
  const { kpis, pending, handover, recentFound } = await getStaffDashboard();
  return (
    <div className="stack">
      <div className="grid grid-4">
        <Kpi label="Open lost reports" value={kpis.open_lost} hint={`${kpis.total_lost} reported in total`} />
        <Kpi label="Unclaimed found items" value={kpis.unclaimed_found} hint={`${kpis.total_found} found in total`} />
        <Kpi label="Claims to verify" value={kpis.pending_claims} hint={`${kpis.awaiting_handover} awaiting hand-over`} />
        <Kpi label="Returned to owners" value={kpis.returned_items}
          hint={`${kpis.recovery_rate ?? 0}% recovery · avg ${kpis.avg_days_to_return ?? '-'} days`} />
      </div>
      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h2>Claims waiting for verification</h2>
            <Link className="small" href="/claims?status=PENDING">Open queue</Link></div>
          {pending.length === 0 ? <Empty>Queue is empty.</Empty> : (
            <table className="table"><tbody>{pending.map((c) => (
              <tr key={c.claim_id}>
                <td><Link href={`/claims/${c.claim_id}`}>#{c.claim_id} · {c.found_title}</Link>
                  <div className="tiny muted">{c.claimant_name} {c.claimant_srn && `(${c.claimant_srn})`} · {formatDateTime(c.claimed_at)}</div></td>
                <td style={{ width: 150 }}>{c.total_score !== null ? <ScoreBar value={c.total_score} /> :
                  <span className="tiny muted">no linked report</span>}</td>
              </tr>))}</tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-header"><h2>Approved - awaiting hand-over</h2>
            <Link className="small" href="/claims?status=HANDOVER">View all</Link></div>
          {handover.length === 0 ? <Empty>Nothing to hand over.</Empty> : (
            <table className="table"><tbody>{handover.map((c) => (
              <tr key={c.claim_id}>
                <td><Link href={`/claims/${c.claim_id}`}>#{c.claim_id} · {c.found_title}</Link>
                  <div className="tiny muted">{c.claimant_name} · kept at {c.held_at}</div></td>
                <td>{c.is_high_value ? <span className="badge b-red">ID REQUIRED</span> : null}</td>
              </tr>))}</tbody></table>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h2>Latest found reports</h2><Link className="small" href="/found">Browse</Link></div>
        <table className="table"><tbody>{recentFound.map((f) => (
          <tr key={f.found_id}>
            <td><Link href={`/found/${f.found_id}`}>{f.title}</Link></td>
            <td className="small muted">{f.category_name}</td>
            <td className="small muted">{f.held_at}</td>
            <td className="small muted">{formatDate(f.found_date)}</td>
            <td><StatusBadge status={f.status} /></td>
          </tr>))}</tbody></table>
      </div>
    </div>
  );
}
