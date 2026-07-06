// Run the health checker locally against the D1 sqlite (no dev server required).
// run: node scripts/dev-sweep.mjs [--rounds 25] [--rollup] [--until-done]
//
// Each round probes up to 45 endpoints (~90 min cooldown between re-checks of the same one).
// With ~1k APIs and ~1 monitored endpoint each, ~23 rounds covers the full catalog once.

import { getPlatformProxy } from 'wrangler'
import { runRollup, runSweep } from '../src/workers/checker.ts'

const untilDone = process.argv.includes('--until-done')
const rounds = untilDone
  ? 9999
  : Number(process.argv.find((a, i) => process.argv[i - 1] === '--rounds') || '25')
const doRollup = process.argv.includes('--rollup')

const pendingSql = `select count(*) as n from apis
  where check_opt_out = 0 and check_tier != 'listed' and status != 'dead' and monitored_since is null`

const { env, dispose } = await getPlatformProxy({ configPath: './wrangler.jsonc' })
try {
  let total = 0
  for (let r = 1; r <= rounds; r++) {
    const { checked } = await runSweep(env)
    total += checked
    const pending = (await env.DB.prepare(pendingSql).first())?.n ?? 0
    process.stdout.write(`  round ${r}: ${checked} checks · ${pending} awaiting first probe\n`)
    if (!checked) break
    if (untilDone && pending === 0) break
  }
  console.log(`\nsweep done: ${total} endpoint checks`)

  if (doRollup || total > 0) {
    await runRollup(env)
    console.log('rollup done')
  }

  const row = await env.DB.prepare(
    `select
       (select count(*) from apis) as total,
       (select count(*) from apis where monitored_since is not null) as probed,
       (select count(*) from checks) as checks`,
  ).first()
  console.log(`D1: ${row?.probed}/${row?.total} probed · ${row?.checks} raw checks`)
} finally {
  await dispose()
}
