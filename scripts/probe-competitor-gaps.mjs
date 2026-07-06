// Probe curated competitor-gap APIs (news + other high-value misses) → scripts/import/batch-NN.json
// run: node scripts/probe-competitor-gaps.mjs [--from-batch 107]

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
    UA,
    isApiKeyProbeHit,
    probeUrl,
    splitBaseAndEndpoint,
    trimJson,
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '107')
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8')
  + readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')

function hostKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
function hostsKnown(url) {
  const h = hostKey(url)
  if (!h) return true
  return SEED.includes(h) || SEED.includes(h.replace(/^api\./, ''))
}

/** Curated from public-apis / apimap / freepublicapis gaps — not yet in seed-imported.ts */
const CANDIDATES = [
  {
    slug: 'world-news-api',
    name: 'World News API',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Global news search in 86+ languages with semantic tagging',
    description: 'World News API indexes thousands of sources across 210+ countries with semantic entity tags, sentiment, geo filters, and newspaper front pages. Free tier: 50 points/day with an API key from worldnewsapi.com.',
    docsUrl: 'https://worldnewsapi.com/docs',
    probes: [
      'https://api.worldnewsapi.com/search-news?text=technology&number=1',
      'https://api.worldnewsapi.com/top-news?source-country=us&number=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free — 50 API points/day',
    rateLimit: '50 points/day on free plan',
  },
  {
    slug: 'gnews',
    name: 'GNews',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Search headlines from 60,000+ sources worldwide',
    description: 'GNews aggregates articles from trusted publishers with keyword search, top headlines by topic or country, and full-text snippets. Free tier requires registration for an API key at gnews.io.',
    docsUrl: 'https://gnews.io/docs/v4',
    probes: ['https://gnews.io/api/v4/top-headlines?lang=en&max=1'],
    auth: 'apiKey',
    freeTier: 'Free tier — API key required',
    rateLimit: '100 requests/day on free plan',
  },
  {
    slug: 'newsdata',
    name: 'NewsData',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Breaking news and historical headlines from global sources',
    description: 'NewsData.io serves live and archive news with category, language, and country filters. Register for a free API key; responses include title, link, source, and publish time.',
    docsUrl: 'https://newsdata.io/documentation',
    probes: ['https://newsdata.io/api/1/latest?language=en&size=1'],
    auth: 'apiKey',
    freeTier: 'Free tier — 200 credits/day',
    rateLimit: '200 credits/day on free plan',
  },
  {
    slug: 'thenews-api',
    name: 'TheNews API',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Aggregated headlines and top stories as JSON',
    description: 'TheNews API returns headline feeds, top stories, and search results from aggregated publishers. Free registration yields an api_token for REST calls.',
    docsUrl: 'https://www.thenewsapi.com/documentation',
    probes: [
      'https://api.thenewsapi.com/v1/news/top?locale=us&limit=1',
      'https://api.thenewsapi.com/v1/news/all?limit=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free tier — token required',
    rateLimit: 'Unpublished',
  },
  {
    slug: 'newsapi-ai',
    name: 'NewsAPI.ai',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Real-time and archive news from Event Registry',
    description: 'NewsAPI.ai (Event Registry) provides semantic news search, event clustering, and sentiment across global sources. API key required; free trial available for developers.',
    docsUrl: 'https://newsapi.ai/documentation',
    probes: [
      'https://eventregistry.org/api/v1/article/getArticles?resultType=articles&articlesCount=1',
      'https://newsapi.ai/api/v1/article/getArticles?resultType=articles&articlesCount=1',
    ],
    auth: 'apiKey',
    freeTier: 'Trial — API key required',
    rateLimit: 'Plan-dependent',
  },
  {
    slug: 'marketaux',
    name: 'MarketAux',
    emoji: '📈',
    sourceCategory: 'News',
    tagline: 'Financial news with tickers, sentiment, and entity tags',
    description: 'MarketAux streams market-moving headlines with linked stock symbols, sentiment scores, and publisher metadata. Free API token from marketaux.com for limited daily requests.',
    docsUrl: 'https://www.marketaux.com/documentation',
    probes: ['https://api.marketaux.com/v1/news/all?language=en&limit=1'],
    auth: 'apiKey',
    freeTier: 'Free tier — token required',
    rateLimit: '100 requests/day on free plan',
  },
  {
    slug: 'the-guardian',
    name: 'The Guardian',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Search Guardian articles, tags, and sections',
    description: 'The Guardian Open Platform exposes search, tags, and section feeds as JSON. Developer key required (free for non-commercial use); responses include web URL, headline, and body fields.',
    docsUrl: 'https://open-platform.theguardian.com/documentation/',
    probes: [
      'https://content.guardianapis.com/search?show-fields=headline&page-size=1&api-key=test',
      'https://content.guardianapis.com/search?page-size=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free developer key — registration required',
    rateLimit: '5000 calls/day (developer tier)',
  },
  {
    slug: 'new-york-times',
    name: 'New York Times',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Article search and metadata from NYT Developer Network',
    description: 'The New York Times Developer API covers article search, top stories, books, and archive metadata. Register for an API key; most endpoints return JSON with headline, abstract, and URLs.',
    docsUrl: 'https://developer.nytimes.com/',
    probes: [
      'https://api.nytimes.com/svc/topstories/v2/home.json',
      'https://api.nytimes.com/svc/search/v2/articlesearch.json?q=technology',
    ],
    auth: 'apiKey',
    freeTier: 'Free tier — 500 requests/day',
    rateLimit: '500 requests/day on free plan',
  },
  {
    slug: 'apitube',
    name: 'APITube',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Real-time news from 500k+ sources in 60 languages',
    description: 'APITube monitors global news outlets with keyword search, source filters, and language tags. API key required; free trial tier available for integration testing.',
    docsUrl: 'https://docs.apitube.io/',
    probes: [
      'https://api.apitube.io/v1/news/everything?limit=1',
      'https://api.apitube.io/v1/news/top-headlines?limit=1',
    ],
    auth: 'apiKey',
    freeTier: 'Trial — API key required',
    rateLimit: 'Plan-dependent',
  },
  {
    slug: 'newscatcher',
    name: 'NewsCatcher',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Search clean news articles by topic, country, or language',
    description: 'NewsCatcher normalizes articles from thousands of publishers with NLP enrichment — clusters, entities, and deduplication. Free API key for developers with daily request caps.',
    docsUrl: 'https://newscatcherapi.com/docs/',
    probes: [
      'https://v3-api.newscatcherapi.com/api/search?q=technology&page_size=1',
      'https://api.newscatcherapi.com/v2/search?q=technology&page_size=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free tier — API key required',
    rateLimit: 'Unpublished',
  },
  {
    slug: 'newsdatahub',
    name: 'NewsDataHub',
    emoji: '📰',
    sourceCategory: 'News',
    tagline: 'Near-real-time global news REST API',
    description: 'NewsDataHub delivers production-ready news JSON with source, category, and publish-time filters. API key signup required for the hosted REST endpoints.',
    docsUrl: 'https://newsdatahub.com/docs',
    probes: ['https://api.newsdatahub.com/v1/news?limit=1'],
    auth: 'apiKey',
    freeTier: 'Free trial — key required',
    rateLimit: 'Plan-dependent',
  },
  {
    slug: 'finlight',
    name: 'Finlight',
    emoji: '📈',
    sourceCategory: 'News',
    tagline: 'Real-time financial news with sentiment',
    description: 'Finlight streams finance-focused headlines with sentiment scores and full article text for tickers and macro topics. Developer API key required.',
    docsUrl: 'https://finlight.me/docs',
    probes: ['https://api.finlight.me/v1/news?limit=1'],
    auth: 'apiKey',
    freeTier: 'Free tier — key required',
    rateLimit: 'Unpublished',
  },
  {
    slug: 'spoonacular',
    name: 'Spoonacular',
    emoji: '🍽',
    sourceCategory: 'Food & Drink',
    tagline: 'Recipes, ingredients, meal plans, and nutrition data',
    description: 'Spoonacular is a comprehensive food API — search recipes, parse ingredients, compute nutrition, and generate meal plans. Free tier with a daily point quota after signup.',
    docsUrl: 'https://spoonacular.com/food-api/docs',
    probes: [
      'https://api.spoonacular.com/recipes/complexSearch?number=1&addRecipeInformation=false',
      'https://api.spoonacular.com/food/ingredients/search?query=apple&number=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free — 50 points/day',
    rateLimit: '50 points/day on free plan',
  },
  {
    slug: 'tasty',
    name: 'Tasty',
    emoji: '🍳',
    sourceCategory: 'Food & Drink',
    tagline: 'BuzzFeed Tasty recipes and lists via RapidAPI',
    description: 'The Tasty API exposes recipe lists, tags, and detail pages from BuzzFeed Tasty. Typically accessed via RapidAPI with a free tier key for hobby projects.',
    docsUrl: 'https://rapidapi.com/apidojo/api/tasty',
    probes: ['https://tasty-api.herokuapp.com/recipes/list?from=0&size=1'],
    auth: 'apiKey',
    freeTier: 'Community endpoints vary — verify host',
    rateLimit: 'Unpublished',
  },
  {
    slug: 'google-books',
    name: 'Google Books',
    emoji: '📚',
    sourceCategory: 'Books',
    tagline: 'Search volumes, shelves, and preview links',
    description: 'Google Books API searches millions of volumes with ISBN lookup, preview links, and metadata. No key for anonymous low-volume use; API key recommended for production.',
    docsUrl: 'https://developers.google.com/books/docs/v1/using',
    probes: [
      'https://www.googleapis.com/books/v1/volumes?q=python&maxResults=1',
    ],
    auth: 'apiKey',
    freeTier: 'Free — key optional at low volume',
    rateLimit: '1000 requests/day without key',
  },
  {
    slug: 'open-library-search',
    name: 'Open Library Search',
    emoji: '📚',
    sourceCategory: 'Books',
    tagline: 'Full-text book search from Internet Archive',
    description: 'Open Library search returns works, editions, and authors from the Internet Archive catalog. Keyless JSON over HTTPS — the standard open bibliographic search endpoint.',
    docsUrl: 'https://openlibrary.org/dev/docs/api/search',
    probes: ['https://openlibrary.org/search.json?q=javascript&limit=1'],
    auth: 'none',
    freeTier: 'Free — no key',
    rateLimit: 'Fair use — be polite',
  },
  {
    slug: 'exchangerate-host',
    name: 'ExchangeRate.host',
    emoji: '💱',
    sourceCategory: 'Currency Exchange',
    tagline: 'Live and historical FX rates — free tier with key',
    description: 'ExchangeRate.host provides latest and historical foreign-exchange rates with base-currency conversion. Free API access with registration for an access key on apilayer.',
    docsUrl: 'https://exchangerate.host/documentation',
    probes: [
      'https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP',
      'https://api.exchangerate-api.com/v4/latest/USD',
    ],
    auth: 'none',
    freeTier: 'Free — no key on legacy host',
    rateLimit: 'Unpublished',
  },
  {
    slug: 'fixer',
    name: 'Fixer',
    emoji: '💱',
    sourceCategory: 'Currency Exchange',
    tagline: 'ECB-backed exchange rates via APILayer',
    description: 'Fixer.io returns latest and historical FX rates sourced from European Central Bank data. Free plan requires an API key with monthly request limits.',
    docsUrl: 'https://fixer.io/documentation',
    probes: ['https://data.fixer.io/api/latest?access_key='],
    auth: 'apiKey',
    freeTier: 'Free — 100 requests/month',
    rateLimit: '100 requests/month on free plan',
  },
  {
    slug: 'abstract-email-validation',
    name: 'Abstract Email Validation',
    emoji: '✉️',
    sourceCategory: 'Development',
    tagline: 'Validate and enrich email addresses',
    description: 'Abstract API email validation checks deliverability, MX records, and disposable-domain flags. Free tier with API key from abstractapi.com.',
    docsUrl: 'https://docs.abstractapi.com/email-validation',
    probes: ['https://emailvalidation.abstractapi.com/v1/?api_key=&email=test@example.com'],
    auth: 'apiKey',
    freeTier: 'Free — 100 requests/month',
    rateLimit: '100 requests/month on free plan',
  },
  {
    slug: 'ipgeolocation',
    name: 'IPGeolocation',
    emoji: '📍',
    sourceCategory: 'Development',
    tagline: 'IP → location, timezone, currency, and security',
    description: 'IPGeolocation.io resolves IPs to city, country, timezone, and threat signals. Free API key with daily lookup limits for developers.',
    docsUrl: 'https://ipgeolocation.io/documentation.html',
    probes: ['https://api.ipgeolocation.io/ipgeo?apiKey=&ip=8.8.8.8'],
    auth: 'apiKey',
    freeTier: 'Free — 1000 requests/day',
    rateLimit: '1000 requests/day on free plan',
  },
]

async function tryProbe(c) {
  if (c.probes.some((u) => hostsKnown(u))) {
    return { skip: 'already in catalog' }
  }
  for (const url of c.probes) {
    const r = await probeUrl(url, { headers: { 'User-Agent': UA } })
    const hit = c.auth === 'apiKey' ? isApiKeyProbeHit(r.httpStatus, r.json) : r.httpStatus === 200 && r.json
    if (!hit || !r.json) continue
    const split = splitBaseAndEndpoint(url)
    if (!split) continue
    return {
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      tagline: c.tagline,
      description: c.description,
      sourceCategory: c.sourceCategory,
      docsUrl: c.docsUrl,
      baseUrl: split.baseUrl,
      sampleEndpoint: split.sampleEndpoint,
      latencyMs: r.latencyMs,
      corsObserved: r.corsObserved,
      httpStatus: r.httpStatus,
      sampleJson: trimJson(r.json),
      freeTier: c.freeTier,
      rateLimit: c.rateLimit,
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      auth: c.auth,
      notes: `competitor-gap probe ${url}`,
    }
  }
  return { skip: 'no probe hit' }
}

const verified = []
const skipped = []

for (const c of CANDIDATES) {
  const r = await tryProbe(c)
  if (r.skip) {
    skipped.push({ name: c.name, slug: c.slug, reason: r.skip })
    console.log(`  skip ${c.slug}: ${r.skip}`)
  } else {
    verified.push(r)
    console.log(`  ✓ ${c.slug} (${r.httpStatus})`)
  }
}

const out = { batch: FROM, verified, skipped }
const outPath = `${IMPORT_DIR}batch-${String(FROM).padStart(2, '0')}.json`
if (!verified.length && existsSync(outPath)) {
  console.log(`\nNo new probes — kept existing ${outPath}`)
} else {
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(`\nWrote ${verified.length} verified → batch-${String(FROM).padStart(2, '0')}.json`)
}
