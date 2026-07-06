import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const TermsPage: FC = () => (
  <Layout
    title="Terms — use the data, mind the caveats · shipapis"
    desc="shipapis terms in plain language: catalog and health data are CC-BY-4.0, the meta-API is free and no-auth, and health scores are measurements — not promises."
    path="/terms"
  >
    <div class="wrap">
      <div class="page-head">
        <h1>Terms.</h1>
        <p class="comment">last updated 2026-07-05 · plain language on purpose</p>
      </div>

      <div class="panel mt-24 prose">
        <span class="k">The service</span>
        <p>
          shipapis is a directory of third-party free APIs plus monitoring data about them, provided
          as-is, free of charge. We work hard to keep the numbers honest; we don't guarantee them.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">Data license</span>
        <p>
          The catalog and health data — listings, scores, uptime history, everything served by the
          meta-API and snapshots — are licensed <b>CC-BY-4.0</b>: free to use, republish, index and
          train on, with attribution to <b>shipapis.dev</b>. The site's code, name and logo are not
          part of that license.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">No warranty</span>
        <p>
          Health scores and uptime numbers are <b>measurements of past behavior, not promises about
          the future</b>. Don't use them as the sole basis for safety-critical or financial
          decisions. A 100 today can be a tombstone next month — that's the whole reason this site
          exists.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">The meta-API</span>
        <p>
          Free and no-auth, rate-limited per IP. Bulk consumers should use the{' '}
          <a href="/data/apis.json">static snapshots</a>, which are unlimited and cache-friendly.
          Don't hammer the origin; we honor the same etiquette toward the APIs we monitor and expect
          it back.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">Third-party APIs</span>
        <p>
          The APIs listed here belong to their providers. A listing is <b>not</b> an endorsement,
          affiliation or license — your use of any listed API is governed by that provider's own
          terms. API owners can correct metadata, dispute a score, or opt out at{' '}
          <a href="mailto:hello@shipapis.dev">hello@shipapis.dev</a>.
        </p>
      </div>

      <div class="panel prose mb-64">
        <span class="k">Changes</span>
        <p>
          These terms may change as the project grows; the "last updated" date above moves when they
          do. Material changes get called out, not buried.
        </p>
      </div>
    </div>
  </Layout>
)
