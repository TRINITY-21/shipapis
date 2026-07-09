import type { ApiEntry } from '../../data/seed'

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** JSON-LD payload → script-safe string ('<' escaped so '</script>' can never break out). */
export const jsonLdStr = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

export const sweepLabel = (min: number | null) => (min == null ? '—' : min < 1 ? 'JUST NOW' : `${min} MIN AGO`)

/** Compact last-check for stat tiles (detail uptime row). */
export const lastCheckShort = (min: number) => {
  if (min < 1) return 'Now'
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

/** Relative "checked … ago" phrase — collapses to h/d past the first hour so it never reads
 *  "2650 min ago". Mirrors lastCheckShort's thresholds but keeps a readable sentence. */
export const checkedAgo = (min: number) => {
  if (min < 1) return 'just now'
  if (min < 60) return `${Math.round(min)} min ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return `${Math.round(min / 1440)}d ago`
}

/** Minimal JSON syntax highlighting → trusted HTML string (input is our own seed data). */
export function hlJson(value: unknown): string {
  const json = esc(JSON.stringify(value, null, 2))
  return json.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'j-num'
      if (match.startsWith('&quot;') || match.startsWith('"')) {
        cls = match.endsWith(':') ? 'j-key' : 'j-str'
      } else if (/true|false|null/.test(match)) {
        cls = 'j-bool'
      }
      return `<span class="${cls}">${match}</span>`
    },
  )
}

/** UTC midnight of the current day. The newest uptime bar (index 89) is "today", matching the
 *  data axis in loadCatalog, which builds uptime90 against real `now`. */
const todayAnchor = () => {
  const n = new Date()
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())
}

export function dayLabel(idx: number): string {
  const d = new Date(todayAnchor() - (89 - idx) * 86400000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export const fmtAdded = (iso: string) =>
  new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .toUpperCase()

export const todayLabel = () => fmtAdded(new Date().toISOString().slice(0, 10))

/** Whole days since an API was added, measured in UTC against the current day (same anchor the charts use). */
export const daysSinceAdded = (api: ApiEntry) =>
  Math.floor((todayAnchor() - Date.parse(`${api.addedAt}T00:00:00Z`)) / 86400000)

/** CSS class for chip booleans / yes-no-unknown fields. */
export const chipTone = (v: boolean | string, good: string[] = ['yes', 'true']) => {
  const s = String(v)
  return good.includes(s) ? 'yes' : s === 'unknown' || s === 'unclear' ? 'meh' : 'no'
}
