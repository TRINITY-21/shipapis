import type { FC } from 'hono/jsx'
import { categories } from '../../data/seed'
import { Chev } from '../components/Chev'
import { PickMenu } from '../components/PickMenu'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const SubmitPage: FC<{ siteKey?: string }> = ({ siteKey }) => (
  <Layout
    title="Submit a free API — live-validated before it queues · shipapis"
    desc="Submit a free public API to the shipapis directory. Your endpoint is probed live before it queues and verified again before listing."
    path="/submit"
    jsonLd={breadcrumbLd([['Home', '/'], ['Submit an API']])}
  >
    <div class="wrap">
      <div class="page-head">
        <h1>Submit a free API.</h1>
        <p>
          We list what we can verify. Your submission is probed live from this page, and a failed
          browser probe doesn't disqualify it — CORS blocks browsers, not our checker. Every
          submission is verified again before it lists.
        </p>
      </div>
      <form class="submit-form mt-24 mb-64" id="submit-form">
        <div class="sf-grid">
          <label class="sf-field">
            <span class="k">API name *</span>
            <input name="name" type="text" required placeholder="Open-Meteo" autocomplete="off" />
          </label>
          <label class="sf-field">
            <span class="k">Category *</span>
            <PickMenu
              name="category"
              required
              class="sf-pick"
              value={categories[0]?.slug ?? ''}
              options={categories.map((c) => ({ value: c.slug, label: c.name }))}
              ariaLabel="Category"
            />
          </label>
          <label class="sf-field">
            <span class="k">Base URL · https only *</span>
            <input
              name="base_url"
              type="url"
              required
              pattern="https://.*"
              placeholder="https://api.example.com/v1"
              autocomplete="off"
            />
          </label>
          <label class="sf-field">
            <span class="k">Sample endpoint · a real documented GET *</span>
            <input name="sample_endpoint" type="text" required placeholder="/forecast?latitude=52.52" autocomplete="off" />
          </label>
          <label class="sf-field">
            <span class="k">Docs URL *</span>
            <input name="docs_url" type="url" required placeholder="https://example.com/docs" autocomplete="off" />
          </label>
          <label class="sf-field">
            <span class="k">Auth</span>
            <PickMenu
              name="auth"
              class="sf-pick"
              value="none"
              options={[
                { value: 'none', label: 'none — no key, no signup' },
                { value: 'apiKey', label: 'API key · free signup' },
                { value: 'oauth', label: 'OAuth' },
                { value: 'userAgent', label: 'identified User-Agent required' },
              ]}
              ariaLabel="Auth type"
            />
          </label>
          <label class="sf-field">
            <span class="k">Your email · optional</span>
            <input name="email" type="email" placeholder="you@ship.dev — only if you want a reply" autocomplete="email" />
          </label>
          <label class="sf-field sf-wide">
            <span class="k">Notes · optional</span>
            <input name="notes" type="text" placeholder="rate limits, license, anything we should know" autocomplete="off" />
          </label>
        </div>

        {/* Honeypot — off-screen, not for humans. A filled value is silently dropped server-side. */}
        <div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden">
          <label>
            Company
            <input name="company" type="text" tabindex={-1} autocomplete="off" />
          </label>
        </div>

        {siteKey ? (
          <div class="sf-turnstile mt-16" data-sitekey={siteKey}>
            <div class="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
          </div>
        ) : null}

        <div class="actions mt-16">
          <button type="submit" class="btn btn-accent">▶ Validate & submit</button>
          <span class="k muted sf-fallback">
            or email <a href="mailto:hello@shipapis.dev">hello@shipapis.dev</a>
          </span>
        </div>

        <div class="codeblock try-out mt-16" hidden>
          <div class="try-status" aria-live="polite" />
          <pre>
            <code class="try-body" />
          </pre>
        </div>

        <div id="submit-result" class="submit-result mt-16" role="status" aria-live="polite" hidden />
      </form>
    </div>
    {siteKey ? <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer /> : null}
  </Layout>
)
