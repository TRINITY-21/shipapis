import type { FC } from 'hono/jsx'
import { catalogCounts } from '../../data/catalog'
import { Layout } from '../layout/Layout'
import { breadcrumbLd, ORG_LD } from '../lib/seo'

export const AboutPage: FC = () => {
  const counts = catalogCounts()
  return (
  <Layout
    title="About shipapis — the free-API directory that checks its own links"
    desc="An independent directory of free public APIs. We probe endpoints on a schedule, show uptime and latency, and archive APIs when they die."
    path="/about"
    jsonLd={[breadcrumbLd([['Home', '/'], ['About']]), ORG_LD]}
  >
    <div class="wrap">
      <div class="page-head">
        <h1>The directory that checks its own links.</h1>
        <p class="comment">an independent project. one worker, a probe schedule, and a grudge against dead tutorials.</p>
      </div>

      <div class="panel mt-24 prose">
        <span class="k">What this is</span>
        <p>
          shipapis is a directory of free public APIs — weather, photos, exchange rates, and hundreds more.
          For APIs on our probe schedule (<b class="num">{counts.scheduled}</b> today — <b class="num">{counts.monitored}</b>{' '}
          probed, <b class="num">{counts.queued}</b> queued — out of <b class="num">{counts.total}</b> catalogued),
          we hit a real documented endpoint on a regular cadence and show uptime history,
          latency, CORS behavior, and the free-tier fine print. Listed-only entries stay metadata
          until we add them to monitoring.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">Why it exists</span>
        <p>
          Every "awesome free APIs" list rots. Endpoints die, schemas drift, free tiers quietly grow
          teeth — and the list keeps ranking in search, wasting an afternoon at a time. A directory
          should know when its own links die. Ours does: dead APIs are declared, dated and archived
          in the <a href="/graveyard">graveyard</a> with their final response shape, so the tutorial
          you found in 2023 can at least be understood.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">How it works</span>
        <p>
          A monitoring sweep runs every 15 minutes across probed APIs, hitting one real documented
          endpoint per API and recording status, latency and response shape. Scores are computed
          from a <a href="/methodology">published formula</a> — uptime, latency versus category,
          schema stability. The same data feeds the pages, the{' '}
          <a href="/agents">meta-API</a>, the MCP server and the static snapshots, so humans and
          AI agents read from one source of truth.
        </p>
      </div>

      <div class="panel">
        <span class="k">The rules we hold ourselves to</span>
        <div class="rows about-rules">
          {[
            ['NO PAID PLACEMENT', 'Rankings come from the formula. Sponsorship, when it exists, is labeled and never mixed into results.'],
            ['EVERY METRIC LABELED', 'What was measured and over which window — always. No naked numbers.'],
            ['NEVER CLAIM BEYOND THE CHECKER', 'If our infrastructure can’t verify something, it’s marked unverifiable — never "down", never invented.'],
            ['OWNERS STAY IN CONTROL', 'Any API owner can correct metadata, dispute a score, or opt out entirely — opted-out APIs show UNMONITORED.'],
            ['OPEN DATA', 'The catalog and health data are CC-BY-4.0 — free to use, index and train on, with attribution.'],
          ].map(([rule, detail]) => (
            <div class="row">
              <span class="k" style="letter-spacing:0.08em">{rule}</span>
              <span style="font-size:13.5px;color:var(--text-2)">{detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="panel prose mb-64">
        <span class="k">Contact</span>
        <p>
          Corrections, disputes, submissions, anything else:{' '}
          <a href="mailto:hello@shipapis.dev">hello@shipapis.dev</a>. To list an API, use{' '}
          <a href="/submit">the submit page</a> — it probes your endpoint live before it queues.
        </p>
      </div>
    </div>
  </Layout>
  )
}
