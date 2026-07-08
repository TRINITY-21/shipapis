import type { Hono } from 'hono'
import { categoryBySlug } from '../data/seed'
import type { Env } from '../workers/env'

const AUTH_TYPES = ['none', 'apiKey', 'oauth', 'userAgent'] as const
const TURNSTILE_VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isHttps = (v: string) => {
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

/** Verify a Turnstile token server-side. No secret configured (local/tests) → treated as pass. */
async function turnstileOk(secret: string | undefined, token: string, ip: string | null): Promise<boolean> {
  if (!secret) return true // dev/test: no secret bound → skip the network round-trip
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetch(TURNSTILE_VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false // if we can't reach the verifier, fail closed rather than let bots through
  }
}

export function registerSubmit(app: Hono<{ Bindings: Env }>) {
  app.post('/submit', async (c) => {
    let payload: Record<string, unknown>
    try {
      payload = await c.req.json()
    } catch {
      return c.json({ ok: false, error: 'Expected a JSON body.' }, 400)
    }

    // Honeypot: a hidden field real users never see. If it's filled, silently accept and drop —
    // a bot shouldn't learn it was caught.
    if (clip(payload.company, 200)) return c.json({ ok: true, status: 'received' })

    // Bot gate before any validation detail leaks or the DB is touched.
    const token = clip(payload['cf-turnstile-response'] ?? payload.turnstile, 4000)
    const ip = c.req.header('CF-Connecting-IP') ?? null
    if (!(await turnstileOk(c.env.TURNSTILE_SECRET_KEY, token, ip))) {
      return c.json({ ok: false, error: 'Bot check failed — please retry the challenge.' }, 403)
    }

    // Validation (all before the DB write, so tests can exercise it without a binding).
    const name = clip(payload.name, 120)
    const baseUrl = clip(payload.base_url, 500)
    const sampleEndpoint = clip(payload.sample_endpoint, 500)
    const docsUrl = clip(payload.docs_url, 500)
    const category = clip(payload.category, 60)
    const authRaw = clip(payload.auth, 20)
    const auth = (AUTH_TYPES as readonly string[]).includes(authRaw) ? authRaw : 'none'
    const email = clip(payload.email, 200)
    const notes = clip(payload.notes, 1000)
    const browserProbe = clip(payload.browser_probe, 200)

    const errors: string[] = []
    if (name.length < 2) errors.push('name')
    if (!isHttps(baseUrl)) errors.push('base_url (https required)')
    if (!sampleEndpoint) errors.push('sample_endpoint')
    if (!isHttps(docsUrl)) errors.push('docs_url (https required)')
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email')
    if (errors.length) return c.json({ ok: false, error: `Check these fields: ${errors.join(', ')}.` }, 400)

    if (!c.env.DB) return c.json({ ok: false, error: 'Submissions are temporarily unavailable.' }, 503)

    const endpointUrl = `${baseUrl.replace(/\/+$/, '')}${sampleEndpoint.startsWith('/') ? '' : '/'}${sampleEndpoint}`
    const validation = JSON.stringify({
      category: categoryBySlug.has(category) ? category : `?${category}`,
      base_url: baseUrl,
      sample_endpoint: sampleEndpoint,
      notes: notes || undefined,
      browser_probe: browserProbe || undefined,
      source: 'web-form',
      ip: ip || undefined,
      ua: c.req.header('User-Agent')?.slice(0, 300),
    })

    try {
      await c.env.DB.prepare(
        `insert into submissions (name, docs_url, endpoint_url, auth_type, submitter_email, status, validation_json, created_at)
         values (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
        .bind(name, docsUrl, endpointUrl, auth, email || null, validation, new Date().toISOString())
        .run()
    } catch {
      return c.json({ ok: false, error: "Couldn't save your submission — please try again." }, 500)
    }

    return c.json({ ok: true, status: 'queued', message: 'Submitted — it enters the review queue and is re-verified before listing.' })
  })
}
