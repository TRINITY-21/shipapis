import type { FC } from 'hono/jsx'
import { catApis, catalogCounts } from '../../data/catalog'
import { FacetRow } from '../components/FacetRow'
import { ListEmpty } from '../components/ListEmpty'
import { ApiRow } from '../components/list/ApiRow'
import { RowHead } from '../components/list/RowHead'
import { Layout } from '../layout/Layout'
import { browseSorted } from '../lib/browse'
import { SORT_DEFS } from '../lib/constants'
import { breadcrumbLd, itemListLd } from '../lib/seo'

export const BrowsePage: FC<{ sort?: string; facet?: string }> = ({ sort, facet }) => {
  const counts = catalogCounts()
  const list = browseSorted(catApis(), sort)
  const activeSort = SORT_DEFS.some(([key]) => key === sort) ? (sort as string) : ''
  const showingProbed = facet === 'monitored'
  // Sort links preserve an active ?facet= so switching views never drops the filter.
  const sortHref = (key: string) => {
    const params = [key && `sort=${key}`, facet && `facet=${encodeURIComponent(facet)}`].filter(Boolean).join('&')
    return params ? `/browse?${params}` : '/browse'
  }
  return (
    <Layout
      title="Browse free public APIs — filter by health, key & CORS · shipapis"
      desc={`${counts.scheduled} APIs on our probe schedule (${counts.monitored} probed), ${counts.total} catalogued in total. Filter by auth, CORS, and health — scores appear only after we probe an API.`}
      path="/browse"
      /* sort/facet views are the same list re-ordered — one canonical, no duplicate-content split */
      canonical="/browse"
      jsonLd={[
        breadcrumbLd([['Home', '/'], ['Browse']]),
        itemListLd('Free APIs on shipapis', list),
      ]}
    >
      <div class="wrap">
        <div class="page-head">
          <h1>{showingProbed ? 'APIs probed by us.' : 'Browse the catalog.'}</h1>
          <p>
            {showingProbed ? (
              <>
                <b class="num">{counts.monitored}</b> APIs probed with live health data.{' '}
                <b class="num">{counts.scheduled}</b> on our probe schedule total.{' '}
                <a href="/browse">Show all {counts.total} catalogued</a>.
              </>
            ) : (
              <>
                <b class="num">{counts.total}</b> free public APIs — <b class="num">{counts.scheduled}</b> on our
                probe schedule (<b class="num">{counts.monitored}</b> probed, <b class="num">{counts.queued}</b>{' '}
                queued), <b class="num">{counts.listedOnly}</b> listed only.{' '}
                <a href="/browse?facet=monitored">See probed only</a>.
              </>
            )}
          </p>
        </div>
        <div class="prompt mt-24">
          <span class="ps" aria-hidden="true">$</span>
          <input id="q" type="search" aria-label="Search APIs" placeholder="weather, photos, no key…" autocomplete="off" spellcheck={false} />
          <span class="k" id="q-count" aria-live="polite">{list.length} IN CATALOG</span>
        </div>
        <nav class="sort-tabs" aria-label="Sort order">
          <span class="k">SORT</span>
          {SORT_DEFS.map(([key, label]) => (
            <a
              class={`sort-tab${key === activeSort ? ' on' : ''}`}
              href={sortHref(key)}
              aria-current={key === activeSort ? 'true' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <FacetRow count={list.length} active={facet} cats />
        <div class="rows">
          <RowHead />
          {list.map((a) => (
            <ApiRow api={a} />
          ))}
        </div>
        <div class="mt-16 mb-64">
          <ListEmpty />
        </div>
      </div>
    </Layout>
  )
}
