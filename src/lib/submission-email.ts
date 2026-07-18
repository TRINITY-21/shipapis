// Transactional email to people who submit an API: one acknowledgement when it lands in the queue,
// one when it goes live. Both are optional — the submit form doesn't require an email address, and
// everything here no-ops when there's no address or no Resend key.
//
// These are transactional, not marketing: they're a direct reply to an action the person took, they
// carry no unsubscribe list, and they are the only two we send. We deliberately do NOT email on
// rejection — most rejects are spam, and replying to spam just confirms the address is live.

import { resendSend, type ResendEnv } from './resend'

const SITE = 'https://shipapis.dev'
const FROM = 'shipapis <submissions@shipapis.dev>'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Shared shell so both notices look like one product. Inlined styles — email clients drop <style>. */
function shell(bodyHtml: string, footNote: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f8;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b0c0f">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e8eb;border-radius:14px;padding:28px 26px">
    <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4d7c0f">shipapis</p>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e6e8eb;margin:22px 0 16px" />
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8f98">${footNote}</p>
  </div>
</body></html>`
}

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;padding:10px 18px;background:#4d7c0f;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px">${label}</a>`

const row = (label: string, value: string) =>
  `<tr>
     <td style="padding:6px 14px 6px 0;font-size:12px;color:#8a8f98;white-space:nowrap;vertical-align:top">${label}</td>
     <td style="padding:6px 0;font-size:13px;color:#0b0c0f;word-break:break-all">${value}</td>
   </tr>`

/* ---------- 1. received ---------- */

export async function sendSubmissionReceived(
  env: ResendEnv,
  to: string,
  api: { name: string; endpointUrl: string; docsUrl: string },
): Promise<boolean> {
  const name = esc(api.name)
  const html = shell(
    `<p style="margin:0 0 14px;font-size:17px;font-weight:600">Thanks — <strong>${name}</strong> is in the review queue.</p>
     <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#3a3d42">
       A human reads every submission. If it's a genuinely free, publicly reachable API, we add it to the
       directory and put it on our health-check schedule — which means it gets a real uptime and latency
       record, not just a listing.
     </p>
     <table style="border-collapse:collapse;margin:0 0 20px">
       ${row('API', name)}
       ${row('Endpoint', esc(api.endpointUrl))}
       ${row('Docs', esc(api.docsUrl))}
     </table>
     <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#3a3d42">
       We don't work to a fixed turnaround, and we don't list everything — APIs that need a card, block
       non-browser clients, or aren't actually free get declined. You'll hear from us again only if it goes live.
     </p>
     ${btn(SITE + '/browse', 'Browse the directory')}`,
    `You're getting this because someone submitted this API at shipapis.dev using this address. If that wasn't you, ignore this — nothing is published without review.`,
  )
  const text = `Thanks — ${api.name} is in the review queue.

A human reads every submission. If it's a genuinely free, publicly reachable API, we add it to the directory and put it on our health-check schedule.

API:      ${api.name}
Endpoint: ${api.endpointUrl}
Docs:     ${api.docsUrl}

We don't work to a fixed turnaround, and we don't list everything — APIs that need a card, block non-browser clients, or aren't actually free get declined. You'll hear from us again only if it goes live.

${SITE}/browse

You're getting this because someone submitted this API at shipapis.dev using this address.`

  return resendSend(env, { from: FROM, to, subject: `Received: ${api.name} is in the shipapis review queue`, html, text })
}

/* ---------- 2. approved ---------- */

export async function sendSubmissionApproved(
  env: ResendEnv,
  to: string,
  api: { name: string; slug: string; category: string },
): Promise<boolean> {
  const name = esc(api.name)
  const url = `${SITE}/api/${api.slug}`
  const html = shell(
    `<p style="margin:0 0 14px;font-size:17px;font-weight:600"><strong>${name}</strong> is live on shipapis. ✓</p>
     <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#3a3d42">
       It's in the directory now and queued for our health checker. Give it a day or so and the page will
       start showing real uptime, latency percentiles and an agent-access flag — measured by us, not
       claimed by the provider.
     </p>
     <table style="border-collapse:collapse;margin:0 0 20px">
       ${row('Listing', `<a href="${url}" style="color:#4d7c0f">${esc(url)}</a>`)}
       ${row('Category', esc(api.category))}
       ${row('Health', 'Not scored yet — appears after the first checks land')}
     </table>
     <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#3a3d42">
       Until then the page honestly shows no score rather than a made-up one. If anything on the listing is
       wrong, reply to this email and we'll correct it.
     </p>
     ${btn(url, 'View the listing')}`,
    `You're getting this because you submitted this API at shipapis.dev. This is a one-off notice, not a subscription.`,
  )
  const text = `${api.name} is live on shipapis.

It's in the directory now and queued for our health checker. Give it a day or so and the page will start showing real uptime, latency percentiles and an agent-access flag — measured by us, not claimed by the provider.

Listing:  ${url}
Category: ${api.category}
Health:   Not scored yet — appears after the first checks land

Until then the page honestly shows no score rather than a made-up one. If anything on the listing is wrong, reply to this email and we'll correct it.

You're getting this because you submitted this API at shipapis.dev. This is a one-off notice, not a subscription.`

  return resendSend(env, { from: FROM, to, subject: `${api.name} is live on shipapis`, html, text })
}
