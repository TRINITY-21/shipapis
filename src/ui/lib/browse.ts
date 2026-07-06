import { isMonitored } from '../../data/catalog'
import { uptimePct, type ApiEntry } from '../../data/seed'

export const browseSorted = (base: ApiEntry[], sort?: string) => {
  const list = [...base]
  const monFirst = (a: ApiEntry, b: ApiEntry) => Number(isMonitored(b)) - Number(isMonitored(a))
  if (sort === 'fastest') {
    return list
      .filter((a) => a.p50 > 0)
      .sort((a, b) => a.p50 - b.p50)
      .concat(list.filter((a) => !(a.p50 > 0)).sort((a, b) => monFirst(a, b)))
  }
  if (sort === 'newest') return list.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || monFirst(a, b))
  if (sort === 'reliable') return list.sort((a, b) => monFirst(a, b) || Number(uptimePct(b, 30)) - Number(uptimePct(a, 30)))
  return list.sort((a, b) => monFirst(a, b) || b.healthScore - a.healthScore)
}

export function facetTokens(api: ApiEntry): string {
  const t: string[] = []
  if (isMonitored(api)) t.push('monitored')
  if (api.checkTier === 'reachability') t.push('reachability')
  if (api.status === 'unmonitored') t.push('catalogued')
  if (api.status === 'healthy' || api.status === 'new' || api.status === 'resurrected') t.push('healthy')
  if (api.auth === 'none') t.push('auth-none')
  if (api.auth === 'apiKey') t.push('auth-apiKey')
  if (api.cors === 'yes') t.push('cors')
  if (api.agentAccess === 'ok') t.push('agent-ok')
  if (!api.requiresCard) t.push('nocard')
  if (api.commercialUse === 'yes') t.push('commercial')
  t.push(`cat-${api.category}`)
  return t.join(' ')
}

/** Search haystack incl. human aliases — "no auth" must match what people actually type. */
export function searchText(api: ApiEntry, catName: string): string {
  const alias = [
    api.auth === 'none' ? 'no auth no key keyless' : '',
    api.auth === 'apiKey' ? 'api key free key token signup register' : '',
    !api.requiresCard ? 'no card' : '',
    api.cors === 'yes' ? 'cors' : '',
    api.agentAccess === 'ok' ? 'agent server-side agent-ready' : '',
    api.agentAccess === 'blocked' ? 'bot-walled blocked waf' : '',
    api.commercialUse === 'yes' ? 'commercial' : '',
    api.status === 'healthy' || api.status === 'new' || api.status === 'resurrected' ? 'healthy up working' : '',
  ].filter(Boolean).join(' ')
  return `${api.name} ${api.tagline} ${api.description} ${catName} ${api.auth} ${alias}`.toLowerCase()
}
