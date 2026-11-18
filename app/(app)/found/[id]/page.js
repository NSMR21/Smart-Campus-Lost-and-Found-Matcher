import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageSession, can } from '@/lib/auth';
import { getFound, getClaimsForFound, getMatchesForFound, getMyClaimFor, getOpenLostReports } from '@/lib/data';
import ActionButton from '@/components/ActionButton';
import ClaimForm from '@/components/ClaimForm';
import MatchTable from '@/components/MatchTable';
import { PageHeader, StatusBadge, ColorChip, ScoreBar, Empty, formatDate, formatDateTime, daysAgo } from '@/components/ui';

export default async function FoundDetailPage({ params, searchParams }) {
  const session = await requirePageSession();
  const { id } = await params;
  const sp = await searchParams;
  const found = await getFound(Number(id), session);
  if (!found) notFound();

  const isStaff = can(session, 'VIEW_HIDDEN_DETAILS');
  const isFinder = found.finder_id === session.userId;
  const open = ['AVAILABLE', 'CLAIM_PENDING'].includes(found.status);
  const [claims, matches, myClaim, myLost] = await Promise.all([
    isStaff ? getClaimsForFound(found.found_id) : [],
    isStaff ? getMatchesForFound(found.found_id) : [],
    getMyClaimFor(found.found_id, session.userId),
    getOpenLostReports(session.userId),
  ]);
  const canClaim = can(session, 'CLAIM_SUBMIT') && open && !isFinder && !myClaim;
  const canEdit = isStaff || (isFinder && found.status === 'AVAILABLE');

  return (
    <>
      <PageHeader title={found.title} subtitle={`Found item F-${found.found_id} · reported ${formatDateTime(found.created_at)}`}>
        <StatusBadge status={found.status} />
        {canEdit && !['RETURNED', 'DISPOSED'].includes(found.status) &&
          <Link className="btn btn-secondary btn-sm" href={`/found/${found.found_id}/edit`}>Edit</Link>}
        {isStaff && <ActionButton url="/api/matches/run" body={{ kind: 'found', id: found.found_id }}
          label="Re-run matching" busyLabel="Matching..." showResult />}
        {can(session, 'ITEM_DISPOSE') && found.status === 'AVAILABLE' && (
          <ActionButton url={`/api/found/${found.found_id}`} method="PATCH" body={{ action: 'dispose' }}
            label="Dispose / donate" className="btn btn-sm btn-ghost" confirmText="Mark this item as disposed?" />
        )}
      </PageHeader>

      {sp.saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>
        Thanks! Report saved. {Number(sp.matches) > 0 ? `${sp.matches} lost report(s) look similar - their owners were notified if the match is strong.` : ''}
        {' '}Please hand the item in at <b>{found.held_at}</b>.</div>}

      <div className="grid grid-sidebar">
        <div className="card card-body">
          <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{found.description}</p>
          <dl className="detail-list">
            <dt>Category</dt><dd>{found.category_path} {found.is_high_value ? <span className="badge b-red">HIGH VALUE</span> : null}</dd>
            <dt>Found at</dt><dd>{found.location_name}, {found.building_name}</dd>
            <dt>Date found</dt><dd>{formatDate(found.found_date)} <span className="muted small">({daysAgo(found.days_since_found)})</span></dd>
            <dt>Colour</dt><dd><ColorChip color={found.color} /></dd>
            <dt>Brand</dt><dd>{found.brand ?? <span className="muted">-</span>}</dd>
            <dt>Collect from</dt><dd><b>{found.held_at}</b></dd>
            <dt>Reported by</dt><dd>{found.finder_name}{isStaff && found.finder_email && <span className="muted small"> · {found.finder_email}</span>}</dd>
            {isStaff && <><dt>Hidden marks</dt><dd>{found.hidden_marks
              ? <span className="badge b-amber">STAFF ONLY</span> : null} {found.hidden_marks ?? <span className="muted">none recorded</span>}</dd></>}
          </dl>
        </div>

        <div className="card card-body stack">
          <h3>Is this yours?</h3>
          {myClaim ? (
            <div className="alert alert-info">You claimed this item. <Link href={`/claims/${myClaim.claim_id}`}>Track claim #{myClaim.claim_id}</Link>
              {' '}<StatusBadge status={myClaim.claim_status} /></div>
          ) : isFinder ? (
            <div className="alert alert-info">You reported this item. Thank you for handing it in!</div>
          ) : canClaim ? (
            <ClaimForm foundId={found.found_id} lostReports={myLost} defaultLostId={sp.lost} />
          ) : (
            <p className="muted small mt-0">This item is not open for claims ({found.status.replace(/_/g, ' ').toLowerCase()}).</p>
          )}
        </div>
      </div>

      {isStaff && (
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-header"><h2>Claims ({claims.length})</h2></div>
            {claims.length === 0 ? <Empty>No claims yet.</Empty> : (
              <table className="table"><tbody>{claims.map((c) => (
                <tr key={c.claim_id}>
                  <td><Link href={`/claims/${c.claim_id}`}>#{c.claim_id} · {c.claimant_name}</Link>
                    <div className="tiny muted">{c.claimant_srn} · {formatDateTime(c.claimed_at)}</div></td>
                  <td style={{ width: 130 }}><ScoreBar value={c.total_score} /></td>
                  <td><StatusBadge status={c.claim_status} /></td>
                </tr>))}</tbody></table>
            )}
          </div>
          <div className="card">
            <div className="card-header"><h2>Matching lost reports</h2></div>
            {matches.length === 0 ? <Empty>No matching lost reports.</Empty> :
              <MatchTable matches={matches} perspective="found" canDismiss />}
          </div>
        </div>
      )}
    </>
  );
}
