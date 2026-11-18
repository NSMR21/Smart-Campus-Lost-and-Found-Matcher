// JWT session token helpers. Kept free of Node-only imports so that
// proxy.js (route protection) can use them too.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'lf_session';
export const SESSION_HOURS = 8;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set in .env.local (at least 32 characters)');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user) {
  return new SignJWT({ uid: user.user_id, name: user.full_name, role: user.role_name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,                       // not readable from JavaScript
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  };
}
