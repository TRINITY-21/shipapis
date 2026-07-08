import type { Context, Hono } from 'hono'
import { resendAddContact, resendSendWelcome, resendUnsubscribeContact } from '../lib/resend'
import type { Env } from '../workers/env'

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const unsubPage = (kind: 'ok' | 'bad') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${kind === 'ok' ? 'Unsubscribed' : 'Link invalid'} · shipapis</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#0b0c0f;color:#edeef0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px;line-height:1.6}a{color:#a3e635}h1{font-size:20px;margin:0 0 10px}p{color:#b8bcc4;max-width:420px}</style></head><body><div>${
    kind === 'ok'
      ? "<h1>You're unsubscribed.</h1><p>You won't get the signal anymore — no hard feelings. The directory is always at <a href='https://shipapis.dev'>shipapis.dev</a>.</p>"
      : "<h1>That link didn't work.</h1><p>The unsubscribe link looks invalid or expired. Email <a href='mailto:hello@shipapis.dev'>hello@shipapis.dev</a> and we'll sort it.</p>"
  }</div></body></html>`

// Newsletter capture ("the signal"). D1 is the source of truth; Resend mirrors the list for
// broadcasts and sends the welcome. Email is unique so a repeat subscribe is idempotent (re-activates).
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
    const nowIso = new Date().toISOString()
    const token = crypto.randomUUID()
    let row: { unsub_token: string; created_at: string } | null
    try {
      row = await c.env.DB.prepare(
        `insert into subscribers (email, status, source, unsub_token, created_at) values (?, 'active', ?, ?, ?)
         on conflict(email) do update set status = 'active'
         returning unsub_token, created_at`,
      )
        .bind(email, source, token, nowIso)
        .first<{ unsub_token: string; created_at: string }>()
    } catch {
      return c.json({ ok: false, error: "Couldn't save that — please try again." }, 500)
    }

    // Off the response path: sync to the Resend audience (for broadcasts), and send a welcome only
    // for a brand-new row (created_at is the timestamp we just inserted) — no duplicate on re-subscribe.
    if (c.env.RESEND_API_KEY && row) {
      const isNew = row.created_at === nowIso
      const unsubToken = row.unsub_token
      c.executionCtx.waitUntil(
        (async () => {
          await resendAddContact(c.env, email)
          if (isNew) await resendSendWelcome(c.env, email, unsubToken)
        })(),
      )
    }

    return c.json({ ok: true, status: 'subscribed', message: "You're on the list — occasional signal, no spam." })
  })

  // Unsubscribe. GET = a human clicking the link (shows a page); POST = RFC 8058 one-click from the
  // mail client's List-Unsubscribe header. Both verify the per-subscriber token before deactivating.
  const unsubscribe = async (c: Context<{ Bindings: Env }>) => {
    const email = clip(c.req.query('e'), 200).toLowerCase()
    const token = clip(c.req.query('t'), 100)
    if (!email || !token || !c.env.DB) return { ok: false as const }
    const row = await c.env.DB.prepare('select unsub_token from subscribers where email = ?')
      .bind(email)
      .first<{ unsub_token: string }>()
    if (!row || !row.unsub_token || row.unsub_token !== token) return { ok: false as const }
    await c.env.DB.prepare("update subscribers set status = 'unsubscribed' where email = ?").bind(email).run()
    if (c.env.RESEND_API_KEY) c.executionCtx.waitUntil(resendUnsubscribeContact(c.env, email))
    return { ok: true as const }
  }

  app.get('/unsubscribe', async (c) => {
    const { ok } = await unsubscribe(c)
    return c.html(unsubPage(ok ? 'ok' : 'bad'), ok ? 200 : 400)
  })
  app.post('/unsubscribe', async (c) => {
    const { ok } = await unsubscribe(c)
    return c.body(null, ok ? 200 : 400) // one-click clients ignore the body
  })
}
