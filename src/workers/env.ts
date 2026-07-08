/** Cloudflare Worker bindings — extend here when new resources are added. */
export interface Env {
  DB: D1Database
  /** Public Turnstile sitekey (wrangler.jsonc vars). Rendered into the /submit widget. */
  TURNSTILE_SITEKEY?: string
  /** Turnstile secret (encrypted secret store). When unset, submit skips verification (local/tests). */
  TURNSTILE_SECRET_KEY?: string
  /** Public GA4 measurement ID (G-…). When unset, no analytics tag is emitted. */
  GA_MEASUREMENT_ID?: string
}
