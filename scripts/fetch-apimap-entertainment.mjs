// Gap-fill from apimap.dev entertainment category — APIs we don't have yet, sorted by score.
// Prefer:  npm run seed:candidates:apimap -- --category entertainment
//
// run:  node scripts/fetch-apimap-entertainment.mjs
//       node scripts/fetch-apimap-entertainment.mjs --write-batch

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const script = fileURLToPath(new URL('./fetch-apimap-gaps.mjs', import.meta.url))
const out = spawnSync(process.execPath, [script, '--category=entertainment', ...args], { stdio: 'inherit' })
process.exit(out.status ?? 1)
