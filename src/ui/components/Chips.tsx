import type { FC } from 'hono/jsx'

import type { ApiEntry } from '../../data/seed'
import { chipTone } from '../lib/format'

export const Chips: FC<{ api: ApiEntry; compact?: boolean }> = ({ api, compact }) => (
  <>
    <span class="chip" title="Whether you need a signup or API key">AUTH <b class={api.auth === 'none' ? 'yes' : 'meh'}>{api.auth === 'none' ? 'NONE' : api.auth === 'userAgent' ? 'USER-AGENT' : api.auth.toUpperCase()}</b></span>
    <span class="chip" title="Whether this works when called from a website in your browser">CORS <b class={chipTone(api.cors)}>{api.cors === 'yes' ? '✓' : api.cors === 'no' ? '✗' : '?'}</b></span>
    <span class="chip" title="Reachable by a non-browser client (our bot UA), or blocked by a WAF/bot-wall?">AGENT <b class={api.agentAccess === 'ok' ? 'yes' : api.agentAccess === 'blocked' ? 'no' : 'meh'}>{api.agentAccess === 'ok' ? '✓' : api.agentAccess === 'blocked' ? '✗' : '?'}</b></span>
    {!compact && (
      <span class="chip">HTTPS <b class={chipTone(api.https)}>{api.https ? '✓' : '✗'}</b></span>
    )}
    {!compact && (
      <span class="chip">COMMERCIAL <b class={chipTone(api.commercialUse)}>{api.commercialUse === 'yes' ? '✓' : api.commercialUse === 'no' ? '✗' : '?'}</b></span>
    )}
  </>
)
