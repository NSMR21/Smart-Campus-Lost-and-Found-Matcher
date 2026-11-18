// Helpers shared by the REST route handlers in app/api/**.
import { getSession } from './auth.js';
import { queryOne, dbErrorMessage } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Please log in first.');
  return session;
}

/** Authorisation is decided by the database function fn_has_permission(). */
export async function requirePermission(permission) {
  const session = await requireUser();
  const row = await queryOne('SELECT fn_has_permission(?, ?) AS allowed', [session.userId, permission]);
  if (!row?.allowed) throw new HttpError(403, `Permission denied: ${permission}`);
  return session;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

/** Wraps a route handler: maps HttpError / MySQL errors to JSON responses. */
export function handler(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      const message = dbErrorMessage(err);
      if (message) return json({ error: message }, 400);
      console.error(err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  };
}

export async function routeId(context) {
  const { id } = await context.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Invalid id.');
  return n;
}
