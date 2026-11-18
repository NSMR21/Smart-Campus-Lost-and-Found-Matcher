import Link from 'next/link';

// Plain GET form: filters live in the URL so results can be bookmarked and shared.
export default function FilterBar({ basePath, meta, values, statuses }) {
  return (
    <form className="card card-body filters" method="GET" action={basePath}>
      {values.mine && <input type="hidden" name="mine" value="1" />}
      <div className="field">
        <label htmlFor="q">Keywords</label>
        <input id="q" name="q" defaultValue={values.q} placeholder="e.g. black wallet, casio, hoodie" />
      </div>
      <div className="field">
        <label htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={values.category}>
          <option value="">All</option>
          {meta.categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>{'  '.repeat(c.depth)}{c.category_name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="building">Building</label>
        <select id="building" name="building" defaultValue={values.building}>
          <option value="">All</option>
          {meta.buildings.map((b) => <option key={b.building_id} value={b.building_id}>{b.building_name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={values.status}>
          <option value="">{values.mine ? 'Any' : 'Open only'}</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="from">From date</label>
        <input id="from" type="date" name="from" defaultValue={values.from} />
      </div>
      <div className="row">
        <button className="btn btn-primary">Search</button>
        <Link className="btn btn-ghost" href={values.mine ? `${basePath}?mine=1` : basePath}>Reset</Link>
      </div>
    </form>
  );
}
