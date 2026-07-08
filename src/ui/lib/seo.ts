import { isMonitored } from '../../data/catalog'
import { uptimePct, type ApiEntry } from '../../data/seed'
import { DEFAULT_DESC, SITE } from './constants'

export const detailTitle = (api: ApiEntry, catName: string) =>
  isMonitored(api)
    ? `${api.name} — free ${catName.toLowerCase()} API, ${uptimePct(api)}% uptime · shipapis`
    : `${api.name} — free ${catName.toLowerCase()} API (catalogued) · shipapis`

export const detailDesc = (api: ApiEntry, catName: string) =>
  isMonitored(api)
    ? `${api.name}: ${uptimePct(api)}% uptime (90d)${api.p50 > 0 ? `, ${api.p50} ms median` : ''}, auth ${api.auth === 'none' ? 'none' : api.auth}, CORS ${api.cors}. ${api.tagline}`
    : `${api.name}: catalogued free ${catName.toLowerCase()} API — ${api.tagline}. Not probed by shipapis yet; use the provider docs to integrate.`

export const ORG_LD = {
  '@type': 'Organization',
  '@id': `${SITE}/#org`,
  name: 'shipapis',
  url: SITE,
  email: 'hello@shipapis.dev',
  // Other canonical presences — ties this entity together for the knowledge graph / AI citations.
  sameAs: ['https://github.com/TRINITY-21/shipapis'],
  description: 'An independent directory of free public APIs with live health checks on probed endpoints. No paid placement, published methodology.',
}

/** SearchAction target is real: app.js reads ?q= on /browse and applies the filter. */
export const WEBSITE_LD = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'shipapis',
  url: SITE,
  description: DEFAULT_DESC,
  publisher: { '@id': `${SITE}/#org` },
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/browse?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

/** BreadcrumbList — the last crumb is the current page and carries no item URL. */
export const breadcrumbLd = (trail: Array<readonly [name: string, path?: string]>) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, p], i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name,
    ...(p ? { item: `${SITE}${p}` } : {}),
  })),
})

export const itemListLd = (name: string, items: ApiEntry[]) => ({
  '@type': 'ItemList',
  name,
  numberOfItems: items.length,
  itemListElement: items.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: a.name,
    url: `${SITE}/api/${a.slug}`,
  })),
})

/** FAQPage — from visible on-page capsules (never hidden text; Google/AI read the same copy). */
export const faqLd = (items: Array<{ q: string; a: string }>) => ({
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
})

export const webApiLd = (api: ApiEntry, catName: string) => ({
  '@type': 'WebAPI',
  name: api.name,
  description: api.description,
  url: `${SITE}/api/${api.slug}`,
  documentation: api.docsUrl,
  category: catName,
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
})
