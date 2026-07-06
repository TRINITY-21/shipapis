import type { FC } from 'hono/jsx'

import { tierBlurb, tierLabel } from '../../../data/check-tier'
import { endpointUrl, type ApiEntry } from '../../../data/seed'
import { Checked } from '../Checked'

const endpointsExportJson = (api: ApiEntry) =>
  JSON.stringify(
    {
      slug: api.slug,
      base_url: api.baseUrl,
      endpoints: api.endpoints.map((e) => ({
        method: e.method,
        path: e.path,
        url: endpointUrl(api.baseUrl, e.path),
        description: e.description,
        monitored: !!e.monitored,
      })),
    },
    null,
    2,
  )

const probeStatusLine = (api: ApiEntry) => {
  const monitored = api.endpoints.find((e) => e.monitored) ?? api.endpoints[0]
  const path = monitored?.path ?? api.sampleEndpoint
  if (api.checkTier === 'reachability') {
    if (api.status === 'healthy' || api.status === 'new' || api.status === 'resurrected') {
      return { tone: 'ok' as const, text: `Auth wall reachable — GET ${path} (key stripped)` }
    }
    if (api.status === 'degraded' || api.status === 'dying') {
      return { tone: 'warn' as const, text: `Reachability failing — server not answering on GET ${path}` }
    }
    if (api.status === 'dead') {
      return { tone: 'bad' as const, text: `Unreachable — GET ${path} not responding` }
    }
    return { tone: 'meh' as const, text: 'On schedule — auth-wall reachability checks pending' }
  }
  if (api.checkTier === 'docs') {
    return { tone: 'ok' as const, text: `Docs URL monitored — ${api.docsUrl}` }
  }
  switch (api.status) {
    case 'healthy':
    case 'new':
    case 'resurrected':
      return { tone: 'ok' as const, text: `Monitored path responding — GET ${path}` }
    case 'degraded':
      return { tone: 'warn' as const, text: `Degraded — intermittent failures on GET ${path}` }
    case 'dying':
      return { tone: 'warn' as const, text: `Dying — error rate climbing on GET ${path}` }
    case 'dead':
      return { tone: 'bad' as const, text: `Offline — GET ${path} no longer responds reliably` }
    default:
      return {
        tone: 'meh' as const,
        text: api.monitoredSince
          ? `First rollup pending — GET ${path} has been probed`
          : `On schedule — GET ${path} awaits first probe`,
      }
  }
}

export const EndpointsPanel: FC<{ api: ApiEntry }> = ({ api }) => {
  const probe = probeStatusLine(api)
  const exportJson = endpointsExportJson(api)
  return (
    <section class="detail-block" id="endpoints">
      <div class="detail-block-head">
        <span class="k">Endpoints · {api.endpoints.length}</span>
        <span class="k muted">{tierLabel(api.checkTier, api.status)}</span>
        <a class="k" href={api.docsUrl} target="_blank" rel="noopener">
          FULL DOCS ↗
        </a>
      </div>

      <div class={`ep-probe ep-probe-${probe.tone}`} role="status">
        <span class="ep-probe-dot" aria-hidden="true">●</span>
        <span class="ep-probe-txt">{probe.text}</span>
        {api.p50 > 0 && api.status !== 'dead' && api.status !== 'unmonitored' && (
          <span class="ep-probe-lat num">{api.p50} ms</span>
        )}
        {api.status !== 'unmonitored' && api.status !== 'dead' && (
          <Checked min={api.lastCheckedMin} />
        )}
      </div>

      <div class="ep-list" role="list">
        {api.endpoints.map((ep) => {
          const url = endpointUrl(api.baseUrl, ep.path)
          return (
            <div class={`ep-row${ep.monitored ? ' ep-row-monitored' : ''}`} role="listitem">
              <div class="ep-row-main">
                <span class={`ep-method ep-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
                <code class="ep-path">{ep.path}</code>
                {ep.monitored && <span class="ep-chip">PROBED</span>}
                <button class="ep-copy" type="button" data-copy={url} title="Copy full URL">
                  COPY URL
                </button>
              </div>
              <p class="ep-desc">{ep.description}</p>
            </div>
          )
        })}
      </div>

      <div class="ep-export">
        <div class="ep-export-copy">
          <b>Machine-readable spec</b>
          <p>{tierBlurb(api.checkTier)} Export includes every documented route below.</p>
        </div>
        <button class="btn" type="button" data-copy={exportJson}>
          Copy JSON
        </button>
      </div>
    </section>
  )
}
