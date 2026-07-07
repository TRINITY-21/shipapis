import type { FC } from 'hono/jsx'

import { categoryBySlug, uptimePct, type ApiEntry } from '../../../data/seed'
import { facetTokens, searchText } from '../../lib/browse'
import { checkedAgo, fmtAdded } from '../../lib/format'
import { ApiGlyph } from '../ApiGlyph'
import { StatusBadge } from '../StatusBadge'
import { UptimeBars } from '../UptimeBars'

export const ApiRow: FC<{ api: ApiEntry; added?: boolean }> = ({ api, added }) => {
  const cat = categoryBySlug.get(api.category)!
  return (
    <a
      class="row row-api"
      href={`/api/${api.slug}`}
      data-search={searchText(api, cat.name)}
      data-facets={facetTokens(api)}
    >
      <span class="row-name">
        <ApiGlyph api={api} displayPx={30} />
        <span class="row-name-txt">
          <span class="row-line">
            <b>{api.name}</b>
            <span class="row-cat">{cat.name}</span>
            {added && <span class="row-cat row-added">ADDED <b>{fmtAdded(api.addedAt)}</b></span>}
          </span>
          {api.tagline && <span class="row-desc">{api.tagline}</span>}
          <span class="row-sub">
            <StatusBadge status={api.status} checkTier={api.checkTier} />
            <span>auth {api.auth}</span>
            <span>{cat.name}</span>
          </span>
        </span>
      </span>
      <StatusBadge status={api.status} checkTier={api.checkTier} />
      <UptimeBars api={api} days={14} mini />
      <span class="num"><b>{uptimePct(api)}%</b></span>
      <span class="num">{api.p50 > 0 ? `${api.p50} ms` : '—'}</span>
      <span class="num">{api.auth === 'none' ? 'none' : api.auth}</span>
      <span class="num">{checkedAgo(api.lastCheckedMin)}</span>
    </a>
  )
}
