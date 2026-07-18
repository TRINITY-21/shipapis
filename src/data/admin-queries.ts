// Every D1 read/write the admin console performs, in one place.
//
// Kept out of the route file so the SQL is reviewable on its own, and out of catalog.ts because none
// of it is on the public read path — these queries run for one operator, not for site traffic, so
// they optimise for completeness over the scanned-row budget.

export interface SubmissionRow {
  id: number
  name: string
  docs_url: string | null
  endpoint_url: string | null
  auth_type: 'none' | 'apiKey' | 'oauth' | 'userAgent' | null
  submitter_email: string | null
  status: 'pending' | 'auto_validated' | 'approved' | 'rejected' | 'spam'
  validation_json: string | null
  created_at: string
  reviewed_at: string | null
  review_notes: string | null
  approved_slug: string | null
}

/** The extras the public form stashes in validation_json — all optional, all untrusted. */
export interface SubmissionMeta {
  category?: string
  base_url?: string
  sample_endpoint?: string
  notes?: string
  browser_probe?: string
  source?: string
  ip?: string
  ua?: string
}

export function parseMeta(row: Pick<SubmissionRow, 'validation_json'>): SubmissionMeta {
  if (!row.validation_json) return {}
  try {
    const v = JSON.parse(row.validation_json) as SubmissionMeta
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export interface SubscriberRow {
  id: number
  email: string
  status: 'active' | 'unsubscribed' | 'bounced'
  source: string | null
  created_at: string
}

/* ---------- submissions ---------- */

export async function countByStatus(db: D1Database): Promise<Record<string, number>> {
  const res = await db.prepare('select status, count(*) as n from submissions group by status').all<{ status: string; n: number }>()
  return Object.fromEntries((res.results ?? []).map((r) => [r.status, r.n]))
}

export async function listSubmissions(db: D1Database, status: string, limit = 100): Promise<SubmissionRow[]> {
  // 'all' is the only unfiltered path; everything else rides idx_submissions_queue(status, created_at).
  const sql =
    status === 'all'
      ? 'select * from submissions order by created_at desc limit ?'
      : 'select * from submissions where status = ? order by created_at desc limit ?'
  const stmt = status === 'all' ? db.prepare(sql).bind(limit) : db.prepare(sql).bind(status, limit)
  const res = await stmt.all<SubmissionRow>()
  return res.results ?? []
}

export async function getSubmission(db: D1Database, id: number): Promise<SubmissionRow | null> {
  return (await db.prepare('select * from submissions where id = ?').bind(id).first<SubmissionRow>()) ?? null
}

export async function setSubmissionStatus(
  db: D1Database,
  id: number,
  status: 'pending' | 'rejected' | 'spam',
  notes: string | null,
): Promise<void> {
  await db
    .prepare('update submissions set status = ?, reviewed_at = ?, review_notes = ? where id = ?')
    .bind(status, new Date().toISOString(), notes, id)
    .run()
}

/* ---------- approval → a real catalog row ---------- */

export interface ApprovalInput {
  slug: string
  name: string
  emoji: string
  tagline: string
  description: string
  categorySlug: string
  docsUrl: string
  baseUrl: string
  sampleEndpoint: string
  auth: 'none' | 'apiKey' | 'oauth' | 'userAgent'
  checkTier: 'endpoint' | 'reachability' | 'docs' | 'listed'
  freeTier: string
  rateLimit: string
  commercialUse: 'yes' | 'no' | 'unclear'
  dataLicense: string
  requiresCard: boolean
  notes: string | null
}

/** URL-safe slug from a display name; the console pre-fills it and the operator can override. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function slugTaken(db: D1Database, slug: string): Promise<boolean> {
  const hit = await db.prepare('select 1 as x from apis where slug = ?').bind(slug).first<{ x: number }>()
  return !!hit
}

/**
 * Turn a submission into a live catalog row.
 *
 * Writes `apis` + one monitored `endpoints` row and flips the submission to approved. D1 has no
 * interactive transactions, so this goes through `batch()` — the statements land atomically, which
 * matters because a half-approval (api row with no endpoint) would enter the checker's queue with
 * nothing to probe.
 *
 * status starts at 'unmonitored' and health_score stays NULL: the API is listed immediately but
 * claims no health it hasn't earned. The next checker sweep picks it up via check_tier and the
 * rollup fills in a real score.
 */
export async function approveSubmission(
  db: D1Database,
  submissionId: number,
  input: ApprovalInput,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const cat = await db.prepare('select id from categories where slug = ?').bind(input.categorySlug).first<{ id: number }>()
  if (!cat) return { ok: false, error: `Unknown category "${input.categorySlug}".` }
  if (await slugTaken(db, input.slug)) return { ok: false, error: `Slug "${input.slug}" is already in the catalog.` }

  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const base = input.baseUrl.replace(/\/+$/, '')
  const path = input.sampleEndpoint.startsWith('/') ? input.sampleEndpoint : `/${input.sampleEndpoint}`
  const endpointUrl = `${base}${path}`

  const insertApi = db
    .prepare(
      `insert into apis (slug, name, emoji, tagline, description_md, category_id, docs_url, base_url,
                         auth_type, check_tier, https, free_tier_notes, rate_limit_notes, requires_card,
                         commercial_use, data_license, status, added_at, origin)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unmonitored', ?, 'submission')`,
    )
    .bind(
      input.slug,
      input.name,
      input.emoji,
      input.tagline,
      input.description,
      cat.id,
      input.docsUrl || null,
      base || null,
      input.auth,
      input.checkTier,
      base.startsWith('https://') ? 1 : 0,
      input.freeTier || null,
      input.rateLimit || null,
      input.requiresCard ? 1 : 0,
      input.commercialUse,
      input.dataLicense || null,
      today,
    )
  // last_insert_rowid() resolves inside the same batch, so the endpoint binds to the api just created.
  const insertEndpoint = db
    .prepare(
      `insert into endpoints (api_id, method, url_template, description, active)
       values (last_insert_rowid(), 'GET', ?, ?, 1)`,
    )
    .bind(endpointUrl, input.tagline || `${input.name} — sample route.`)
  const markApproved = db
    .prepare("update submissions set status = 'approved', reviewed_at = ?, review_notes = ?, approved_slug = ? where id = ?")
    .bind(now, input.notes, input.slug, submissionId)

  try {
    await db.batch([insertApi, insertEndpoint, markApproved])
  } catch (e) {
    return { ok: false, error: `Database rejected the write: ${(e as Error).message}` }
  }
  return { ok: true, slug: input.slug }
}

/** APIs that entered the catalog through this console (not the seed import). */
export async function listApprovedApis(db: D1Database, limit = 200) {
  const res = await db
    .prepare(
      `select a.slug, a.name, a.emoji, a.status, a.health_score, a.added_at, a.monitored_since,
              a.last_checked_at, c.name as category
       from apis a join categories c on c.id = a.category_id
       where a.origin = 'submission' order by a.added_at desc, a.id desc limit ?`,
    )
    .bind(limit)
    .all<{
      slug: string
      name: string
      emoji: string
      status: string
      health_score: number | null
      added_at: string
      monitored_since: string | null
      last_checked_at: string | null
      category: string
    }>()
  return res.results ?? []
}

/* ---------- subscribers ---------- */

export async function subscriberStats(db: D1Database) {
  const byStatus = await db
    .prepare('select status, count(*) as n from subscribers group by status')
    .all<{ status: string; n: number }>()
  const counts = Object.fromEntries((byStatus.results ?? []).map((r) => [r.status, r.n]))
  const recent = await db
    .prepare("select count(*) as n from subscribers where created_at >= ?")
    .bind(new Date(Date.now() - 30 * 86_400_000).toISOString())
    .first<{ n: number }>()
  return {
    active: counts.active ?? 0,
    unsubscribed: counts.unsubscribed ?? 0,
    bounced: counts.bounced ?? 0,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    last30: recent?.n ?? 0,
  }
}

export async function listSubscribers(
  db: D1Database,
  opts: { status?: string; q?: string; limit?: number } = {},
): Promise<SubscriberRow[]> {
  const { status = 'all', q = '', limit = 500 } = opts
  const where: string[] = []
  const binds: unknown[] = []
  if (status !== 'all') {
    where.push('status = ?')
    binds.push(status)
  }
  if (q) {
    where.push('email like ?')
    binds.push(`%${q}%`)
  }
  const sql = `select id, email, status, source, created_at from subscribers
               ${where.length ? `where ${where.join(' and ')}` : ''}
               order by created_at desc limit ?`
  binds.push(limit)
  const res = await db.prepare(sql).bind(...binds).all<SubscriberRow>()
  return res.results ?? []
}

/* ---------- audit ---------- */

export async function audit(
  db: D1Database,
  action: string,
  subject: string | null,
  detail: string | null,
  ip: string | null,
): Promise<void> {
  try {
    await db
      .prepare('insert into admin_audit (action, subject, detail, ip, created_at) values (?, ?, ?, ?, ?)')
      .bind(action, subject, detail, ip, new Date().toISOString())
      .run()
  } catch {
    /* auditing must never break the action it records */
  }
}

export async function recentAudit(db: D1Database, limit = 12) {
  try {
    const res = await db
      .prepare('select action, subject, detail, created_at from admin_audit order by created_at desc limit ?')
      .bind(limit)
      .all<{ action: string; subject: string | null; detail: string | null; created_at: string }>()
    return res.results ?? []
  } catch {
    return []
  }
}
