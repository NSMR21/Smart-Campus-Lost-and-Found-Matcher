import { requirePageSession } from '@/lib/auth';
import { loadQueryFiles } from '@/lib/sqlLab';
import SqlLab from '@/components/SqlLab';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'SQL Lab - Campus Lost & Found' };

export default async function SqlLabPage() {
  await requirePageSession('SQL_LAB_VIEW');
  const files = await loadQueryFiles();
  const total = files.reduce((n, f) => n + f.blocks.length, 0);
  return (
    <>
      <PageHeader title="SQL Lab"
        subtitle={`${total} annotated queries from db/queries - joins, nested & correlated sub-queries, recursive CTEs, window functions, DML, triggers and transactions, run live against MySQL.`} />
      <SqlLab files={files} />
    </>
  );
}
