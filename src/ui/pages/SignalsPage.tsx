import type { FC } from 'hono/jsx'
import { recentSignals, statusChanges } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const SignalsPage: FC = () => (
  <Layout
    title="Signal log — live API monitoring events · shipapis"
    desc="Status changes from our probe schedule — degradations, recoveries, and deaths among APIs we health-check."
    path="/signals"
    jsonLd={breadcrumbLd([['Home', '/'], ['Signal log']])}
  >
    <div class="wrap">
      <div class="page-head">
        <h1>Probe log.</h1>
        <p>
          Status changes from APIs on our probe schedule — degradations, recoveries, and deaths.
          How the numbers are made: <a href="/methodology" style="color:var(--accent)">methodology<Chev /></a>
        </p>
      </div>
      <div class="sig-board mt-24 mb-64">
        <div class="panel">
          <span class="k">Last sweep · notable</span>
          <div class="signals signals-full">
            {recentSignals.map((s) => (
              <a class="sig" href={`/api/${s.slug}`}>
                <i class={`sig-dot ${s.kind}`} aria-hidden="true" />
                <ApiGlyph slug={s.slug} variant="inline" class="emoji" />
                <b>{s.name}</b>
                <span class="num">{s.detail}</span>
                <span class="ago">{s.ago}</span>
              </a>
            ))}
          </div>
        </div>
        <div class="panel">
          <span class="k">Lifecycle changes</span>
          <div class="signals signals-full">
            {statusChanges.map((c) => (
              <a class="sig-change" href={`/api/${c.slug}`}>
                <ApiGlyph slug={c.slug} variant="inline" class="emoji" />
                <span class="who">{c.name}</span>
                <span class="arrow">{c.from.toUpperCase()}<Chev /></span>
                <b class={`to ${c.to}`}>{c.to.toUpperCase()}</b>
                <span class="ago">{c.when}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  </Layout>
)
