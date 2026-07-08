import type { Hono } from 'hono'
import type { Env } from '../workers/env'

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Newsletter capture ("the signal"). Stores the address in D1; sending goes out later via Email
// Sending / a provider (Email Routing is inbound-only). Idempotent: a repeat subscribe re-activates.
export function registerSubscribe(app: Hono<{ Bindings: Env }>) {
  app.post('/subscribe', async (c) => {
    let payload: Record<string, unknown>
    try {
      payload = await c.req.json()
    } catch {
      return c.json({ ok: false, error: 'Expected a JSON body.' }, 400)
    }

    // Honeypot — filled means a bot; accept silently so it doesn't learn it was caught.
    if (clip(payload.company, 200)) return c.json({ ok: true, status: 'received' })

    const email = clip(payload.email, 200).toLowerCase()
    if (!EMAIL_RE.test(email)) return c.json({ ok: false, error: "That email doesn't look right." }, 400)

    if (!c.env.DB) return c.json({ ok: false, error: 'Subscriptions are temporarily unavailable.' }, 503)

    const source = clip(payload.source, 40) || 'footer'
    try {
      await c.env.DB.prepare(
        `insert into subscribers (email, status, source, created_at) values (?, 'active', ?, ?)
         on conflict(email) do update set status = 'active'`,
      )
        .bind(email, source, new Date().toISOString())
        .run()
    } catch {
      return c.json({ ok: false, error: "Couldn't save that — please try again." }, 500)
    }

    return c.json({ ok: true, status: 'subscribed', message: "You're on the list — occasional signal, no spam." })
  })
}
