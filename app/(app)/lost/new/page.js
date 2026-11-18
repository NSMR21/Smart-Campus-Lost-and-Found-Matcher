import { requirePageSession } from '@/lib/auth';
import { getMeta } from '@/lib/data';
import ItemReportForm from '@/components/ItemReportForm';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Report lost item - Campus Lost & Found' };

export default async function NewLostPage() {
  await requirePageSession('REPORT_LOST');
  const meta = await getMeta();
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title="Report a lost item"
        subtitle="We immediately compare your report with every unclaimed found item and notify you of matches." />
      <ItemReportForm kind="lost" meta={meta} />
    </div>
  );
}
