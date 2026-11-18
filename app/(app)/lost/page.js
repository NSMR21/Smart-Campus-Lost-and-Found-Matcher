import Link from 'next/link';
import { requirePageSession, can } from '@/lib/auth';
import { getMeta, listLost } from '@/lib/data';
import { LOST_STATUSES } from '@/lib/constants';
import FilterBar from '@/components/FilterBar';
import { PageHeader, ItemCard, Empty } from '@/components/ui';

export const metadata = { title: 'Lost items - Campus Lost & Found' };

export default async function LostListPage({ searchParams }) {
  const session = await requirePageSession();
  const sp = await searchParams;
  const filters = {
    q: sp.q ?? '', category: sp.category ?? '', building: sp.building ?? '',
    status: LOST_STATUSES.includes(sp.status) ? sp.status : '', from: sp.from ?? '', to: sp.to ?? '',
    mine: sp.mine === '1',
  };
  const [meta, items] = await Promise.all([getMeta(), listLost(filters, session)]);

  return (
    <>
      <PageHeader title="Lost items" subtitle="Things students are looking for. Found one of these? Report it as found.">
        {can(session, 'REPORT_LOST') && <Link className="btn btn-primary" href="/lost/new">Report lost item</Link>}
      </PageHeader>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <Link className={`tab ${filters.mine ? '' : 'active'}`} href="/lost">All open reports</Link>
        <Link className={`tab ${filters.mine ? 'active' : ''}`} href="/lost?mine=1">My reports</Link>
      </div>
      <FilterBar basePath="/lost" meta={meta} values={filters} statuses={LOST_STATUSES} />
      <p className="small muted">{items.length} result(s){filters.q && ' · keyword search uses a MySQL FULLTEXT index'}</p>
      {items.length === 0 ? <div className="card"><Empty>No lost reports match these filters.</Empty></div> : (
        <div className="item-list">{items.map((i) => <ItemCard key={i.lost_id} kind="lost" item={i} />)}</div>
      )}
    </>
  );
}
