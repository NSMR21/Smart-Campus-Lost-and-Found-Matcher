import Link from 'next/link';
import { requirePageSession, can } from '@/lib/auth';
import { listClaims } from '@/lib/data';
import { PageHeader, StatusBadge, ScoreBar, Empty, formatDateTime } from '@/components/ui';

export const metadata = { title: 'Claims - Campus Lost & Found' };

const TABS = [
  { key: '', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'HANDOVER', label: 'Awaiting hand-over' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default async function ClaimsPage({ searchParams }) {
  const session = await requirePageSession();
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? sp.status : '';
  const isVerifier = can(session, 'CLAIM_VERIFY');
  const mine = !isVerifier || sp.mine === '1';
  const claims = await listClaims({ mine, status }, session);
  const qs = (s) => `/claims?${new URLSearchParams({ ...(s && { status: s }), ...(mine && isVerifier && { mine: '1' }) })}`;

  return (
    <>
      <PageHeader title={isVerifier && !mine ? 'Claims queue' : 'My claims'}
        subtitle={isVerifier ? 'Verify ownership before an item is handed over.' : 'Track the claims you submitted for found items.'} />
      <div className="tabs" style={{ marginBottom: 14 }}>
        {TABS.map((t) => <Link key={t.key} className={`tab ${status === t.key ? 'active' : ''}`} href={qs(t.key)}>{t.label}</Link>)}
      </div>
      <div className="card">
        {claims.length === 0 ? <Empty>No claims here.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th><th>Item</th>{isVerifier && !mine && <th>Claimant</th>}<th>Linked report</th>
              <th>Match</th><th>Claimed</th><th>Status</th></tr></thead>
            <tbody>{claims.map((c) => (
              <tr key={c.claim_id}>
                <td><Link href={`/claims/${c.claim_id}`}>#{c.claim_id}</Link></td>
                <td><Link href={`/claims/${c.claim_id}`}>{c.found_title}</Link>
                  <div className="tiny muted">{c.category_name} · {c.held_at}</div></td>
                {isVerifier && !mine && <td>{c.claimant_name}<div className="tiny muted">{c.claimant_srn}</div></td>}
                <td className="small">{c.lost_id ? <Link href={`/lost/${c.lost_id}`}>L-{c.lost_id}</Link> : <span className="muted">none</span>}</td>
                <td style={{ width: 130 }}><ScoreBar value={c.total_score} /></td>
                <td className="small nowrap">{formatDateTime(c.claimed_at)}</td>
                <td><StatusBadge status={c.return_id ? 'RETURNED' : c.claim_status} /></td>
              </tr>))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
