// The operator console. Every route here is behind requireAdmin (except /admin/login) and every
// response is no-store + noindex via adminHygiene.
//
// Actions are plain HTML form POSTs, not fetch/JSON: no client JS is required to run the site's
// most consequential mutations, and SameSite=Strict on the session cookie makes the forms
// CSRF-resistant without a token dance.

import type { Hono } from 'hono'
import {
    approveSubmission,
    audit,
    countByStatus,
    getSubmission,
    listApprovedApis,
    listSubmissions,
    listSubscribers,
    recentAudit,
    setSubmissionStatus,
    subscriberStats,
} from '../data/admin-queries'
import { catalogCounts, invalidateCatalogMemo } from '../data/catalog'
import { categoryBySlug } from '../data/seed'
import { clearCookie, issueSession, sessionCookie, timingSafeEqual } from '../lib/admin-session'
import { sendSubmissionApproved } from '../lib/submission-email'
import { adminHygiene, clearFailures, notHere, recordFailure, requireAdmin, throttleCheck } from '../middleware/admin-auth'
import { AdminCatalog } from '../ui/pages/admin/AdminCatalog'
import { AdminLogin } from '../ui/pages/admin/AdminLogin'
import { AdminOverview } from '../ui/pages/admin/AdminOverview'
import { AdminReview } from '../ui/pages/admin/AdminReview'
import { AdminSubmissions } from '../ui/pages/admin/AdminSubmissions'
import { AdminSubscribers } from '../ui/pages/admin/AdminSubscribers'
import type { Env } from '../workers/env'

const AUTH_TYPES = ['none', 'apiKey', 'oauth', 'userAgent'] as const
const CHECK_TIERS = ['endpoint', 'reachability', 'docs', 'listed'] as const
const COMMERCIAL = ['yes', 'no', 'unclear'] as const

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = <T extends string>(v: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(v) ? (v as T) : fallback

/**
 * Whether to mark the session cookie Secure.
 *
 * Must NOT be derived from the request URL: `wrangler dev` rewrites the host (and scheme) to the
 * custom domain, so c.req.url reads https:// while the browser is really on http://localhost — the
 * cookie then gets Secure, the browser silently drops it, and every login appears to "succeed" then
 * bounce straight back to the login page. LOCAL_DEV is the only reliable local-dev signal here,
 * same as the analytics gate. Production has no LOCAL_DEV, so it always gets Secure.
 */
const wantsSecureCookie = (env: Env) => env.LOCAL_DEV !== '1'
const clientIp = (h: string | undefined) => h ?? 'unknown'

/** A redirect that carries a one-shot message. Simplest honest flash: it's in the URL, not a store. */
const flashTo = (path: string, kind: 'ok' | 'bad', message: string) =>
  `${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message)}`

export function registerAdmin(app: Hono<{ Bindings: Env }>) {
  app.use('/admin', adminHygiene)
  app.use('/admin/*', adminHygiene)

  /* ---------- auth ---------- */

  // An unconfigured deployment 404s here exactly as it does everywhere else under /admin — the
  // login page must not be the thing that reveals the console exists.
  app.get('/admin/login', (c) => {
    if (!c.env.ADMIN_PASSWORD) return notHere(c)
    const next = c.req.query('next')
    return c.html(<AdminLogin error={c.req.query('error')} next={next} />)
  })

  app.post('/admin/login', async (c) => {
    const password = c.env.ADMIN_PASSWORD
    if (!password) return notHere(c)

    const ip = clientIp(c.req.header('CF-Connecting-IP'))
    const gate = throttleCheck(ip)
    if (!gate.allowed) {
      return c.html(<AdminLogin error={`Too many attempts. Try again in ${gate.retryInMin} minute(s).`} />, 429)
    }

    const form = await c.req.formData()
    const supplied = str(form.get('password'), 400)
    const next = str(form.get('next'), 200)

    if (!timingSafeEqual(supplied, password)) {
      recordFailure(ip)
      if (c.env.DB) await audit(c.env.DB, 'login_failed', null, 'bad password', ip)
      // Deliberately vague: a precise error is a hint for whoever is guessing.
      return c.html(<AdminLogin error="Incorrect password." next={next || undefined} />, 401)
    }

    clearFailures(ip)
    if (c.env.DB) await audit(c.env.DB, 'login', null, 'console sign-in', ip)
    const token = await issueSession(password)
    c.header('Set-Cookie', sessionCookie(token, wantsSecureCookie(c.env)))
    // Only same-origin absolute paths — an open redirect on the admin login is a phishing gift.
    const dest = next.startsWith('/admin') ? next : '/admin'
    return c.redirect(dest, 302)
  })

  app.post('/admin/logout', (c) => {
    c.header('Set-Cookie', clearCookie(wantsSecureCookie(c.env)))
    return c.redirect('/admin/login', 302)
  })

  /* ---------- everything below requires a session ---------- */

  app.use('/admin', requireAdmin)
  app.use('/admin/submissions', requireAdmin)
  app.use('/admin/submissions/*', requireAdmin)
  app.use('/admin/subscribers', requireAdmin)
  app.use('/admin/subscribers.csv', requireAdmin)
  app.use('/admin/catalog', requireAdmin)

  const noDb = (c: { text: (t: string, s: 503) => Response }) =>
    c.text('No database binding on this deployment — the console needs D1.', 503)

  app.get('/admin', async (c) => {
    if (!c.env.DB) return noDb(c)
    const [submissions, subs, approved, log] = await Promise.all([
      countByStatus(c.env.DB),
      subscriberStats(c.env.DB),
      listApprovedApis(c.env.DB, 1000),
      recentAudit(c.env.DB, 12),
    ])
    const counts = catalogCounts()
    return c.html(
      <AdminOverview
        data={{
          submissions,
          subscribers: subs,
          catalog: { total: counts.total, monitored: counts.monitored, approvedHere: approved.length },
          audit: log,
          now: Date.now(),
        }}
      />,
    )
  })

  app.get('/admin/submissions', async (c) => {
    if (!c.env.DB) return noDb(c)
    const status = c.req.query('status') ?? 'pending'
    const [rows, counts] = await Promise.all([listSubmissions(c.env.DB, status, 200), countByStatus(c.env.DB)])
    const ok = c.req.query('ok')
    const bad = c.req.query('bad')
    return c.html(
      <AdminSubmissions
        rows={rows}
        counts={counts}
        status={status}
        now={Date.now()}
        flash={ok ? { kind: 'ok', message: ok } : bad ? { kind: 'bad', message: bad } : undefined}
      />,
    )
  })

  app.get('/admin/submissions/:id', async (c) => {
    if (!c.env.DB) return noDb(c)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.text('Bad submission id.', 400)
    const row = await getSubmission(c.env.DB, id)
    if (!row) return c.text('No such submission.', 404)
    return c.html(<AdminReview row={row} now={Date.now()} error={c.req.query('error')} />)
  })

  app.post('/admin/submissions/:id/approve', async (c) => {
    if (!c.env.DB) return noDb(c)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.text('Bad submission id.', 400)
    const row = await getSubmission(c.env.DB, id)
    if (!row) return c.text('No such submission.', 404)

    const form = await c.req.formData()
    const draft: Record<string, string> = {}
    for (const [k, val] of form.entries()) if (typeof val === 'string') draft[k] = val

    const input = {
      slug: str(form.get('slug'), 60).toLowerCase(),
      name: str(form.get('name'), 120),
      emoji: str(form.get('emoji'), 8) || '🔌',
      tagline: str(form.get('tagline'), 160),
      description: str(form.get('description'), 4000),
      categorySlug: str(form.get('category'), 60),
      docsUrl: str(form.get('docs_url'), 500),
      baseUrl: str(form.get('base_url'), 500),
      sampleEndpoint: str(form.get('sample_endpoint'), 500),
      auth: oneOf(str(form.get('auth'), 20), AUTH_TYPES, 'none'),
      checkTier: oneOf(str(form.get('check_tier'), 20), CHECK_TIERS, 'endpoint'),
      freeTier: str(form.get('free_tier'), 300),
      rateLimit: str(form.get('rate_limit'), 300),
      commercialUse: oneOf(str(form.get('commercial_use'), 20), COMMERCIAL, 'unclear'),
      dataLicense: str(form.get('data_license'), 200),
      requiresCard: form.get('requires_card') === '1',
      notes: str(form.get('notes'), 500) || null,
    }

    const problems: string[] = []
    if (!/^[a-z0-9][a-z0-9-]*$/.test(input.slug)) problems.push('slug must be lowercase letters, digits and hyphens')
    if (input.name.length < 2) problems.push('name is required')
    if (!input.tagline) problems.push('tagline is required')
    if (input.description.length < 20) problems.push('description needs at least 20 characters of original prose')
    if (!categoryBySlug.has(input.categorySlug)) problems.push('pick a real category')
    if (!/^https:\/\//.test(input.baseUrl)) problems.push('base URL must be https')
    if (!input.sampleEndpoint) problems.push('sample endpoint is required')
    if (problems.length) {
      return c.html(<AdminReview row={row} now={Date.now()} error={`Fix: ${problems.join(' · ')}.`} draft={draft} />, 400)
    }

    const res = await approveSubmission(c.env.DB, id, input)
    const ip = clientIp(c.req.header('CF-Connecting-IP'))
    if (!res.ok) {
      await audit(c.env.DB, 'approve_failed', String(id), res.error, ip)
      return c.html(<AdminReview row={row} now={Date.now()} error={res.error} draft={draft} />, 400)
    }
    await audit(c.env.DB, 'approve', res.slug, `submission #${id} → /api/${res.slug}`, ip)

    // The new API must be visible immediately — the operator's next click is "View live".
    invalidateCatalogMemo()

    // Tell the submitter it's live, if they left an address. Best-effort: the API is already
    // published, so a mail failure must not turn a successful approval into an error.
    let mailed = false
    if (row.submitter_email) {
      const cat = categoryBySlug.get(input.categorySlug)
      mailed = await sendSubmissionApproved(c.env, row.submitter_email, {
        name: input.name,
        slug: res.slug,
        category: cat?.name ?? input.categorySlug,
      })
      await audit(c.env.DB, mailed ? 'email_sent' : 'email_skipped', row.submitter_email, `approval notice for ${res.slug}`, ip)
    }

    const mailNote = row.submitter_email
      ? mailed
        ? ` Emailed ${row.submitter_email}.`
        : ` Could not email ${row.submitter_email} — check RESEND_API_KEY.`
      : ''
    return c.redirect(
      flashTo(
        '/admin/submissions',
        'ok',
        `Approved "${input.name}" — live at /api/${res.slug}. It enters the probe queue on the next sweep.${mailNote}`,
      ),
      302,
    )
  })

  app.post('/admin/submissions/:id/reject', async (c) => {
    if (!c.env.DB) return noDb(c)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id)) return c.text('Bad submission id.', 400)
    const form = await c.req.formData()
    const verdict = str(form.get('verdict'), 20) === 'spam' ? 'spam' : 'rejected'
    const notes = str(form.get('notes'), 500) || null
    await setSubmissionStatus(c.env.DB, id, verdict, notes)
    await audit(c.env.DB, verdict, String(id), notes, clientIp(c.req.header('CF-Connecting-IP')))
    return c.redirect(flashTo('/admin/submissions', 'ok', `Submission #${id} marked ${verdict}.`), 302)
  })

  /* ---------- subscribers ---------- */

  const SUBSCRIBER_PAGE = 500

  app.get('/admin/subscribers', async (c) => {
    if (!c.env.DB) return noDb(c)
    const status = c.req.query('status') ?? 'active'
    const q = (c.req.query('q') ?? '').slice(0, 120)
    const [rows, stats] = await Promise.all([
      listSubscribers(c.env.DB, { status, q, limit: SUBSCRIBER_PAGE }),
      subscriberStats(c.env.DB),
    ])
    return c.html(
      <AdminSubscribers
        rows={rows}
        stats={stats}
        status={status}
        q={q}
        now={Date.now()}
        truncated={rows.length === SUBSCRIBER_PAGE}
      />,
    )
  })

  app.get('/admin/subscribers.csv', async (c) => {
    if (!c.env.DB) return noDb(c)
    const status = c.req.query('status') ?? 'active'
    const q = (c.req.query('q') ?? '').slice(0, 120)
    // No limit here — the export is the "give me everything" path the paged table deliberately isn't.
    const rows = await listSubscribers(c.env.DB, { status, q, limit: 100_000 })
    // Excel treats a leading =, +, - or @ as a formula; prefixing with ' neutralises CSV injection.
    const cell = (v: string | null) => {
      const s = (v ?? '').replace(/"/g, '""')
      return `"${/^[=+\-@]/.test(s) ? `'${s}` : s}"`
    }
    const csv = [
      'email,status,source,created_at',
      ...rows.map((r) => [cell(r.email), cell(r.status), cell(r.source), cell(r.created_at)].join(',')),
    ].join('\n')
    await audit(c.env.DB, 'export', 'subscribers', `${rows.length} rows (${status})`, clientIp(c.req.header('CF-Connecting-IP')))
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shipapis-subscribers-${status}.csv"`,
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
    })
  })

  app.get('/admin/catalog', async (c) => {
    if (!c.env.DB) return noDb(c)
    const rows = await listApprovedApis(c.env.DB, 500)
    return c.html(<AdminCatalog rows={rows} now={Date.now()} />)
  })
}
