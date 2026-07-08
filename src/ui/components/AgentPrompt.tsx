import type { FC } from 'hono/jsx'

import { AGENT_PROMPT } from '../lib/constants'
import { Chev } from './Chev'

export const AgentPrompt: FC = () => (
  <div class="agent-block">
    <span class="k">For Cursor, Claude & coding agents · paste into CLAUDE.md / AGENTS.md</span>
    <div class="codeblock">
      <button class="copy" data-copy={AGENT_PROMPT} data-track="agent_prompt">COPY</button>
      <pre>
        <code>{AGENT_PROMPT}</code>
      </pre>
    </div>
    <span class="agent-block-foot k">
      <a href="/agents#mcp">MCP config<Chev /></a> · <a href="/agents.md">agents.md</a> · <a href="/llms.txt">llms.txt</a> · <a href="/data/index.json?probed=true">index.json</a>
    </span>
  </div>
)
