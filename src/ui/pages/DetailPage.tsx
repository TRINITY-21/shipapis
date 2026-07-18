import type { FC } from 'hono/jsx'
import { catApisInCategory, isMonitored } from '../../data/catalog'
import { tierBlurb } from '../../data/check-tier'
import { categoryBySlug, uptimePct, type ApiEntry } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { BarsLegend } from '../components/BarsLegend'
import { Checked } from '../components/Checked'
import { Chev } from '../components/Chev'
import { Chips } from '../components/Chips'
import { Faq } from '../components/Faq'
import { ScoreRing } from '../components/ScoreRing'
import { Sparkline } from '../components/Sparkline'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { EndpointsPanel } from '../components/detail/EndpointsPanel'
import { SNIPPETS } from '../components/detail/snippets'
import { Layout } from '../layout/Layout'
import { apiFaqItems } from '../lib/faq'
import { esc, fmtAdded, hlJson, lastCheckShort } from '../lib/format'
import { metaFields, metaSourceLabel } from '../lib/meta-field'
import { scoreRingProps } from '../lib/score-ring'
import { breadcrumbLd, detailDesc, detailTitle, faqLd, webApiLd } from '../lib/seo'

export const DetailPage: FC<{ api: ApiEntry }> = ({ api }) => {
  const cat = categoryBySlug.get(api.category)!
  const probed = isMonitored(api)
  const similar = catApisInCategory(api.category)
    .filter((a) => a.slug !== api.slug)
    .sort((a, b) => Number(isMonitored(b)) - Number(isMonitored(a)) || b.healthScore - a.healthScore)
    .slice(0, 4)
  const snippets = SNIPPETS(api)
  const metadata = metaFields(api)
  const pendingMeta = metadata.some((m) => m.source === 'pending')
  const sampleUrl = `${api.baseUrl}${api.sampleEndpoint}`
  const canRun = api.cors === 'yes' && api.https && api.status !== 'dead'
  const metaCurl = `curl 'https://shipapis.dev/api/v1/apis/${api.slug}'`
  const badgeMd = `[![API health — shipapis](https://shipapis.dev/badge/${api.slug}.svg)](https://shipapis.dev/api/${api.slug})`
  // Agent-context paste blob (Δ4 #11a) — rendered from the same fields as the page, so it can never disagree with it.
  const agentCtx =
    `// ${api.slug} · ${api.status.toUpperCase()} · health ${api.healthScore < 0 ? '—' : api.healthScore} · auth ${api.auth} · cors ${api.cors}\n` +
    JSON.stringify(
      {
        base_url: api.baseUrl,
        sample: sampleUrl,
        auth: api.auth,
        status: api.status,
        commercial_use: api.commercialUse,
        docs: api.docsUrl,
        record: `https://shipapis.dev/api/v1/apis/${api.slug}`,
      },
      null,
      2,
    )
  const ring = scoreRingProps(api)
  const faq = apiFaqItems(api, cat.name)
  return (
    <Layout
      title={detailTitle(api, cat.name)}
      desc={detailDesc(api, cat.name)}
      path={`/api/${api.slug}`}
      og={`/og/api-${api.slug}.png`}
      ogAlt={
        probed
          ? `${api.name} health card: score ${api.healthScore < 0 ? '—' : api.healthScore}, ${uptimePct(api)}% uptime over 90 days`
          : `${api.name} — catalogued free API, not yet probed by shipapis`
      }
      jsonLd={[
        breadcrumbLd([['Home', '/'], [`Free ${cat.name} APIs`, `/c/${cat.slug}`], [api.name]]),
        webApiLd(api, cat.name),
        faqLd(faq),
      ]}
    >
      <div class="wrap detail-page">
        <header class="detail-head">
          <div class="detail-main">
            <div class="detail-headline">
              <ApiGlyph api={api} displayPx={56} />
              <h1>{api.name}</h1>
            </div>
            <div class="detail-title">
              <p class="tagline">{api.tagline}</p>
              <div class="line">
                <a class="cat-pill" href={`/c/${cat.slug}`}>{cat.emoji} {cat.name}</a>
                <StatusBadge status={api.status} checkTier={api.checkTier} />
                {probed && <Checked min={api.lastCheckedMin} />}
              </div>
              <div class="line line-chips">
                <Chips api={api} />
              </div>
              <p class="detail-desc">{api.description}</p>
            </div>
          </div>
          <div class="detail-aside">
            <span class="score-block">
              <ScoreRing score={ring.score} title={ring.title} lg />
              <a class="score-info k" href="/methodology">
                {api.checkTier === 'reachability'
                  ? 'REACHABILITY SCORE ⓘ'
                  : api.checkTier === 'docs'
                    ? 'DOCS SCORE ⓘ'
                    : "HOW IT'S SCORED ⓘ"}
              </a>
            </span>
            <div class="detail-actions">
              {canRun && (
                <a class="btn btn-accent" href="#try" data-run-live>
                  ▶ Run live
                </a>
              )}
              <a class="btn" href={api.docsUrl} target="_blank" rel="noopener">
                Docs ↗
              </a>
            </div>
            <div class="detail-badge">
              <span class="k">Status badge · for your README</span>
              <img
                class="badge-preview"
                src={`/badge/${api.slug}.svg`}
                alt={`shipapis health badge: ${api.healthScore < 0 ? '—' : api.healthScore} · ${api.status}`}
                height={20}
              />
              <button class="copy-md" data-copy={badgeMd} data-track="badge_markdown">COPY MARKDOWN</button>
            </div>
          </div>
        </header>

        {api.status === 'dead' && (
          <div class="dead-band">
            <span class="k">🪦 DEAD{api.diedAt ? ` · † ${api.diedAt}` : ''}</span>
            {api.epitaph && <span class="epitaph">{api.epitaph}</span>}
            <a class="k" href="/graveyard">THE GRAVEYARD<Chev /></a>
          </div>
        )}

        {!probed && api.status !== 'dead' && (
          <div class="catalogue-band" role="note">
            <span class="k">
              {api.checkTier === 'listed' ? 'CATALOGUED · NOT ON PROBE SCHEDULE' : 'ON PROBE SCHEDULE'}
            </span>
            <p>
              {tierBlurb(api.checkTier)}{' '}
              <a href={api.docsUrl} target="_blank" rel="noopener">Open provider docs ↗</a>
            </p>
          </div>
        )}

        {probed && api.checkTier !== 'endpoint' && api.status !== 'dead' && (
          <div class="catalogue-band tier-band" role="note">
            <span class="k">CHECK TIER · {api.checkTier.toUpperCase()}</span>
            <p>{tierBlurb(api.checkTier)}</p>
          </div>
        )}

        <nav class="detail-nav" aria-label="On this page" data-detail-nav>
          <div class="detail-nav-main">
            <a href="#uptime">Uptime</a>
            <a href="#sample">Sample</a>
            <a href="#try">Call it</a>
            <a href="#endpoints">Endpoints ({api.endpoints.length})</a>
            <a href="#shape">Shape</a>
          </div>
          <div class="detail-nav-side">
            <a href="#metadata">Metadata</a>
          </div>
        </nav>

        <div class="detail-cols">
          <div class="detail-main">
            <section class="detail-block" id="uptime">
              <div class="detail-block-head">
                <span class="k">Uptime history</span>
                {!probed && <span class="k muted">starts after first probe</span>}
              </div>
              {probed ? (
                <>
                  <div class={`uptime-summary${api.checkTier === 'endpoint' ? '' : ' cols-3'}`}>
                    <div class="cell">
                      <span class="v num">{uptimePct(api)}%</span>
                      <span class="k">
                        {api.checkTier === 'reachability'
                          ? '90d reachable'
                          : api.checkTier === 'docs'
                            ? '90d docs up'
                            : '90 days'}
                      </span>
                    </div>
                    <div class="cell">
                      <span class="v num">{uptimePct(api, 30)}%</span>
                      <span class="k">
                        {api.checkTier === 'reachability'
                          ? '30d reachable'
                          : api.checkTier === 'docs'
                            ? '30d docs up'
                            : '30 days'}
                      </span>
                    </div>
                    {api.checkTier === 'endpoint' ? (
                      <>
                        <div class="cell">
                          <span class="v num">{api.p50 > 0 ? api.p50 : '—'}</span>
                          <span class="k">P50 · ms</span>
                        </div>
                        <div class="cell">
                          <span class="v num">{api.p95 > 0 ? api.p95 : '—'}</span>
                          <span class="k">P95 · ms</span>
                        </div>
                      </>
                    ) : (
                      <div class="cell">
                        <span class="v num">{lastCheckShort(api.lastCheckedMin)}</span>
                        <span class="k">
                          {api.checkTier === 'docs' ? 'Last docs check' : 'Last check'}
                          {api.monitoredSince ? ` · since ${fmtAdded(api.monitoredSince)}` : ''}
                          {api.agentAccess === 'blocked'
                            ? ' · bot-walled'
                            : api.agentAccess === 'ok'
                              ? ' · server OK'
                              : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div class="m-hide">
                    <UptimeBars api={api} days={90} tall anim />
                  </div>
                  <div class="m-only">
                    <UptimeBars api={api} days={30} tall />
                  </div>
                  <BarsLegend />
                  {api.latency48.length > 0 && api.checkTier === 'endpoint' && (
                    <div class="detail-sub">
                      <span class="k">Response time · last 48 checks</span>
                      <Sparkline points={api.latency48} />
                    </div>
                  )}
                </>
              ) : (
                <p class="tl-empty">
                  {api.checkTier === 'listed' ? (
                    <>
                      <b>Not on our probe schedule yet.</b> Catalog metadata only until we add this API to the checker.
                    </>
                  ) : (
                    <>
                      <b>On our probe schedule.</b> Uptime charts appear after the first check lands.
                    </>
                  )}
                </p>
              )}
            </section>

            {/* Console-approved APIs carry no captured response until the checker probes them.
                Showing the block empty would imply a payload we don't have — omit it instead. */}
            {api.sample != null && (
              <section class="detail-block" id="sample">
                <div class="detail-block-head">
                  <span class="k">{probed ? 'Live response sample' : 'Example response'}</span>
                  <span class="k muted">
                    {probed ? 'captured by our last successful check' : 'from provider docs — not verified by us'}
                  </span>
                </div>
                <div class="codeblock">
                  <button class="copy" data-copy={JSON.stringify(api.sample, null, 2)} data-track="sample_json">COPY</button>
                  <pre>
                    <code dangerouslySetInnerHTML={{ __html: `<span class="j-punc">GET</span> <span class="j-key">${esc(sampleUrl)}</span>\n\n${hlJson(api.sample)}` }} />
                  </pre>
                </div>
              </section>
            )}

            <section class="detail-block" id="try">
              <div class="detail-block-head">
                <span class="k">Call it</span>
                <span class="k muted">curl · fetch · python</span>
              </div>
              <div class="codeblock">
                <div class="tabs" role="tablist" aria-label="Code snippets">
                  {snippets.map((s, i) => (
                    <button
                      class={`tab${i === 0 ? ' on' : ''}`}
                      data-tab={String(i)}
                      role="tab"
                      id={`tab-${i}`}
                      aria-selected={i === 0 ? 'true' : 'false'}
                      aria-controls={`pane-${i}`}
                      tabindex={i === 0 ? 0 : -1}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {snippets.map((s, i) => (
                  <div
                    class={`tabpane${i === 0 ? ' on' : ''}`}
                    data-pane={String(i)}
                    role="tabpanel"
                    id={`pane-${i}`}
                    aria-labelledby={`tab-${i}`}
                  >
                    <button class="copy" data-copy={s.code} data-track={`snippet_${s.label.toLowerCase()}`}>COPY</button>
                    <pre>
                      <code>{s.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
              <div class="try">
                {/* secondary style on purpose — the header "▶ Run live" is the loud CTA; this is its landing target */}
                {canRun ? (
                  <button class="btn try-run" data-try-url={sampleUrl}>
                    ▶ Run it — live from your browser
                  </button>
                ) : (
                  <p class="try-note k">
                    {api.status === 'dead'
                      ? 'THIS API IS DEAD — NOTHING TO RUN'
                      : 'BROWSER CALLS BLOCKED (NO CORS/HTTPS) — USE THE CURL SNIPPET'}
                  </p>
                )}
                <div class="codeblock try-out" hidden>
                  <div class="try-status" aria-live="polite" />
                  <pre>
                    <code class="try-body" />
                  </pre>
                </div>
              </div>
            </section>

            <EndpointsPanel api={api} />

            <section class="detail-block" id="shape">
              <div class="detail-block-head">
                <span class="k">Response-shape history</span>
              </div>
              {api.shapeChanges.length ? (
                <div class="timeline">
                  {api.shapeChanges.map((c) => (
                    <div class="tl-item">
                      <span class="date">{c.date}</span>
                      <p>{c.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p class="tl-empty">
                  {probed ? (
                    <>
                      <b>Stable.</b> No schema drift observed since monitoring began — the response shape has
                      not changed under our checks.
                    </>
                  ) : (
                    <>
                      <b>Not tracked yet.</b> Shape-change history starts once this API joins our probe schedule.
                    </>
                  )}
                </p>
              )}
            </section>

            <Faq heading={`${api.name}: common questions`} items={faq} />
          </div>

          <aside class="detail-side">
            <div class="detail-side-inner">
            <section class="detail-block detail-block-side" id="metadata">
              <div class="detail-block-head">
                <span class="k">Metadata</span>
                {pendingMeta && <span class="k muted">some fields awaiting probe</span>}
              </div>
              <div class="meta-card meta-card-priority">
                {metadata.map((m) => (
                  <div class="meta-item">
                    <span class="k">
                      {m.label}
                      <span class={`meta-src meta-src-${m.source}`}>{metaSourceLabel(m.source)}</span>
                    </span>
                    <span class={`val ${m.tone ?? ''}`}>{m.value}</span>
                  </div>
                ))}
                <div class="meta-item"><span class="k">Base URL</span><button class="val copyable" data-copy={api.baseUrl} title="Click to copy">{api.baseUrl.replace('https://', '')}</button></div>
                <div class="meta-item"><span class="k">In directory since</span><span class="val">{api.addedAt}</span></div>
              </div>
            </section>

            <section class="detail-block detail-block-side">
              <div class="detail-block-head">
                <span class="k">Agent context</span>
                <span class="k muted">paste into chat</span>
              </div>
              <div class="codeblock agent-ctx">
                <button class="copy" data-copy={agentCtx} data-track="agent_context">COPY</button>
                <pre>
                  <code>{agentCtx}</code>
                </pre>
              </div>
              <p class="agent-ctx-note">Everything an agent needs to call {api.name} — from our last verified record.</p>
            </section>

            {similar.length > 0 && (
              <section class="detail-block detail-block-side">
                <div class="detail-block-head">
                  <span class="k">Similar · health-ranked</span>
                </div>
                <div class="similar">
                  {similar.map((s) => (
                    <div class="similar-row">
                      <a class="similar-main" href={`/api/${s.slug}`}>
                        <ApiGlyph api={s} variant="inline" class="glyph" displayPx={28} />
                        <b>{s.name}</b>
                        <span class="k num">{s.healthScore < 0 ? '—' : s.healthScore}</span>
                      </a>
                      {/* slug-alphabetical = ComparePage's canonical; linking the mirror instead
                          would send crawlers to a URL that only canonicalises back here */}
                      <a class="vs" href={`/compare/${[api.slug, s.slug].sort().join('/')}`} aria-label={`Compare ${api.name} with ${s.name}`}>
                        VS
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section class="detail-block detail-block-side detail-block-cta">
              <div class="meta-cta">
                <div class="detail-block-head">
                  <span class="k">This page, as JSON</span>
                </div>
                <div class="codeblock">
                  <button class="copy" data-copy={metaCurl} data-track="meta_api_curl">COPY</button>
                  <pre>
                    <code dangerouslySetInnerHTML={{ __html: `<span class="j-punc">$</span> ${esc(metaCurl)}` }} />
                  </pre>
                </div>
                <p>
                  Health, uptime & verified metadata — free, no auth. <a href="/agents">Meta-API docs<Chev /></a>
                </p>
              </div>
            </section>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
