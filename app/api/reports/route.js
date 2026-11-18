import { handler, json, requirePermission } from '@/lib/api';
import { getReports } from '@/lib/data';

// GET /api/reports  - KPIs, category stats, hotspots, monthly trend, leaderboard...
export const GET = handler(async () => {
  await requirePermission('REPORTS_VIEW');
  return json(await getReports());
});
