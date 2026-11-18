import { requirePageSession } from '@/lib/auth';
import { getMeta } from '@/lib/data';
import ItemReportForm from '@/components/ItemReportForm';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Report found item - Campus Lost & Found' };

export default async function NewFoundPage() {
  await requirePageSession('REPORT_FOUND');
  const meta = await getMeta();
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title="Report a found item"
        subtitle="Thank you! Owners of matching lost reports are notified automatically by a database trigger." />
      <ItemReportForm kind="found" meta={meta} />
    </div>
  );
}
