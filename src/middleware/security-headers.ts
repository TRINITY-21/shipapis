import type { MiddlewareHandler } from 'hono'

/** Baseline browser security headers on every HTML/SSR response. Machine JSON surfaces keep
 *  machineHeaders (CORS) and don't need frame/referrer policies the same way. */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  const h = c.res.headers
  if (!h.has('X-Content-Type-Options')) h.set('X-Content-Type-Options', 'nosniff')
  if (!h.has('Referrer-Policy')) h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'SAMEORIGIN')
  if (!h.has('Permissions-Policy')) {
    h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  }
  // HSTS: only meaningful on HTTPS (production). CF can also enforce this at the zone level —
  // set both so origin responses carry the signal even on cache misses.
  if (!h.has('Strict-Transport-Security')) {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
}
