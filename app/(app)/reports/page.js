import { requirePageSession } from '@/lib/auth';
import { getReports } from '@/lib/data';
import { PageHeader, Kpi, BarList, ColumnChart, StatusBadge } from '@/components/ui';

export const metadata = { title: 'Reports - Campus Lost & Found' };

const BLUE = '#6366f1';
const TEAL = '#14b8a6';
const GREEN = '#10b981';
const AMBER = '#f59e0b';

export default async function ReportsPage() {
  await requirePageSession('REPORTS_VIEW');
  const r = await getReports();
  const k = r.kpis;

  return (
    <>
      <PageHeader title="Reports & analytics"
        subtitle="Aggregate queries, views, CTEs and window functions over the live database." />
      <div className="stack">
        <div className="grid grid-4">
          <Kpi label="Recovery rate" value={`${k.recovery_rate ?? 0}%`} hint="found items returned to owners" />
          <Kpi label="Avg days to return" value={k.avg_days_to_return ?? '-'} hint="found date to hand-over" />
          <Kpi label="Strong matches" value={k.strong_matches} hint="total score of 55% or more" />
          <Kpi label="Pending claims" value={k.pending_claims} hint={`${k.awaiting_handover} approved, awaiting hand-over`} />
        </div>

        <div className="card">
          <div className="card-header"><div><h2>Monthly activity</h2>
            <p className="small muted">Recursive CTE generates the month series, correlated subqueries count each month</p></div></div>
          <div className="card-body">
            <ColumnChart rows={r.monthly} labelKey="month" series={[
              { key: 'lost', label: 'Lost reports', color: BLUE },
              { key: 'found', label: 'Found reports', color: TEAL },
              { key: 'returned', label: 'Returned', color: GREEN }]} />
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-header"><div><h2>By category</h2><p className="small muted">view vw_category_stats (CTEs + GROUP BY)</p></div></div>
            <div className="card-body">
              <BarList rows={r.categories} labelKey="category_name" series={[
                { key: 'lost_count', label: 'Lost', color: BLUE },
                { key: 'found_count', label: 'Found', color: TEAL }]} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div><h2>Hotspots by building</h2><p className="small muted">view vw_location_hotspots (LEFT JOIN + COUNT DISTINCT)</p></div></div>
            <div className="card-body">
              <BarList rows={r.hotspots} labelKey="building_name" series={[
                { key: 'lost_count', label: 'Lost here', color: BLUE },
                { key: 'found_count', label: 'Found here', color: TEAL }]} />
            </div>
          </div>
        </div>

        <div className="grid grid-3">
          <div className="card">
            <div className="card-header"><h2>Recovery rate by category</h2></div>
            <table className="table"><tbody>{r.categories.filter((c) => c.found_count > 0).map((c) => (
              <tr key={c.category_id}><td>{c.category_name}</td>
                <td className="small muted">{c.returned_count}/{c.found_count}</td>
                <td className="bold">{c.recovery_rate}%</td></tr>))}</tbody></table>
          </div>
          <div className="card">
            <div className="card-header"><div><h2>Top finders</h2><p className="small muted">RANK() window function</p></div></div>
            <table className="table"><tbody>{r.finders.map((f) => (
              <tr key={f.full_name}><td className="bold">#{f.finder_rank}</td><td>{f.full_name}</td>
                <td className="small muted">{f.returned_to_owner} returned / {f.items_found} found</td></tr>))}</tbody></table>
          </div>
          <div className="stack">
            <div className="card">
              <div className="card-header"><h2>Claim outcomes</h2></div>
              <table className="table"><tbody>{r.claimOutcomes.map((c) => (
                <tr key={c.claim_status}><td><StatusBadge status={c.claim_status} /></td><td className="bold">{c.claims}</td></tr>))}</tbody></table>
            </div>
            <div className="card">
              <div className="card-header"><h2>Unclaimed items by age</h2></div>
              <table className="table"><tbody>{r.ageing.map((a) => (
                <tr key={a.age_bucket}><td>{a.age_bucket}</td><td className="bold">{a.items}</td></tr>))}</tbody></table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><h2>Match score distribution</h2>
            <p className="small muted">How many stored lost/found pairs fall in each total-score band, and how many were confirmed by a hand-over</p></div></div>
          <div className="card-body">
            <BarList rows={r.scoreBuckets} labelKey="bucket" series={[
              { key: 'confirmed', label: 'Confirmed by hand-over', color: GREEN },
              { key: 'unconfirmed', label: 'Suggested / dismissed', color: AMBER }]} />
          </div>
        </div>
      </div>
    </>
  );
}
