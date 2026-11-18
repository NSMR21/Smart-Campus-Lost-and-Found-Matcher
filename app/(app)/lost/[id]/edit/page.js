import { notFound, redirect } from 'next/navigation';
import { requirePageSession, can } from '@/lib/auth';
import { getLost, getMeta } from '@/lib/data';
import ItemReportForm from '@/components/ItemReportForm';
import { PageHeader } from '@/components/ui';

export default async function EditLostPage({ params }) {
  const session = await requirePageSession();
  const { id } = await params;
  const [lost, meta] = await Promise.all([getLost(Number(id)), getMeta()]);
  if (!lost) notFound();
  if (lost.owner_id !== session.userId && !can(session, 'MATCH_MANAGE')) redirect(`/lost/${id}`);
  if (!['OPEN', 'MATCHED'].includes(lost.status)) redirect(`/lost/${id}`);
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title={`Edit L-${lost.lost_id}`} subtitle="Saving re-embeds the text in the vector database and re-runs matching." />
      <ItemReportForm kind="lost" meta={meta} initial={lost} itemId={lost.lost_id} />
    </div>
  );
}
