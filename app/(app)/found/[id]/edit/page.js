import { notFound, redirect } from 'next/navigation';
import { requirePageSession, can } from '@/lib/auth';
import { getFound, getMeta } from '@/lib/data';
import { queryOne } from '@/lib/db';
import ItemReportForm from '@/components/ItemReportForm';
import { PageHeader } from '@/components/ui';

export default async function EditFoundPage({ params }) {
  const session = await requirePageSession();
  const { id } = await params;
  const [found, meta] = await Promise.all([getFound(Number(id), session), getMeta()]);
  if (!found) notFound();
  const isStaff = can(session, 'VIEW_HIDDEN_DETAILS');
  if (!isStaff && !(found.finder_id === session.userId && found.status === 'AVAILABLE')) redirect(`/found/${id}`);
  // the finder may edit their own secret details even though the public view hides them
  const secret = await queryOne('SELECT hidden_marks FROM found_items WHERE found_id = ?', [found.found_id]);
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title={`Edit F-${found.found_id}`} subtitle="Saving re-embeds the text in the vector database and re-runs matching." />
      <ItemReportForm kind="found" meta={meta} initial={{ ...found, hidden_marks: secret?.hidden_marks }} itemId={found.found_id} />
    </div>
  );
}
