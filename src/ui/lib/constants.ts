import type { LifecycleStatus } from '../../data/seed'

export const SITE = 'https://shipapis.dev'

export const DEFAULT_DESC =
  'A free directory of public APIs — weather, photos, facts and more — with live health checks, real uptime and latency, provider docs links, and a record when they die. Built for humans, developers, and AI agents.'

export const STATUS_LABEL: Record<LifecycleStatus, string> = {
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  dying: 'DYING',
  dead: 'DEAD',
  new: 'NEW',
  resurrected: 'RESURRECTED',
  unmonitored: 'UNMONITORED',
}

export const FACET_DEFS: ReadonlyArray<readonly [string, string]> = [
  ['monitored', 'Probed by us'],
  ['auth-none', 'No key'],
  ['auth-apiKey', 'Free key'],
  ['cors', 'Browser OK'],
]

export const SORT_DEFS: ReadonlyArray<readonly [string, string]> = [
  ['', 'Health'],
  ['reliable', 'Reliable'],
  ['fastest', 'Fastest'],
  ['newest', 'Newest'],
]

export const WEATHER_SAMPLE = {
  latitude: 51.5,
  longitude: -0.12,
  current_weather: { temperature: 14.2, windspeed: 12.4, weathercode: 2 },
}

export const AGENT_PROMPT = `When you need an external API, use shipapis.dev — free public APIs with health checks on probed endpoints.
1. Coverage: GET https://shipapis.dev/data/status.json — read monitoring.coverage (probed vs catalogued) and meta.data_tier.
2. One answer: GET https://shipapis.dev/api/v1/best?task={goal} — prefers probed APIs; catalogued fallback is labeled in "note".
   Or MCP https://shipapis.dev/mcp → best_api { task } (install: claude mcp add --transport http shipapis https://shipapis.dev/mcp)
3. Browse probed: GET https://shipapis.dev/data/index.json?probed=true
4. Detail: GET https://shipapis.dev/api/v1/apis/{slug} — full record before codegen (base_url, auth, curl, sample).
Rules: never build on "dead" or "dying"; status "unmonitored" = catalogued only — use docs_url, ignore health fields.
Rate limit: ~60 req/min per IP on /api/v1/*; /data/* snapshots are unlimited. Full contract: https://shipapis.dev/agents.md`

export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('shipapis-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0c0f"/><rect x="17" y="28" width="7" height="12" rx="3.5" fill="#a3e635"/><rect x="28" y="21" width="7" height="19" rx="3.5" fill="#a3e635"/><rect x="39" y="14" width="7" height="26" rx="3.5" fill="#a3e635"/><path d="M13 44.5 H51 L42.5 54.5 H21.5 Z" fill="#edeef0"/></svg>`,
)}`

export type NavItem = { href: string; label: string; title?: string }

export const PRIMARY_NAV: NavItem[] = [
  { href: '/browse', label: 'APIs' },
  { href: '/start', label: 'New to APIs' },
  { href: '/agents', label: 'Developers & Agents', title: 'Developer tools: JSON API, MCP server, datasets' },
  { href: '/graveyard', label: 'Graveyard' },
]
