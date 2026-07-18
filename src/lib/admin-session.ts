// Admin session tokens — HMAC-signed, stateless, no session table.
//
// A token is `<expiry-ms>.<base64url hmac>`; the HMAC covers the expiry with a key derived from
// ADMIN_PASSWORD. Deriving from the password (rather than a second secret) means rotating the
// password instantly invalidates every outstanding session, which is the behaviour you want from a
// single-operator console. Nothing secret is stored in the cookie — it carries no identity beyond
// "whoever held the password before <expiry>".

const enc = new TextEncoder()

/** Sessions last a working day; re-auth is one password paste, so there's no reason to stretch it. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
export const SESSION_COOKIE = 'shipapis_admin'

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function key(password: string): Promise<CryptoKey> {
  // Domain-separated so the derived key can never collide with another HMAC use of the same secret.
  const material = await crypto.subtle.digest('SHA-256', enc.encode(`shipapis-admin-session-v1:${password}`))
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function sign(password: string, payload: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await key(password), enc.encode(payload)))
}

/**
 * Constant-time string equality. `===` on secrets leaks length and first-difference position through
 * timing; this always walks the full longer string.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/** Mint a session token valid for SESSION_TTL_MS. */
export async function issueSession(password: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS)
  return `${exp}.${await sign(password, exp)}`
}

/** True when `token` carries a valid, unexpired signature for `password`. */
export async function verifySession(password: string, token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const exp = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expMs = Number(exp)
  // Check the signature even when expired — bailing early on the timestamp turns expiry into a
  // free oracle for probing token structure.
  const ok = timingSafeEqual(mac, await sign(password, exp))
  return ok && Number.isFinite(expMs) && expMs > now
}

/** Serialize the session cookie. `secure` is off only for plain-http local dev, where it'd be dropped. */
export function sessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    // Strict: the console has no cross-site entry points, and it blocks CSRF on the POST actions.
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Read one cookie value out of a raw Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}
