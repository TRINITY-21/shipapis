import type { FC } from 'hono/jsx'
import { AgentPrompt } from '../components/AgentPrompt'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { SITE } from '../lib/constants'
import { hlJson } from '../lib/format'
import { breadcrumbLd } from '../lib/seo'

export const DevelopersPage: FC = () => {
  const mcp = `{
  "mcpServers": {
    "shipapis": {
      "url": "https://shipapis.dev/mcp"
    }
  }
}`
  return (
    <Layout
      title="Free APIs for AI agents — MCP server & JSON API · shipapis"
      desc="Wire shipapis into your coding agent: working MCP server, free no-auth JSON API, static snapshots (JSON + CSV), OpenAPI 3.1 spec and llms.txt. All CC-BY-4.0."
      path="/agents"
      jsonLd={[
        breadcrumbLd([['Home', '/'], ['Agents']]),
        {
          '@type': 'Dataset',
          name: 'shipapis — free public API catalog with live health data',
          description:
            'Catalog of free public APIs with measured health on probed endpoints: lifecycle status, uptime, latency, auth/CORS metadata and response-shape history.',
          url: `${SITE}/agents`,
          license: 'https://creativecommons.org/licenses/by/4.0/',
          isAccessibleForFree: true,
          creator: { '@type': 'Organization', name: 'shipapis', url: SITE },
          distribution: [
            { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/data/apis.json` },
            { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}/data/apis.csv` },
          ],
        },
      ]}
    >
      <div class="wrap">
        <div class="page-head">
          <h1>Wire shipapis into your agent.</h1>
          <p>
            The catalog — metadata, health scores on probed APIs, uptime history — is a free, no-auth JSON API.
            Check <a href="/data/status.json">/data/status.json</a> for coverage and freshness before citing health numbers.
            Rate-limited per IP; bulk consumers should use the static snapshots.
          </p>
        </div>

        <div class="mt-24">
          <AgentPrompt />
        </div>

        <div class="panel mt-24">
          <span class="k">Endpoints · v1</span>
          <div class="rows">
            {[
              ['GET /api/v1/best?task=', 'One probed answer for a task — curl + fallbacks (START HERE)'],
              ['GET /data/status.json', 'Coverage, freshness, agent entry links'],
              ['GET /data/index.json?probed=true', 'Slim index — probed APIs only'],
              ['GET /api/v1/apis', 'List APIs — integration-ready records. Filters: ?probed=true &category= &auth=none &status=healthy &limit= &offset='],
              ['GET /api/v1/search?q=', 'Ranked keyword search — add &probed=true to skip catalogued-only'],
              ['GET /api/v1/apis/{slug}', 'Full integration record: base_url, auth, curl, sample, health'],
              ['GET /api/v1/apis/{slug}/history', 'Daily uptime & latency rollups, last 90 days'],
              ['GET /api/v1/categories', 'Categories with counts'],
              ['GET /api/v1/random', 'One random healthy API — great for demos'],
              ['GET /data/categories/{cat}.json', 'Full records for one category'],
              ['GET /data/apis.json', 'Full snapshot — prefer probed slices'],
              ['GET /data/health.json', 'Up/down-only snapshot, keyed by slug'],
            ].map(([sig, desc]) => (
              <div class="row row-sig">
                <span class="num" style="font-size:12.5px;color:var(--accent)">{sig}</span>
                <span style="font-size:13px;color:var(--text-2)">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div class="panel mt-24" id="mcp">
          <span class="k">MCP server · for Claude Code, Cursor & friends — <b style="color:var(--accent)">LIVE at /mcp</b></span>
          <div class="codeblock">
            <button class="copy" data-copy={mcp} data-track="mcp_snippet">COPY</button>
            <pre>
              <code dangerouslySetInnerHTML={{ __html: hlJson(JSON.parse(mcp)) }} />
            </pre>
          </div>
          <p class="mt-8" style="font-size:13px;color:var(--text-3)">
            Tools: <span class="num">best_api · search_apis · get_api · get_api_health · list_categories · suggest_api_for_task</span> —
            best_api and search_apis prefer probed APIs; pass <span class="num">probed: true</span> to exclude catalogued-only rows.
          </p>
          <p class="mt-16" style="font-size:13px;color:var(--text-2)">One-liner for Claude Code:</p>
          <div class="codeblock mt-8">
            <button class="copy" data-copy="claude mcp add --transport http shipapis https://shipapis.dev/mcp" data-track="mcp_install">COPY</button>
            <pre>
              <code>claude mcp add --transport http shipapis https://shipapis.dev/mcp</code>
            </pre>
          </div>
        </div>

        <div class="panel mt-24" id="agent-files">
          <span class="k">Agent files · machine entry points</span>
          <div class="rows">
            {[
              ['/llms.txt', 'Agent instructions: data ladder, record schema, access steps'],
              ['/agents.md', 'The agent contract — goal → endpoint routing table'],
              ['/openapi.json', 'OpenAPI 3.1 spec for this meta-API'],
              ['/.well-known/api-catalog', 'RFC 9727 linkset — yes, a real one'],
              ['/feed.xml', 'Additions & deaths, RSS'],
              ['/graveyard.xml', 'Deaths only — the feed nobody else has'],
            ].map(([sig, desc]) => (
              <div class="row row-sig">
                <a class="num" style="font-size:12.5px;color:var(--accent)" href={sig}>{sig}</a>
                <span style="font-size:13px;color:var(--text-2)">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div class="panel mt-24 mb-64" id="submit">
          <span class="k">Submit an API</span>
          <p style="font-size:14px;color:var(--text-2);max-width:60ch">
            Every submission runs a live probe before a human ever sees it, and gets verified again
            before listing. <a href="/submit" style="color:var(--accent)">Submit an API<Chev /></a>
          </p>
        </div>
      </div>
    </Layout>
  )
}
