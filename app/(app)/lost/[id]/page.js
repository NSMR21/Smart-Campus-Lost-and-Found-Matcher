import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageSession, can } from '@/lib/auth';
import { getLost, getMatchesForLost } from '@/lib/data';
import ActionButton from '@/components/ActionButton';
import MatchTable from '@/components/MatchTable';
import { PageHeader, StatusBadge, ColorChip, Empty, formatDate, formatDateTime, daysAgo } from '@/components/ui';

export default async function LostDetailPage({ params, searchParams }) {
  const session = await requirePageSession();
  const { id } = await params;
  const sp = await searchParams;
  const lost = await getLost(Number(id));
  if (!lost) notFound();

  const isOwner = lost.owner_id === session.userId;
  const isStaff = can(session, 'MATCH_MANAGE');
  const showMatches = isOwner || isStaff;
  const matches = showMatches ? await getMatchesForLost(lost.lost_id) : [];
  const editable = (isOwner || isStaff) && ['OPEN', 'MATCHED'].includes(lost.status);

  return (
    <>
      <PageHeader title={lost.title} subtitle={`Lost report L-${lost.lost_id} · reported ${formatDateTime(lost.created_at)}`}>
        <StatusBadge status={lost.status} />
        {editable && <Link className="btn btn-secondary btn-sm" href={`/lost/${lost.lost_id}/edit`}>Edit</Link>}
        {editable && <ActionButton url={`/api/lost/${lost.lost_id}`} method="PATCH" body={{ action: 'close' }}
          label="I found it myself - close" confirmText="Close this report?" />}
        {(isOwner || isStaff) && lost.status === 'CLOSED' && <ActionButton url={`/api/lost/${lost.lost_id}`} method="PATCH"
          body={{ action: 'reopen' }} label="Reopen" />}
        {(isOwner || isStaff) && lost.status !== 'RECOVERED' && (
          <ActionButton url={`/api/lost/${lost.lost_id}`} method="DELETE" label="Delete" className="btn btn-sm btn-ghost"
            confirmText="Delete this report permanently?" redirectTo="/lost?mine=1" />
        )}
      </PageHeader>

      {sp.saved && <div className="alert alert-success" style={{ marginBottom: 16 }}>
        Report saved and indexed. {Number(sp.matches) > 0
          ? `${sp.matches} possible match(es) found - see below.`
          : 'No matches yet; you will get a notification when a similar item is reported.'}</div>}

      <div className="grid grid-sidebar">
        <div className="card card-body">
          <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{lost.description}</p>
          <dl className="detail-list">
            <dt>Category</dt><dd>{lost.category_path}</dd>
            <dt>Last seen</dt><dd>{lost.location_name}, {lost.building_name} <span className="muted small">({lost.zone})</span></dd>
            <dt>Date lost</dt><dd>{formatDate(lost.lost_date)} <span className="muted small">({daysAgo(lost.days_since_lost)})</span></dd>
            <dt>Colour</dt><dd><ColorChip color={lost.color} /></dd>
            <dt>Brand</dt><dd>{lost.brand ?? <span className="muted">-</span>}</dd>
            <dt>Owner</dt><dd>{lost.owner_name}{(isOwner || isStaff) && <span className="muted small"> · {lost.owner_email}</span>}</dd>
          </dl>
        </div>
        <div className="card card-body stack">
          <h3>How matching works</h3>
          <p className="small muted mt-0">
            Each found item gets a <b>rule score</b> from the MySQL function <code>fn_rule_match_score</code> (category tree,
            location, date gap, colour, brand) and a <b>semantic score</b> from the LanceDB vector database (cosine
            similarity of the description embeddings). The total is a generated column: 0.6 × rule + 0.4 × semantic.
          </p>
          {showMatches && ['OPEN', 'MATCHED'].includes(lost.status) && (
            <ActionButton url="/api/matches/run" body={{ kind: 'lost', id: lost.lost_id }} label="Re-run matching now"
              busyLabel="Matching..." className="btn btn-primary btn-sm" showResult />
          )}
          {!isOwner && !isStaff && (
            <div className="alert alert-info small">Have you found this item? <Link href="/found/new">Report it as found</Link>
              {' '}and hand it in at a collection point.</div>
          )}
        </div>
      </div>

      {showMatches && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><div><h2>Possible matches</h2>
            <p className="small muted">Found items ranked by total score (view <code>vw_match_suggestions</code>)</p></div></div>
          {matches.length === 0 ? <Empty>No candidate found items yet.</Empty> :
            <MatchTable matches={matches} perspective="lost" canDismiss={isOwner || isStaff} lostId={lost.lost_id} />}
        </div>
      )}
    </>
  );
}
