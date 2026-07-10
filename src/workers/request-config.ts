// Request-scoped site config (GA, etc.) — same ALS pattern as the catalog so SSR Layout can
 // read env without prop-drilling every page. Outside a request, GA stays unset (tests/local).

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestConfig {
  /** GA4 measurement ID (G-…). Public by design; unset → no tag. */
  gaMeasurementId?: string
  /** Whether analytics tags (CF beacon + GA4) should render this request — see shouldEmitAnalytics. */
  analytics?: boolean
}

const als = new AsyncLocalStorage<RequestConfig>()

/** Only these hosts count as production; *.workers.dev previews are excluded. */
const PROD_HOSTS = new Set(['shipapis.dev', 'www.shipapis.dev'])

/** Analytics render only in real production. Note `wrangler dev` rewrites the request host (url +
 *  Host header) to the custom domain, so the host check alone can't spot local dev — the localDev
 *  flag (LOCAL_DEV in .dev.vars) is what actually suppresses tags locally so dev browsing never
 *  pollutes the real CF Web Analytics / GA4 numbers. */
export function shouldEmitAnalytics(host: string, localDev: boolean): boolean {
  return !localDev && PROD_HOSTS.has(host)
}

export function withRequestConfig<T>(cfg: RequestConfig, fn: () => T): T {
  return als.run(cfg, fn)
}

export function gaMeasurementId(): string | undefined {
  return als.getStore()?.gaMeasurementId
}

/** Whether to emit the CF beacon + GA4 this request (decided in the app middleware). */
export function analyticsEnabled(): boolean {
  return als.getStore()?.analytics === true
}
