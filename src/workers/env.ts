/** Cloudflare Worker bindings — extend here when new resources are added. */
export interface Env {
  DB: D1Database
  /** Public Turnstile sitekey (wrangler.jsonc vars). Rendered into the /submit widget. */
  TURNSTILE_SITEKEY?: string
  /** Turnstile secret (encrypted secret store). When unset, submit skips verification (local/tests). */
  TURNSTILE_SECRET_KEY?: string
  /** Public GA4 measurement ID (G-…). When unset, no analytics tag is emitted. */
  GA_MEASUREMENT_ID?: string
  /** Resend API key (secret). When unset, subscribe/unsubscribe skip the email side (local/tests). */
  RESEND_API_KEY?: string
  /** Resend audience id (var) — the "signal" broadcast list; contacts are synced here on subscribe. */
  RESEND_AUDIENCE_ID?: string
  /** Set to "1" in .dev.vars only. `wrangler dev` presents the custom-domain host locally, so this
   *  flag is the only reliable signal that we're in local dev — it suppresses the analytics tags. */
  LOCAL_DEV?: string
  /** Admin console password (encrypted secret). UNSET → /admin fails closed with 503, never open. */
  ADMIN_PASSWORD?: string
}
