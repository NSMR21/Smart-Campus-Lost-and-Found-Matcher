import { handler, json, requireUser } from '@/lib/api';
import { getMeta } from '@/lib/data';

// GET /api/meta  - categories (tree), locations, buildings, departments, colours
export const GET = handler(async () => {
  await requireUser();
  return json(await getMeta());
});
