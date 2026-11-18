import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePageSession, can } from '@/lib/auth';
import { getClaim } from '@/lib/data';
import ActionButton from '@/components/ActionButton';
import { VerifyPanel, ReturnPanel } from '@/components/ClaimActions';
import { PageHeader, StatusBadge, ScoreBar, formatDate, formatDateTime } from '@/components/ui';

export default async function ClaimDetailPage({ params, searchParams }) {
  const session = await requirePageSession();
  const { id } = await params;
  const sp = await searchParams;
  const claim = await getClaim(Number(id));
  if (!claim) notFound();

  const isVerifier = can(session, 'CLAIM_VERIFY');
  const isClaimant = claim.claimant_id === session.userId;
  if (!isVerifier && !isClaimant) redirect('/claims');

  const steps = [
    { label: 'Claim submitted', at: claim.claimed_at, done: true },
    { label: claim.claim_status === 'REJECTED' ? 'Claim rejected' : claim.claim_status === 'WITHDRAWN' ? 'Claim withdrawn' : 'Ownership verified',
      at: claim.verified_at, done: ['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(claim.claim_status),
      note: claim.verifier_name && `by ${claim.verifier_name}${claim.verification_remarks ? ` - "${claim.verification_remarks}"` : ''}` },
    ...(claim.claim_status === 'APPROVED' || claim.return_id ? [{
      label: claim.return_id ? 'Handed over to owner' : `Waiting for collection at ${claim.held_at}`,
      at: claim.returned_at, done: Boolean(claim.return_id),
      note: claim.handled_by_name && `by ${claim.handled_by_name}${claim.id_proof_checked ? ' · ID checked' : ''}` }] : []),
  ];

  return (
    <>
      <PageHeader title={`Claim #${claim.claim_id}`} subtitle={`${claim.found_title} · claimed by ${claim.claimant_name}`}>
        <StatusBadge status={claim.return_id ? 'RETURNED' : claim.claim_status} />
        {isClaimant && claim.claim_status === 'PENDING' && (
          <ActionButton url={`/api/claims/${claim.claim_id}/withdraw`} label="Withdraw claim"
            confirmText="Withdraw this claim?" className="btn btn-sm btn-ghost" />
        )}
      </PageHeader>
      {sp.submitted && <div className="alert alert-success" style={{ marginBottom: 16 }}>
        Claim submitted. The Lost &amp; Found desk will verify it and you will get a notification.</div>}

      <div className="grid grid-sidebar">
        <div className="stack">
          <div className="card card-body">
            <h2 style={{ marginBottom: 12 }}>Ownership evidence</h2>
            <div className="compare">
              <div>
                <div className="tiny muted bold">CLAIMANT SAYS</div>
                <p style={{ marginBottom: 0 }}>{claim.proof_details}</p>
              </div>
              {isVerifier ? (
                <div>
                  <div className="tiny muted bold">FINDER&apos;S SECRET MARKS <span className="badge b-amber">STAFF ONLY</span></div>
                  <p style={{ marginBottom: 0 }}>{claim.hidden_marks ?? <span className="muted">none recorded</span>}</p>
                </div>
              ) : (
                <div>
                  <div className="tiny muted bold">ITEM DESCRIPTION</div>
                  <p style={{ marginBottom: 0 }}>{claim.found_description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card card-body">
            <dl className="detail-list">
              <dt>Found item</dt><dd><Link href={`/found/${claim.found_id}`}>F-{claim.found_id} · {claim.found_title}</Link> <StatusBadge status={claim.found_status} /></dd>
              <dt>Category</dt><dd>{claim.category_name} {claim.is_high_value ? <span className="badge b-red">HIGH VALUE</span> : null}</dd>
              <dt>Kept at</dt><dd>{claim.held_at}</dd>
              <dt>Found on</dt><dd>{formatDate(claim.found_date)}</dd>
              <dt>Claimant</dt><dd>{claim.claimant_name} {claim.claimant_srn && <span className="muted small">({claim.claimant_srn})</span>}
                {isVerifier && <span className="muted small"> · {claim.claimant_email}</span>}</dd>
              <dt>Linked lost report</dt><dd>{claim.lost_id
                ? <><Link href={`/lost/${claim.lost_id}`}>L-{claim.lost_id} · {claim.lost_title}</Link> <span className="muted small">lost {formatDate(claim.lost_date)}</span></>
                : <span className="muted">none</span>}</dd>
              {claim.total_score !== null && <>
                <dt>Match score</dt>
                <dd style={{ maxWidth: 320 }}>
                  <ScoreBar value={claim.total_score} />
                  <div className="tiny muted">rule {Math.round(claim.rule_score * 100)}% · semantic {Math.round(claim.semantic_score * 100)}%</div>
                </dd>
              </>}
            </dl>
          </div>
        </div>

        <div className="stack">
          <div className="card card-body">
            <h3 style={{ marginBottom: 12 }}>Progress</h3>
            <ul className="timeline">
              {steps.map((s) => (
                <li key={s.label}><span className={`dot ${s.done ? '' : 'off'}`} />
                  <div><div className={s.done ? 'bold' : 'muted'}>{s.label}</div>
                    <div className="tiny muted">{s.at ? formatDateTime(s.at) : ''} {s.note ?? ''}</div></div></li>
              ))}
            </ul>
          </div>
          {isVerifier && claim.claim_status === 'PENDING' && !isClaimant && (
            <div className="card card-body"><h3 style={{ marginBottom: 10 }}>Verify ownership</h3><VerifyPanel claimId={claim.claim_id} /></div>
          )}
          {can(session, 'RETURN_RECORD') && claim.claim_status === 'APPROVED' && !claim.return_id && (
            <div className="card card-body"><h3 style={{ marginBottom: 10 }}>Hand over the item</h3>
              <ReturnPanel claimId={claim.claim_id} highValue={Boolean(claim.is_high_value)} /></div>
          )}
          {isClaimant && claim.claim_status === 'APPROVED' && !claim.return_id && (
            <div className="alert alert-success">Approved! Collect your item at <b>{claim.held_at}</b> with your student ID card.</div>
          )}
        </div>
      </div>
    </>
  );
}
