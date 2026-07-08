// Request-scoped site config (GA, etc.) — same ALS pattern as the catalog so SSR Layout can
 // read env without prop-drilling every page. Outside a request, GA stays unset (tests/local).

import { AsyncLocalStorage } from 'node:async_hooks'

export interface RequestConfig {
  /** GA4 measurement ID (G-…). Public by design; unset → no tag. */
  gaMeasurementId?: string
}

const als = new AsyncLocalStorage<RequestConfig>()

export function withRequestConfig<T>(cfg: RequestConfig, fn: () => T): T {
  return als.run(cfg, fn)
}

export function gaMeasurementId(): string | undefined {
  return als.getStore()?.gaMeasurementId
}
