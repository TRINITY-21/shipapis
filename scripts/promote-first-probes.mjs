#!/usr/bin/env node
/** One-shot: promote already-probed rows stuck on status=unmonitored → new (rollup has't run yet). */
import { getPlatformProxy } from 'wrangler'

const remote = process.argv.includes('--remote')
const { env, dispose } = await getPlatformProxy({
  configPath: './wrangler.jsonc',
  ...(remote ? { persist: false } : {}),
})

try {
  // For remote we need wrangler d1 execute — getPlatformProxy is local-only by default.
  // This script updates LOCAL. Remotecatch-up uses wrangler d1 execute --remote below via shell.
  const r = await env.DB.prepare(
    `update apis set status = 'new'
     where monitored_since is not null and status = 'unmonitored' and check_opt_out = 0`,
  ).run()
  console.log(`local: promoted ${r.meta?.changes ?? 0} rows unmonitored→new`)
} finally {
  await dispose()
}
