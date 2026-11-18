import Link from 'next/link';
import { requirePageSession } from '@/lib/auth';
import { semanticSearch, keywordSearch } from '@/lib/search';
import { PageHeader, StatusBadge, ScoreBar, Empty, formatDate } from '@/components/ui';

export const metadata = { title: 'Smart search - Campus Lost & Found' };

const EXAMPLES = ['charger for my HP laptop', 'keys for my scooter', 'book about databases',
  'sweatshirt left after the cultural fest'];

export default async function SearchPage({ searchParams }) {
  const session = await requirePageSession();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 300);
  const kind = sp.kind === 'lost' ? 'lost' : 'found';

  let semantic = null;
  let keyword = [];
  let error = null;
  if (q.length >= 3) {
    try {
      [semantic, keyword] = await Promise.all([semanticSearch(q, kind), keywordSearch(q, kind, session)]);
    } catch (err) {
      error = err.message;
    }
  }

  return (
    <>
      <PageHeader title="Smart search"
        subtitle="Describe the item in your own words. The vector database finds reports with a similar meaning, not just the same words." />
      <form className="card card-body" method="GET" action="/search">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label htmlFor="q">What are you looking for?</label>
            <input id="q" name="q" defaultValue={q} placeholder="e.g. black phone with a cracked screen guard" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="kind">Search in</label>
            <select id="kind" name="kind" defaultValue={kind}>
              <option value="found">Found items</option>
              <option value="lost">Lost reports</option>
            </select>
          </div>
          <button className="btn btn-primary">Search</button>
        </div>
        <div className="row small" style={{ marginTop: 10 }}>
          <span className="muted">Try:</span>
          {EXAMPLES.map((e) => <Link key={e} className="chip" href={`/search?q=${encodeURIComponent(e)}&kind=found`}>{e}</Link>)}
        </div>
      </form>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>Vector search failed: {error}</div>}

      {semantic && (
        <div className="grid grid-sidebar" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-header"><div><h2>Semantic matches</h2>
              <p className="small muted">LanceDB cosine search · model {semantic.model}</p></div></div>
            {semantic.results.length === 0 ? <Empty>Nothing similar yet.</Empty> : (
              <table className="table"><tbody>{semantic.results.map((r) => {
                const rid = r[`${kind}_id`];
                return (
                  <tr key={rid}>
                    <td><Link href={`/${kind}/${rid}`}>{r.title}</Link>
                      <div className="small muted">{r.description}</div>
                      <div className="tiny muted">{r.category_name} · {r.location_name}, {r.building_name} ·
                        {' '}{formatDate(kind === 'found' ? r.found_date : r.lost_date)}</div></td>
                    <td style={{ width: 140 }}><ScoreBar value={r.similarity} label="cosine similarity" /></td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>);
              })}</tbody></table>
            )}
          </div>
          <div className="card">
            <div className="card-header"><div><h2>Keyword search</h2>
              <p className="small muted">MySQL FULLTEXT index, same words only</p></div></div>
            {keyword.length === 0 ? <Empty>No exact keyword hits - this is where semantic search helps.</Empty> : (
              <table className="table"><tbody>{keyword.slice(0, 12).map((r) => {
                const rid = r[`${kind}_id`];
                return <tr key={rid}><td><Link href={`/${kind}/${rid}`}>{r.title}</Link>
                  <div className="tiny muted">{r.category_name}</div></td></tr>;
              })}</tbody></table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
