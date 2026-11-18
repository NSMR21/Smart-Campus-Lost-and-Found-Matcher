import { handler, json, requireUser } from '@/lib/api';

// GET /api/auth/me  - the logged-in user with role and permissions (from the database)
export const GET = handler(async () => json(await requireUser()));
