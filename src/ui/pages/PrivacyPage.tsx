import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const PrivacyPage: FC = () => (
  <Layout
    title="Privacy — what we collect (very little) · shipapis"
    desc="The shipapis privacy policy in plain language: no accounts, no ads, no sale of data. Cloudflare Web Analytics, Google Analytics 4, server logs — that's it."
    path="/privacy"
    jsonLd={breadcrumbLd([['Home', '/'], ['Privacy']])}
  >
    <div class="wrap">
      <div class="page-head">
        <h1>Privacy.</h1>
        <p class="comment">last updated 2026-07-08 · plain language on purpose</p>
      </div>

      <div class="panel mt-24 prose">
        <span class="k">The short version</span>
        <p>
          No accounts, no ads, no sale of data. We run a directory, not an audience business. We use
          two analytics tools to understand traffic: Cloudflare Web Analytics (cookieless) and Google
          Analytics 4 (page views and engagement). Details below.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">What we collect</span>
        <p>
          <b>Server logs.</b> The site runs on Cloudflare Workers. Requests produce standard
          operational logs (IP address, user agent, requested URL) used to run and protect the
          service — Cloudflare processes these as our infrastructure provider.
        </p>
        <p>
          <b>Cloudflare Web Analytics.</b> A privacy-first, cookieless beacon that counts page views
          and performance in aggregate. It sets no cookies, does no cross-site tracking, and builds
          no profile of you.
        </p>
        <p>
          <b>Google Analytics 4.</b> We load Google's gtag.js to measure page views and basic
          engagement (which pages get used). Google may set cookies / identifiers under Google's
          privacy policy and process data as described there. We configure{' '}
          <code>anonymize_ip</code> where GA still respects it. We do not use Google Ads or remarketing
          from this site.
        </p>
        <p>
          <b>Your theme choice.</b> Light/dark preference is stored in your browser's localStorage.
          It never leaves your device.
        </p>
        <p>
          <b>Submissions.</b> If you submit an API, we store what you send — the API details and,
          only if you choose to give it, your email — to review the listing and reply. A Cloudflare
          Turnstile check guards the form; it's a privacy-preserving CAPTCHA, not an ad tracker.
        </p>
        <p>
          <b>Newsletter.</b> If you subscribe to the signal, we store your email address to send it —
          nothing else, never sold or shared. Unsubscribe any time by replying.
        </p>
      </div>

      <div class="panel prose">
        <span class="k">The try-it console</span>
        <p>
          When you press <b>▶ Run it</b> on an API page, the request goes{' '}
          <b>directly from your browser to that API's servers</b> — nothing is proxied through us,
          and we never see the request or the response. The provider's own privacy policy applies to
          that call.
        </p>
      </div>

      <div class="panel prose mb-64">
        <span class="k">Questions</span>
        <p>
          <a href="mailto:hello@shipapis.dev">hello@shipapis.dev</a> — we'll answer in plain
          language too.
        </p>
      </div>
    </div>
  </Layout>
)
