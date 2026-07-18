// The admin console shell — deliberately NOT the public Layout.
//
// It shares the design tokens (same palette, type, radii) so the console feels like the same
// product, but it renders none of the public chrome and, critically, none of the measurement stack:
// no Cloudflare Web Analytics beacon, no GA4 gtag, no /privacy-disclosed tracking of any kind.
// Operator sessions are not traffic, and admin URLs must never enter analytics or a search index.
//
// If you add analytics to Layout.tsx later, do NOT mirror it here.

import type { Child, FC } from 'hono/jsx'
import { Logo } from '../components/Logo'
import { FAVICON, THEME_BOOT } from '../lib/constants'

export type AdminTab = 'overview' | 'submissions' | 'subscribers' | 'catalog'

const NAV: ReadonlyArray<{ tab: AdminTab; href: string; label: string; glyph: string }> = [
  { tab: 'overview', href: '/admin', label: 'Overview', glyph: '◈' },
  { tab: 'submissions', href: '/admin/submissions', label: 'Submissions', glyph: '⇥' },
  { tab: 'subscribers', href: '/admin/subscribers', label: 'Subscribers', glyph: '✉' },
  { tab: 'catalog', href: '/admin/catalog', label: 'Approved', glyph: '◆' },
]

export const AdminLayout: FC<{
  title: string
  tab?: AdminTab
  /** Count badge on the Submissions tab — the only number worth surfacing globally. */
  pending?: number
  /** Rendered at the right of the page header (actions, filters). */
  actions?: Child
  children?: Child
}> = ({ title, tab, pending, actions, children }) => (
  <html lang="en" data-admin="1">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · shipapis admin</title>
      {/* Belt and braces with the X-Robots-Tag header set in admin-auth.ts. */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="referrer" content="same-origin" />
      <meta name="theme-color" content="#0b0c0f" />
      <link rel="icon" href={FAVICON} />
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <link rel="preload" href="/fonts/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossorigin="" />
      <link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossorigin="" />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body class="adm">
      <div class="adm-shell">
        <aside class="adm-side">
          <div class="adm-brand">
            <Logo size={20} />
            <span>shipapis</span>
            <span class="adm-brand-tag">admin</span>
          </div>
          <nav class="adm-nav" aria-label="Console">
            {NAV.map((n) => (
              <a class={`adm-nav-item${n.tab === tab ? ' on' : ''}`} href={n.href} aria-current={n.tab === tab ? 'page' : undefined}>
                <span class="adm-nav-glyph" aria-hidden="true">{n.glyph}</span>
                <span class="adm-nav-label">{n.label}</span>
                {n.tab === 'submissions' && !!pending && <span class="adm-pill">{pending}</span>}
              </a>
            ))}
          </nav>
          <div class="adm-side-foot">
            <a class="adm-nav-item adm-nav-quiet" href="/" target="_blank" rel="noopener">
              <span class="adm-nav-glyph" aria-hidden="true">↗</span>
              <span class="adm-nav-label">Live site</span>
            </a>
            <form method="post" action="/admin/logout">
              <button class="adm-nav-item adm-nav-quiet adm-logout" type="submit">
                <span class="adm-nav-glyph" aria-hidden="true">⎋</span>
                <span class="adm-nav-label">Sign out</span>
              </button>
            </form>
          </div>
        </aside>

        <main class="adm-main" id="main">
          <header class="adm-head">
            <h1>{title}</h1>
            {actions && <div class="adm-head-actions">{actions}</div>}
          </header>
          {children}
        </main>
      </div>
      <script src="/admin.js" defer />
    </body>
  </html>
)

/** Bare shell for /admin/login — no nav, no session, nothing to leak before auth. */
export const AdminAuthLayout: FC<{ title: string; children?: Child }> = ({ title, children }) => (
  <html lang="en" data-admin="1">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · shipapis</title>
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="referrer" content="same-origin" />
      <link rel="icon" href={FAVICON} />
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <link rel="stylesheet" href="/fonts/fonts.css" />
      <link rel="stylesheet" href="/styles.css" />
    </head>
    <body class="adm adm-auth-body">{children}</body>
  </html>
)
