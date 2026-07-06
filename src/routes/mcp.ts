import type { Hono } from 'hono'
import { mcpGet, mcpPost } from '../agents/mcp'
import type { Env } from '../workers/env'

export function registerMcp(app: Hono<{ Bindings: Env }>) {
  app.get('/mcp', mcpGet)
  app.post('/mcp', mcpPost)
  app.options('/mcp', (c) => c.body(null, 204))
}
