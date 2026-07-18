import type { FC } from 'hono/jsx'
import { parseMeta, slugify, type SubmissionRow } from '../../../data/admin-queries'
import { categories } from '../../../data/seed'
import { AdminLayout } from '../../layout/AdminLayout'
import { Card, Chip, When } from './parts'

const AUTH: ReadonlyArray<[string, string]> = [
  ['none', 'None — keyless'],
  ['apiKey', 'API key'],
  ['oauth', 'OAuth'],
  ['userAgent', 'User-Agent required'],
]

const TIERS: ReadonlyArray<[string, string]> = [
  ['endpoint', 'endpoint — probe the sample route for 2xx JSON'],
  ['reachability', 'reachability — auth wall expected, 401 counts as up'],
  ['docs', 'docs — check the docs page only'],
  ['listed', 'listed — no probing at all'],
]

/**
 * The approve form. A submission carries only name/docs/endpoint/auth/email, but a catalog row needs
 * a slug, category, tagline and original description — so approval is a review step, not a button.
 * Everything here is pre-filled where the submission allows and blank where it honestly can't.
 */
export const AdminReview: FC<{
  row: SubmissionRow
  now: number
  error?: string
  /** Operator's in-progress values, echoed back when a submit is rejected so nothing is retyped. */
  draft?: Record<string, string>
}> = ({ row, now, error, draft = {} }) => {
  const meta = parseMeta(row)
  const base = meta.base_url ?? ''
  const rawCat = meta.category ?? ''
  const knownCat = rawCat.startsWith('?') ? '' : rawCat
  const v = (key: string, fallback = '') => draft[key] ?? fallback

  return (
    <AdminLayout title={`Review · ${row.name}`} tab="submissions">
      <a class="adm-back" href="/admin/submissions">
        ← Back to queue
      </a>

      {error && (
        <div class="adm-alert adm-alert-bad" role="alert">
          {error}
        </div>
      )}

      <div class="adm-grid-side">
        <div>
          <Card title="Approve into the catalog" hint="Writes a live row and queues the API for the next probe sweep.">
            <form method="post" action={`/admin/submissions/${row.id}/approve`} class="adm-form">
              <div class="adm-form-grid">
                <label class="adm-field">
                  <span class="k">Name</span>
                  <input name="name" required value={v('name', row.name)} />
                </label>
                <label class="adm-field">
                  <span class="k">Slug</span>
                  <input name="slug" required pattern="[a-z0-9\-]+" value={v('slug', slugify(row.name))} />
                  <small>Lowercase, hyphens. Becomes /api/&lt;slug&gt;.</small>
                </label>

                <label class="adm-field adm-field-narrow">
                  <span class="k">Emoji</span>
                  <input name="emoji" maxlength={4} value={v('emoji', '🔌')} />
                </label>
                <label class="adm-field">
                  <span class="k">Category</span>
                  <select name="category" required>
                    <option value="">— pick one —</option>
                    {categories.map((c) => (
                      <option value={c.slug} selected={v('category', knownCat) === c.slug}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                  {rawCat.startsWith('?') && <small class="adm-warn-text">Submitter sent "{rawCat.slice(1)}" — not a real category.</small>}
                </label>

                <label class="adm-field adm-field-wide">
                  <span class="k">Tagline</span>
                  <input name="tagline" required maxlength={120} value={v('tagline')} placeholder="One line, what it actually does" />
                </label>

                <label class="adm-field adm-field-wide">
                  <span class="k">Description</span>
                  {/* §12: original prose only — never paste the provider's copy. */}
                  <textarea name="description" rows={5} required placeholder="Original prose — never copied from the provider's docs.">
                    {v('description')}
                  </textarea>
                  <small>Written by you. Copied marketing copy is a legal problem, not a shortcut.</small>
                </label>

                <label class="adm-field">
                  <span class="k">Base URL</span>
                  <input name="base_url" required type="url" value={v('base_url', base)} />
                </label>
                <label class="adm-field">
                  <span class="k">Sample endpoint</span>
                  <input name="sample_endpoint" required value={v('sample_endpoint', meta.sample_endpoint ?? '')} placeholder="/v1/things" />
                  <small>Path only. This is the route the checker probes.</small>
                </label>

                <label class="adm-field">
                  <span class="k">Docs URL</span>
                  <input name="docs_url" type="url" value={v('docs_url', row.docs_url ?? '')} />
                </label>
                <label class="adm-field">
                  <span class="k">Auth</span>
                  <select name="auth">
                    {AUTH.map(([val, label]) => (
                      <option value={val} selected={v('auth', row.auth_type ?? 'none') === val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="adm-field adm-field-wide">
                  <span class="k">Check tier</span>
                  <select name="check_tier">
                    {TIERS.map(([val, label]) => (
                      <option value={val} selected={v('check_tier', row.auth_type === 'none' ? 'endpoint' : 'reachability') === val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="adm-field">
                  <span class="k">Free tier</span>
                  <input name="free_tier" value={v('free_tier')} placeholder="500 req/day, no card" />
                </label>
                <label class="adm-field">
                  <span class="k">Rate limit</span>
                  <input name="rate_limit" value={v('rate_limit')} placeholder="60 req/min" />
                </label>

                <label class="adm-field">
                  <span class="k">Commercial use</span>
                  <select name="commercial_use">
                    {(['unclear', 'yes', 'no'] as const).map((val) => (
                      <option value={val} selected={v('commercial_use', 'unclear') === val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </label>
                <label class="adm-field">
                  <span class="k">Data license</span>
                  <input name="data_license" value={v('data_license')} placeholder="CC BY 4.0" />
                </label>

                <label class="adm-check adm-field-wide">
                  <input type="checkbox" name="requires_card" value="1" checked={v('requires_card') === '1'} />
                  <span>Requires a payment card to sign up</span>
                </label>

                <label class="adm-field adm-field-wide">
                  <span class="k">Internal note</span>
                  <input name="notes" value={v('notes')} placeholder="Why you approved it (not shown publicly)" />
                </label>
              </div>

              <div class="adm-form-foot">
                <p class="adm-dim">
                  Goes live as <b>unmonitored</b> with no health score until the checker probes it — it will
                  not claim uptime it hasn't earned.
                </p>
                <button class="adm-btn adm-btn-primary" type="submit">
                  Approve &amp; publish
                </button>
              </div>
            </form>
          </Card>

          <Card title="Decline" hint="Rejecting keeps the record for audit; it is never deleted.">
            <form method="post" action={`/admin/submissions/${row.id}/reject`} class="adm-inline-form">
              <input name="notes" placeholder="Reason (internal)" class="adm-grow" />
              <button class="adm-btn" name="verdict" value="rejected" type="submit">
                Reject
              </button>
              <button class="adm-btn adm-btn-danger" name="verdict" value="spam" type="submit">
                Mark spam
              </button>
            </form>
          </Card>
        </div>

        <Card title="As submitted" hint="Untrusted input, shown verbatim.">
          <dl class="adm-kv adm-kv-stack">
            <div>
              <dt>Status</dt>
              <dd>
                <Chip status={row.status} />
              </dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>
                <When iso={row.created_at} now={now} />
              </dd>
            </div>
            <div>
              <dt>Submitter</dt>
              <dd class="adm-mono">{row.submitter_email ?? '—'}</dd>
            </div>
            <div>
              <dt>Endpoint</dt>
              <dd class="adm-mono adm-break">{row.endpoint_url ?? '—'}</dd>
            </div>
            <div>
              <dt>Docs</dt>
              <dd class="adm-mono adm-break">{row.docs_url ?? '—'}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{meta.notes ?? '—'}</dd>
            </div>
            <div>
              <dt>Browser probe</dt>
              <dd class="adm-mono">{meta.browser_probe ?? '—'}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd class="adm-mono">{meta.source ?? '—'}</dd>
            </div>
            <div>
              <dt>IP</dt>
              <dd class="adm-mono">{meta.ip ?? '—'}</dd>
            </div>
            <div>
              <dt>User agent</dt>
              <dd class="adm-mono adm-dim adm-break adm-tiny">{meta.ua ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </AdminLayout>
  )
}
