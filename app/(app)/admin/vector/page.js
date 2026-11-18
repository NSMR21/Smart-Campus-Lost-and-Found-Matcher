import { requirePageSession } from '@/lib/auth';
import VectorConsole from '@/components/admin/VectorConsole';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Vector database - Campus Lost & Found' };

export default async function VectorPage() {
  await requirePageSession('VECTOR_DB_MANAGE');
  return (
    <>
      <PageHeader title="Vector database (LanceDB)"
        subtitle="Every lost and found report is stored as a 384-dimensional embedding of its text. Create, read, update and delete the documents here." />
      <VectorConsole />
    </>
  );
}
