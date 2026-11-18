import { handler, json, readJson, requirePermission, HttpError } from '@/lib/api';
import { updateDocument, deleteDocument, KINDS } from '@/lib/vectorStore';
import { syncItem } from '@/lib/itemSync';

async function parseId(context) {
  const { id } = await context.params;            // e.g. "found-7"
  const [kind, raw] = String(id).split('-');
  const itemId = Number(raw);
  if (!KINDS.includes(kind) || !Number.isInteger(itemId) || itemId <= 0) throw new HttpError(400, 'Invalid vector id.');
  return { kind, itemId };
}

// PATCH /api/vector/:id  { status }  - UPDATE metadata of a vector document
export const PATCH = handler(async (request, context) => {
  await requirePermission('VECTOR_DB_MANAGE');
  const { kind, itemId } = await parseId(context);
  const body = await readJson(request);
  await updateDocument(kind, itemId, { status: body.status });
  return json({ ok: true, message: `${kind}-${itemId} status set to ${body.status} in the vector DB.` });
});

// POST /api/vector/:id  - re-embed the document from the current MySQL row (UPDATE of the vector)
export const POST = handler(async (request, context) => {
  await requirePermission('VECTOR_DB_MANAGE');
  const { kind, itemId } = await parseId(context);
  const doc = await syncItem(kind, itemId);
  if (!doc) throw new HttpError(404, 'The MySQL row no longer exists.');
  return json({ ok: true, message: `${kind}-${itemId} re-embedded with ${doc.model}.` });
});

// DELETE /api/vector/:id  - DELETE the vector document (MySQL row is untouched)
export const DELETE = handler(async (request, context) => {
  await requirePermission('VECTOR_DB_MANAGE');
  const { kind, itemId } = await parseId(context);
  await deleteDocument(kind, itemId);
  return json({ ok: true, message: `${kind}-${itemId} deleted from the vector DB.` });
});
