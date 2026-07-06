import type { FC } from 'hono/jsx'
import type { ApiEntry } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { BarsLegend } from '../components/BarsLegend'
import { ScoreRing } from '../components/ScoreRing'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
import { scoreRingProps } from '../lib/score-ring'
import { CMP_META } from './compare-meta'

export const ComparePage: FC<{ a: ApiEntry; b: ApiEntry }> = ({ a, b }) => {
  // Bold only objectively better numbers; qualitative facts stay neutral.
  const winner = (dir: 'good-high' | 'good-low' | null, va: string, vb: string): 0 | 1 | -1 => {
    if (!dir) return -1
    const na = parseFloat(va)
    const nb = parseFloat(vb)
    if (!isFinite(na) || !isFinite(nb) || na === nb) return -1
    return (dir === 'good-high' ? na > nb : na < nb) ? 0 : 1
  }
  return (
    <Layout
      title={`${a.name} vs ${b.name} — live health compared · shipapis`}
      desc={`${a.name} and ${b.name} compared on live monitoring data: uptime, latency, auth, CORS and the free-tier fine print.`}
      path={`/compare/${a.slug}/${b.slug}`}
      /* /compare/a/b and /compare/b/a are the same sheet mirrored — canonical is slug-alphabetical */
      canonical={`/compare/${[a.slug, b.slug].sort().join('/')}`}
      jsonLd={breadcrumbLd([['Home', '/'], [`${a.name} vs ${b.name}`]])}
    >
      <div class="wrap">
        <div class="page-head">
          <h1>
            {a.name} <span class="dim">vs</span> {b.name}
          </h1>
          <p>Same instrument, two spec sheets — measured, not claimed.</p>
        </div>
        <div class="cmp mt-24" role="table" aria-label={`${a.name} and ${b.name} compared`}>
          <div class="cmp-row cmp-top" role="row">
            <span class="k" role="columnheader">API</span>
            {[a, b].map((x) => (
              <a class="cmp-api" href={`/api/${x.slug}`} role="columnheader">
                <ApiGlyph api={x} displayPx={40} />
                <span class="cmp-name">
                  <b>{x.name}</b>
                  <StatusBadge status={x.status} checkTier={x.checkTier} />
                </span>
                <ScoreRing {...scoreRingProps(x)} />
              </a>
            ))}
          </div>
          <div class="cmp-row cmp-bars" role="row">
            <span class="k" role="rowheader">Uptime · 30d</span>
            <span role="cell"><UptimeBars api={a} days={30} /></span>
            <span role="cell"><UptimeBars api={b} days={30} /></span>
          </div>
          {CMP_META.map(([label, get, dir]) => {
            const va = get(a)
            const vb = get(b)
            const w = winner(dir, va, vb)
            return (
              <div class="cmp-row" role="row">
                <span class="k" role="rowheader">{label}</span>
                <span class="num" role="cell">{w === 0 ? <b>{va}</b> : va}</span>
                <span class="num" role="cell">{w === 1 ? <b>{vb}</b> : vb}</span>
              </div>
            )
          })}
        </div>
        <div class="cmp-legend mb-64">
          <BarsLegend />
        </div>
      </div>
    </Layout>
  )
}

/* ---------- OG cards — 1200×630 render targets for scripts/og.mjs (not linked in nav) ---------- */
