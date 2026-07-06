import type { FC } from 'hono/jsx'
import type { LifecycleStatus } from '../../data/seed'
import { StatusBadge } from '../components/StatusBadge'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const MethodologyPage: FC = () => (
  <Layout
    title="API health score methodology — how we measure uptime · shipapis"
    desc="How shipapis scores probed APIs: 60% uptime, 20% latency vs category, 20% response-shape stability — plus lifecycle rules and probe etiquette. Catalogued-only APIs have no score until probed."
    path="/methodology"
    jsonLd={breadcrumbLd([['Home', '/'], ['Methodology']])}
  >
    <div class="wrap">
      <div class="page-head">
        <h1>How we score.</h1>
        <p>
          Trust requires showing the math. Scores apply only to APIs on our probe schedule — catalogued
          imports show no score until the first check lands.
        </p>
      </div>
      <div class="panel mt-24" style="max-width:720px">
        <span class="k">The health score</span>
        <div class="uptime-summary" role="group" aria-label="Health score weights">
          <div class="cell">
            <span class="v num">60%</span>
            <span class="k">Uptime · 90d</span>
          </div>
          <div class="cell">
            <span class="v num">20%</span>
            <span class="k">Latency · vs category</span>
          </div>
          <div class="cell">
            <span class="v num">20%</span>
            <span class="k">Shape stability</span>
          </div>
        </div>
        <div class="codeblock">
          <pre>
            <code>{`health = round(
  ( uptime_90d          × 0.60   // fraction of checks OK
  + latency_factor      × 0.20   // p50 vs category median
  + shape_stability     × 0.20   // schema-drift penalty
  ) × 100
)`}</code>
          </pre>
        </div>
        <p class="mt-16" style="font-size:14px;color:var(--text-2);max-width:65ch">
          Checks hit <b>real documented endpoints</b> — never bare homepages. Failures are classified
          (timeout, DNS, 4xx, 5xx, bot-challenge); endpoints our infrastructure cannot verify are marked
          <b> unverifiable</b>, never “down.”
        </p>
      </div>
      <div class="panel" style="max-width:720px">
        <span class="k">Lifecycle · grace before judgment</span>
        <div class="rows">
          {[
            ['DEGRADED', '3+ consecutive failed checks'],
            ['DYING', '7 days of elevated error rate'],
            ['DEAD', '30 days at ~100% failure → archived in the graveyard'],
            ['RESURRECTED', 'a dead API that came back — it happens'],
          ].map(([state, rule]) => (
            <div class="row" style="grid-template-columns: 140px minmax(0,1fr)">
              <StatusBadge status={state.toLowerCase() as LifecycleStatus} />
              <span style="font-size:13.5px;color:var(--text-2)">{rule}</span>
            </div>
          ))}
        </div>
      </div>
      <div class="panel mb-64" style="max-width:720px">
        <span class="k">Etiquette</span>
        <p style="font-size:14px;color:var(--text-2);max-width:65ch">
          Our checker identifies itself as <span class="num">shipapisbot/1.0</span> with a contact URL, honors{' '}
          <span class="num">429</span> and <span class="num">Retry-After</span>, never load-tests, and any
          API owner can adjust metadata, dispute a score, or opt out entirely — opted-out APIs show{' '}
          <b>UNMONITORED</b>, never a fabricated number.
        </p>
      </div>
    </div>
  </Layout>
)
