import type { Child, FC } from 'hono/jsx'
import { catalogCounts } from '../../data/catalog'
import { categoryCounts } from '../../data/shapes'
import { gaMeasurementId } from '../../workers/request-config'
import { Logo } from '../components/Logo'
import { DEFAULT_DESC, FAVICON, PRIMARY_NAV, SITE, THEME_BOOT } from '../lib/constants'
import { jsonLdStr } from '../lib/format'
import { navAriaCurrent } from '../lib/nav'
import { buildApiIndex } from '../lib/palette'

/** GA4 gtag boot — only emitted when GA_MEASUREMENT_ID looks like a real G- id. */
function gaSnippet(id: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`
}

function safeGaId(raw: string | undefined): string | undefined {
  return raw && /^G-[A-Z0-9]+$/i.test(raw) ? raw : undefined
}

export const Layout: FC<{
  title: string
  desc?: string
  path?: string
  /** Canonical path when it differs from `path` (param'd views, mirrored compare orders). */
  canonical?: string
  og?: string
  /** Alt text for the OG image — describe the card, not the page. */
  ogAlt?: string
  noindex?: boolean
  /** schema.org JSON-LD — one object or several, emitted as @graph. */
  jsonLd?: object | object[]
  children?: Child
}> = ({
  title,
  desc = DEFAULT_DESC,
  path = '/',
  canonical,
  og = '/og/home.png',
  ogAlt = 'shipapis — live health dashboard for free public APIs',
  noindex,
  jsonLd,
  children,
}) => {
  const gaId = safeGaId(gaMeasurementId())
  return (
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <meta name="description" content={desc} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <>
          <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
          <link rel="canonical" href={`${SITE}${canonical ?? path}`} />
        </>
      )}
      <meta name="theme-color" content="#f6f7f8" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0b0c0f" media="(prefers-color-scheme: dark)" />
      <link rel="alternate" type="application/rss+xml" title="shipapis — additions & deaths" href="/feed.xml" />
      <link rel="alternate" type="application/rss+xml" title="shipapis — the API graveyard" href="/graveyard.xml" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="shipapis" />
      <meta property="og:locale" content="en_US" />
      <meta property="og:url" content={`${SITE}${canonical ?? path}`} />
      <meta property="og:image" content={`${SITE}${og}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={`${SITE}${og}`} />
      <meta name="twitter:image:alt" content={ogAlt} />
      <link rel="icon" href={FAVICON} />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdStr(
              Array.isArray(jsonLd) ? { '@context': 'https://schema.org', '@graph': jsonLd } : { '@context': 'https://schema.org', ...jsonLd },
            ),
          }}
        />
      )}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin="" />
      <link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin="" />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body>
      <div class="loadbar" id="loadbar" aria-hidden="true"><i /></div>
      <a class="skip" href="#main">Skip to content</a>
      <header class="nav">
        <div class="wrap nav-inner">
          <div class="nav-start">
            <a class="brand" href="/">
              <Logo />
              shipapis
            </a>
            <nav class="nav-links" aria-label="Primary">
              {PRIMARY_NAV.map(({ href, label, title }) => (
                <a href={href} aria-current={navAriaCurrent(path, href)} title={title}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div class="nav-actions">
            <button class="search-pill" data-palette-open aria-label="Search APIs (Command K)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <a
              class="icon-btn gh-btn"
              href="https://github.com/TRINITY-21/shipapis"
              target="_blank"
              rel="noopener noreferrer"
              title="Star shipapis on GitHub"
              aria-label="Star shipapis on GitHub"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              <span class="gh-star">Star</span>
            </a>
            <button id="theme-toggle" class="icon-btn" data-theme-toggle title="Toggle theme" aria-label="Toggle theme" aria-pressed="false">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
              </svg>
            </button>
            <a class="btn btn-accent" href="/submit">
              <span class="nav-submit-long">Submit an API</span>
              <span class="nav-submit-short">Submit API</span>
            </a>
            <button id="menu-btn" class="icon-btn" title="Menu" aria-label="Open menu" aria-expanded="false" aria-controls="nav-menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="nav-menu" id="nav-menu">
          <button type="button" class="nav-menu-search" data-palette-open aria-label="Search APIs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Search APIs
          </button>
          {PRIMARY_NAV.map(({ href, label, title }) => (
            <a href={href} aria-current={navAriaCurrent(path, href)} title={title}>
              {label}
            </a>
          ))}
          <button type="button" class="nav-menu-theme" data-theme-toggle aria-label="Toggle theme" aria-pressed="false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
            </svg>
            Toggle theme
          </button>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer class="footer">
        <div class="wrap footer-inner">
          <div class="footer-id">
            <a class="brand" href="/">
              <Logo />
              shipapis
            </a>
            <p class="footer-pledge comment">we don't sell placement. the data decides.</p>
            <form class="newsletter" id="newsletter">
              <span class="k">The signal · email, occasionally</span>
              {/* Honeypot — off-screen; a filled value is dropped server-side. */}
              <input class="hp-field" type="text" name="company" tabindex={-1} autocomplete="off" aria-hidden="true" />
              <div class="nl-row">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@ship.dev"
                  aria-label="Email address"
                  autocomplete="email"
                  spellcheck={false}
                />
                <button type="submit" class="btn btn-accent">Subscribe</button>
              </div>
            </form>
          </div>
          <div class="footer-col">
            <span class="k">Directory</span>
            <a href="/browse">All APIs</a>
            <a href="/state">State report</a>
            <a href="/browse?sort=reliable">Most reliable</a>
            <a href="/signals">Signal log</a>
            <a href="/changelog">Changelog</a>
            <a href="/graveyard">Graveyard</a>
            <a href="/methodology">Methodology</a>
          </div>
          <div class="footer-col">
            <span class="k">Top categories</span>
            {categoryCounts()
              .sort((a, b) => b.apis - a.apis)
              .slice(0, 7)
              .map((c) => (
                <a href={`/c/${c.slug}`}>
                  {c.name} <span class="footer-cat-n">{c.apis}</span>
                </a>
              ))}
            <a href="/browse" class="footer-cat-all">All APIs →</a>
          </div>
          <div class="footer-col">
            <span class="k">Developers</span>
            <a href="/agents">Meta-API</a>
            <a href="/agents#mcp">MCP server</a>
            <a href="/data/apis.json">Dataset (JSON)</a>
            <a href="/openapi.json">OpenAPI spec</a>
            <a href="/llms.txt">llms.txt</a>
          </div>
          <div class="footer-col">
            <span class="k">shipapis</span>
            <a href="/about">About</a>
            <a href="/submit">Submit an API</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
        <div class="wrap footer-legal">
          <span class="footer-live"><b>●</b>&nbsp; {catalogCounts().monitored} PROBED · {catalogCounts().total} CATALOGUED</span>
          <span>© 2026 shipapis</span>
          <span>data <a href="/terms">CC-BY-4.0</a></span>
          <span>
            analytics: GA4 + Cloudflare · <a href="/privacy">privacy</a>
          </span>
          <a href="mailto:hello@shipapis.dev">hello@shipapis.dev</a>
        </div>
      </footer>
      <div class="palette-overlay" id="palette-overlay">
        <div class="palette" role="dialog" aria-modal="true" aria-label="Search APIs">
          <div class="palette-input">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="palette-input"
              type="text"
              placeholder="jump to an api…"
              autocomplete="off"
              spellcheck={false}
              aria-label="Search APIs"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-autocomplete="list"
            />
            <kbd>esc</kbd>
          </div>
          <div class="palette-list" id="palette-list" role="listbox" aria-label="Matching APIs" />
        </div>
      </div>
      <div class="kbd-overlay" id="kbd-overlay">
        <div class="kbd-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex={-1}>
          <div class="kbd-head">
            <span class="k">KEYBOARD</span>
            <kbd>esc</kbd>
          </div>
          {[
            ['/', 'focus search'],
            ['⌘K', 'command palette'],
            ['← →', 'switch snippet tabs'],
            ['esc', 'close · clear'],
            ['?', 'this help'],
          ].map(([key, what]) => (
            <div class="kbd-row">
              <kbd>{key}</kbd>
              <span>{what}</span>
            </div>
          ))}
        </div>
      </div>
      <script id="api-index" type="application/json" dangerouslySetInnerHTML={{ __html: buildApiIndex() }} />
      <script src="/app.js" defer />
      {/* Cloudflare Web Analytics — cookieless beacon; token is public by design. */}
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={'{"token": "efb68a7bc53942bfb1ebb54c11e63714"}'} />
      {gaId && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          <script dangerouslySetInnerHTML={{ __html: gaSnippet(gaId) }} />
        </>
      )}
    </body>
  </html>
  )
}
