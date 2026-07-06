// Shared SQL builders for catalog export (full seed + incremental delta).

export const q = (s: string) => `'${s.replace(/'/g, "''")}'`
export const opt = (s: string | null | undefined) => (s == null ? 'NULL' : q(s))
export const bool = (b: boolean) => (b ? '1' : '0')
export const cors = (c: 'yes' | 'no' | 'unknown') => (c === 'yes' ? '1' : c === 'no' ? '0' : 'NULL')

export type CategoryRow = { slug: string; name: string; emoji: string; blurb: string; apiCount: number }
export type ApiRow = {
  slug: string
  name: string
  emoji: string
  tagline: string
  description: string
  categorySlug: string
  docsUrl: string
  baseUrl: string
  auth: string
  checkTier: string
  https: boolean
  cors: 'yes' | 'no' | 'unknown'
  freeTier: string
  rateLimit: string
  requiresCard: boolean
  commercialUse: string
  dataLicense: string
  status: string
  addedAt: string
  diedAt: string | null
  epitaph: string | null
}
export type EndpointRow = {
  apiSlug: string
  method: string
  urlTemplate: string
  description: string
  active: boolean
}
export type ShapeChangeRow = {
  apiSlug: string
  urlTemplate: string
  ts: string
  summary: string
}

export function insertCategory(row: CategoryRow, id?: number): string {
  const cols = id != null ? '(id, slug, name, emoji, description_md, api_count)' : '(slug, name, emoji, description_md, api_count)'
  const vals =
    id != null
      ? `(${id}, ${q(row.slug)}, ${q(row.name)}, ${q(row.emoji)}, ${q(row.blurb)}, ${row.apiCount})`
      : `(${q(row.slug)}, ${q(row.name)}, ${q(row.emoji)}, ${q(row.blurb)}, ${row.apiCount})`
  return (
    `insert into categories ${cols} select ${vals.slice(1, -1)} ` +
    `where not exists (select 1 from categories where slug = ${q(row.slug)});`
  )
}

export function insertApi(row: ApiRow, categoryId: number, id?: number): string {
  const cols =
    id != null
      ? `(id, slug, name, emoji, tagline, description_md, category_id, docs_url, base_url, auth_type, check_tier, https, cors_verified, free_tier_notes, rate_limit_notes, requires_card, commercial_use, data_license, status, added_at, monitored_since, tombstoned_at, epitaph)`
      : `(slug, name, emoji, tagline, description_md, category_id, docs_url, base_url, auth_type, check_tier, https, cors_verified, free_tier_notes, rate_limit_notes, requires_card, commercial_use, data_license, status, added_at, monitored_since, tombstoned_at, epitaph)`
  const base =
    `${id != null ? `${id}, ` : ''}${q(row.slug)}, ${q(row.name)}, ${q(row.emoji)}, ${q(row.tagline)}, ${q(row.description)}, ${categoryId}, ` +
    `${q(row.docsUrl)}, ${q(row.baseUrl)}, ${q(row.auth)}, ${q(row.checkTier)}, ${bool(row.https)}, ${cors(row.cors)}, ` +
    `${q(row.freeTier)}, ${q(row.rateLimit)}, ${bool(row.requiresCard)}, ${q(row.commercialUse)}, ` +
    `${q(row.dataLicense)}, ${q(row.status)}, ${q(row.addedAt)}, NULL, ${opt(row.diedAt)}, ${opt(row.epitaph)}`
  return `insert into apis ${cols} select ${base} where not exists (select 1 from apis where slug = ${q(row.slug)});`
}

export function insertApiByCategorySlug(row: ApiRow): string {
  return (
    `insert into apis (slug, name, emoji, tagline, description_md, category_id, docs_url, base_url, auth_type, check_tier, https, cors_verified, free_tier_notes, rate_limit_notes, requires_card, commercial_use, data_license, status, added_at, monitored_since, tombstoned_at, epitaph) ` +
    `select ${q(row.slug)}, ${q(row.name)}, ${q(row.emoji)}, ${q(row.tagline)}, ${q(row.description)}, c.id, ` +
    `${q(row.docsUrl)}, ${q(row.baseUrl)}, ${q(row.auth)}, ${q(row.checkTier)}, ${bool(row.https)}, ${cors(row.cors)}, ` +
    `${q(row.freeTier)}, ${q(row.rateLimit)}, ${bool(row.requiresCard)}, ${q(row.commercialUse)}, ` +
    `${q(row.dataLicense)}, ${q(row.status)}, ${q(row.addedAt)}, NULL, ${opt(row.diedAt)}, ${opt(row.epitaph)} ` +
    `from categories c where c.slug = ${q(row.categorySlug)} ` +
    `and not exists (select 1 from apis where slug = ${q(row.slug)});`
  )
}

export function insertEndpoint(row: EndpointRow, apiId?: number): string {
  const active = row.active ? 1 : 0
  if (apiId != null) {
    return (
      `insert into endpoints (api_id, method, url_template, sample_params_json, description, active) ` +
      `select ${apiId}, ${q(row.method)}, ${q(row.urlTemplate)}, NULL, ${q(row.description)}, ${active} ` +
      `where not exists (select 1 from endpoints where api_id = ${apiId} and method = ${q(row.method)} and url_template = ${q(row.urlTemplate)});`
    )
  }
  return (
    `insert into endpoints (api_id, method, url_template, sample_params_json, description, active) ` +
    `select a.id, ${q(row.method)}, ${q(row.urlTemplate)}, NULL, ${q(row.description)}, ${active} ` +
    `from apis a where a.slug = ${q(row.apiSlug)} ` +
    `and not exists (` +
    `select 1 from endpoints e where e.api_id = a.id and e.method = ${q(row.method)} and e.url_template = ${q(row.urlTemplate)}` +
    `);`
  )
}

export function insertShapeChange(row: ShapeChangeRow): string {
  return (
    `insert into shape_changes (endpoint_id, ts, old_hash, new_hash, diff_summary) ` +
    `select e.id, ${q(row.ts)}, NULL, NULL, ${q(row.summary)} ` +
    `from endpoints e join apis a on a.id = e.api_id ` +
    `where a.slug = ${q(row.apiSlug)} and e.url_template = ${q(row.urlTemplate)} ` +
    `and not exists (select 1 from shape_changes sc where sc.endpoint_id = e.id and sc.ts = ${q(row.ts)});`
  )
}

export function updateCategoryCounts(categorySlug: string, count: number): string {
  return `update categories set api_count = ${count} where slug = ${q(categorySlug)};`
}
