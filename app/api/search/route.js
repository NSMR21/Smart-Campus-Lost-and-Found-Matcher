import { handler, json, requireUser, HttpError } from '@/lib/api';
import { semanticSearch } from '@/lib/search';

// GET /api/search?q=black leather wallet&kind=found   - semantic (vector) search
export const GET = handler(async (request) => {
  await requireUser();
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim();
  const kind = params.get('kind') === 'lost' ? 'lost' : 'found';
  if (q.length < 3) throw new HttpError(400, 'Type at least 3 characters.');
  return json(await semanticSearch(q.slice(0, 300), kind));
});
