import Link from 'next/link';
import { requirePageSession, can } from '@/lib/auth';
import { getMeta, listFound } from '@/lib/data';
import { FOUND_STATUSES } from '@/lib/constants';
import FilterBar from '@/components/FilterBar';
import { PageHeader, ItemCard, Empty } from '@/components/ui';

export const metadata = { title: 'Found items - Campus Lost & Found' };

export default async function FoundListPage({ searchParams }) {
  const session = await requirePageSession();
  const sp = await searchParams;
  const filters = {
    q: sp.q ?? '', category: sp.category ?? '', building: sp.building ?? '',
    status: FOUND_STATUSES.includes(sp.status) ? sp.status : '', from: sp.from ?? '', to: sp.to ?? '',
    mine: sp.mine === '1',
  };
  const [meta, items] = await Promise.all([getMeta(), listFound(filters, session)]);

  return (
    <>
      <PageHeader title="Found items" subtitle="Items handed in at the Lost & Found desks. Recognise yours? Open it and submit a claim.">
        {can(session, 'REPORT_FOUND') && <Link className="btn btn-primary" href="/found/new">Report found item</Link>}
        <Link className="btn btn-secondary" href="/search">Describe what you lost</Link>
      </PageHeader>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <Link className={`tab ${filters.mine ? '' : 'active'}`} href="/found">Unclaimed items</Link>
        <Link className={`tab ${filters.mine ? 'active' : ''}`} href="/found?mine=1">Items I found</Link>
      </div>
      <FilterBar basePath="/found" meta={meta} values={filters} statuses={FOUND_STATUSES} />
      <p className="small muted">{items.length} result(s)</p>
      {items.length === 0 ? <div className="card"><Empty>No found items match these filters.</Empty></div> : (
        <div className="item-list">{items.map((i) => <ItemCard key={i.found_id} kind="found" item={i} />)}</div>
      )}
    </>
  );
}
