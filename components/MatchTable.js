import Link from 'next/link';
import ActionButton from './ActionButton';
import { ScoreBar, StatusBadge, formatDate } from './ui';

/**
 * Match suggestions with the score breakdown.
 * perspective = 'lost'  -> rows are found items (owner view)
 * perspective = 'found' -> rows are lost reports (staff view)
 */
export default function MatchTable({ matches, perspective, canDismiss, lostId }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{perspective === 'lost' ? 'Found item' : 'Lost report'}</th>
            <th>Rule (SQL)</th>
            <th>Semantic (vector)</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.match_id}>
              <td>
                {perspective === 'lost' ? (
                  <>
                    <Link href={`/found/${m.found_id}`}>{m.found_title}</Link>
                    <div className="tiny muted">F-{m.found_id} · {m.found_category} · {m.found_location} · {formatDate(m.found_date)}</div>
                  </>
                ) : (
                  <>
                    <Link href={`/lost/${m.lost_id}`}>{m.lost_title}</Link>
                    <div className="tiny muted">L-{m.lost_id} · owner {m.owner_name}</div>
                  </>
                )}
              </td>
              <td style={{ width: 130 }}><ScoreBar value={m.rule_score} label="category, location, date, colour, brand" /></td>
              <td style={{ width: 130 }}><ScoreBar value={m.semantic_score} label="description similarity" /></td>
              <td style={{ width: 130 }}><ScoreBar value={m.total_score} label="0.6 x rule + 0.4 x semantic" /></td>
              <td><StatusBadge status={m.match_status} />
                {perspective === 'lost' && <div style={{ marginTop: 4 }}><StatusBadge status={m.found_status} /></div>}</td>
              <td className="nowrap">
                {perspective === 'lost' && ['AVAILABLE', 'CLAIM_PENDING'].includes(m.found_status) && (
                  <Link className="btn btn-sm btn-primary" href={`/found/${m.found_id}?lost=${lostId}`}>Claim</Link>
                )}{' '}
                {canDismiss && m.match_status === 'SUGGESTED' && (
                  <ActionButton url={`/api/matches/${m.match_id}`} method="PATCH" body={{ status: 'DISMISSED' }}
                    label="Not mine" className="btn btn-sm btn-ghost" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
