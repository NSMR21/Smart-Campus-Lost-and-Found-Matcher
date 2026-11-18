import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/session';

// POST /api/auth/logout
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}

// GET /api/auth/logout  - used when a still-valid token belongs to a deactivated account
export async function GET(request) {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.redirect(new URL('/login?expired=1', request.url), 303);
}
