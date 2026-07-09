import { app } from './app'
import { runRollup, runSweep } from './workers/checker'
import type { Env } from './workers/env'

export default {
  fetch: app.fetch,
  scheduled: async (controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    if (controller.cron === '*/15 * * * *') ctx.waitUntil(runSweep(env))
    else if (controller.cron === '0 */6 * * *') ctx.waitUntil(runRollup(env))
  },
} satisfies ExportedHandler<Env>
