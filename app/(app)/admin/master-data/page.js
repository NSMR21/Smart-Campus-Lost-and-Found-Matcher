import { requirePageSession, can } from '@/lib/auth';
import { getMeta } from '@/lib/data';
import { CategoryManager, LocationManager, Housekeeping } from '@/components/admin/MasterDataForms';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Categories & locations - Campus Lost & Found' };

export default async function MasterDataPage() {
  const session = await requirePageSession('MASTER_DATA_MANAGE');
  const meta = await getMeta();
  return (
    <>
      <PageHeader title="Categories & locations"
        subtitle="Master data used for structured search and rule-based matching. Deleting a value that is still referenced is blocked by its foreign key." />
      <div className="grid grid-2">
        <div className="card"><div className="card-header"><div><h2>Category hierarchy</h2>
          <p className="small muted">Self-referencing table, read through the recursive view vw_category_tree</p></div></div>
          <div className="card-body"><CategoryManager categories={meta.categories} /></div></div>
        <div className="card"><div className="card-header"><div><h2>Campus locations</h2>
          <p className="small muted">buildings 1:N locations · desks marked as collection points</p></div></div>
          <div className="card-body"><LocationManager buildings={meta.buildings} locations={meta.locations} /></div></div>
      </div>
      {can(session, 'ITEM_DISPOSE') && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><div><h2>Housekeeping</h2>
            <p className="small muted">Stored procedures: a CURSOR loop that sends reminders, and a bulk UPDATE in a transaction</p></div></div>
          <div className="card-body"><Housekeeping /></div>
        </div>
      )}
    </>
  );
}
