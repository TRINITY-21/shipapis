// Resend integration for "the signal" newsletter. D1 is the on-site source of truth for who
// subscribed; we mirror each subscriber into a Resend audience so you can compose + send broadcasts
// (with analytics + managed unsubscribe) from the Resend dashboard, and we send the transactional
// welcome here. Every call is best-effort and never throws — email must not break subscribe/unsub.

const RESEND_API = 'https://api.resend.com'
const SITE = 'https://shipapis.dev'
const FROM = 'shipapis · the signal <signal@shipapis.dev>'

export interface ResendEnv {
  RESEND_API_KEY?: string
  RESEND_AUDIENCE_ID?: string
}

function call(key: string, path: string, method: string, body?: unknown) {
  return fetch(`${RESEND_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Add (or re-activate) a contact in the Resend audience so broadcasts reach them. */
export async function resendAddContact(env: ResendEnv, email: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return
  try {
    await call(env.RESEND_API_KEY, `/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, 'POST', {
      email,
      unsubscribed: false,
    })
  } catch {
    /* best-effort — D1 already holds the subscriber */
  }
}

/** Mark the Resend contact unsubscribed so future broadcasts skip them. */
export async function resendUnsubscribeContact(env: ResendEnv, email: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return
  try {
    await call(
      env.RESEND_API_KEY,
      `/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`,
      'PATCH',
      { unsubscribed: true },
    )
  } catch {
    /* best-effort */
  }
}

const welcomeHtml = (unsubUrl: string) => `<!doctype html>
<html><body style="margin:0;background:#f6f7f8;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b0c0f">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e6e8eb;border-radius:14px;padding:28px 26px">
    <p style="margin:0 0 14px;font-size:16px"><strong>You're on the signal.</strong> ✓</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3a3d42">
      That's the occasional shipapis email — a few genuinely good free public APIs we've health-checked,
      and which ones died. No spam; a couple times a month at most.
    </p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#3a3d42">
      Meanwhile, the whole directory — live uptime, latency, auth rules — is at
      <a href="${SITE}" style="color:#3f6212">shipapis.dev</a>.
    </p>
    <hr style="border:none;border-top:1px solid #e6e8eb;margin:20px 0" />
    <p style="margin:0;font-size:12px;color:#8a8f98">
      You got this because you subscribed at shipapis.dev.
      <a href="${unsubUrl}" style="color:#8a8f98">Unsubscribe</a> anytime.
    </p>
  </div>
</body></html>`

const welcomeText = (unsubUrl: string) =>
  `You're on the signal. ✓

That's the occasional shipapis email — a few genuinely good free public APIs we've health-checked, and which ones died. No spam; a couple times a month at most.

The whole directory (live uptime, latency, auth rules): ${SITE}

You got this because you subscribed at shipapis.dev. Unsubscribe: ${unsubUrl}`

/** Send the transactional welcome email. Includes List-Unsubscribe headers for one-click unsub. */
export async function resendSendWelcome(env: ResendEnv, email: string, unsubToken: string): Promise<void> {
  if (!env.RESEND_API_KEY) return
  const unsubUrl = `${SITE}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken}`
  try {
    await call(env.RESEND_API_KEY, '/emails', 'POST', {
      from: FROM,
      to: [email],
      subject: "You're on the signal ✓",
      html: welcomeHtml(unsubUrl),
      text: welcomeText(unsubUrl),
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
  } catch {
    /* best-effort */
  }
}
