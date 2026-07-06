import type { ApiEntry } from '../../data/seed'

export type MetaSource = 'probed' | 'documented' | 'import' | 'pending'

export interface MetaField {
  label: string
  value: string
  source: MetaSource
  tone: 'good' | 'bad' | 'meh' | null
}

const SOURCE_LABEL: Record<MetaSource, string> = {
  probed: 'live probe',
  documented: 'from docs',
  import: 'import probe',
  pending: 'pending',
}

export function metaSourceLabel(s: MetaSource): string {
  return SOURCE_LABEL[s]
}

function toneForCors(v: string): MetaField['tone'] {
  if (v === 'yes') return 'good'
  if (v === 'no') return 'bad'
  return 'meh'
}

function toneForCommercial(v: string): MetaField['tone'] {
  if (v === 'yes') return 'good'
  if (v === 'no') return 'bad'
  return 'meh'
}

/** Detail-page metadata rows with honest per-field verification labels. */
export function metaFields(api: ApiEntry): MetaField[] {
  const p = api.metaProvenance
  return [
    {
      label: 'Auth',
      value: api.auth,
      source: p?.auth ?? 'documented',
      tone: null,
    },
    {
      label: 'CORS',
      value: api.cors,
      source: p?.cors ?? (api.cors === 'unknown' ? 'pending' : 'import'),
      tone: toneForCors(api.cors),
    },
    {
      label: 'Commercial use',
      value: api.commercialUse,
      source: p?.commercialUse ?? (api.commercialUse === 'unclear' ? 'pending' : 'documented'),
      tone: toneForCommercial(api.commercialUse),
    },
    {
      label: 'HTTPS',
      value: api.https ? 'yes' : 'no',
      source: p?.https ?? 'documented',
      tone: api.https ? 'good' : 'bad',
    },
    {
      label: 'Free tier',
      value: api.freeTier,
      source: p?.freeTier ?? 'documented',
      tone: null,
    },
    {
      label: 'Rate limit',
      value: api.rateLimit,
      source: p?.rateLimit ?? 'pending',
      tone: null,
    },
    {
      label: 'Card required',
      value: api.requiresCard ? 'yes' : 'no',
      source: 'documented',
      tone: api.requiresCard ? 'meh' : 'good',
    },
    {
      label: 'Data license',
      value: api.dataLicense,
      source: 'documented',
      tone: null,
    },
  ]
}
