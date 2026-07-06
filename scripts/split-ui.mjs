#!/usr/bin/env node
/** One-time splitter: breaks src/ui/index.tsx into a modular tree. Safe to re-run after backing up. */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const UI = 'src/ui'
const src = readFileSync(join(UI, 'index.tsx'), 'utf8')
const L = src.split('\n')

const slice = (from, to) => L.slice(from - 1, to).join('\n')

const mkdir = (p) => mkdirSync(dirname(p), { recursive: true })
const write = (rel, body) => {
  const p = join(UI, rel)
  mkdir(p)
  writeFileSync(p, body.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n'))
}

// --- lib ---
write(
  'lib/format.ts',
  `import { ANCHOR } from './constants'
import type { ApiEntry } from '../../seed'

${slice(33, 37)}

${slice(129, 144)}

${slice(158, 161)}

${slice(300, 308)}
`,
)

write(
  'lib/seo.ts',
  `import { SITE, DEFAULT_DESC } from './constants'
import { isMonitored } from '../../catalog'
import { uptimePct, type ApiEntry } from '../../seed'

${slice(61, 69)}

${slice(71, 127)}
`,
)

write(
  'lib/browse.ts',
  `import { isMonitored } from '../../catalog'
import { uptimePct, type ApiEntry } from '../../seed'

${slice(47, 59)}

${slice(272, 298)}
`,
)

write(
  'lib/nav.ts',
  `export function navAriaCurrent(path: string, href: string) {
  return path === href ? 'page' : undefined
}
`,
)

write(
  'lib/constants.ts',
  `import type { LifecycleStatus } from '../../seed'

${slice(31, 31)}

${slice(41, 42)}

${slice(146, 157)}

${slice(310, 319)}

${slice(1250, 1255)}

${slice(2072, 2077)}

${slice(414, 421)}

${slice(541, 541)}

${slice(555, 557)}

${slice(569, 576)}
`,
)

write(
  'lib/palette.ts',
  `import { catApis } from '../../catalog'
import { categoryBySlug } from '../../seed'

/** Slim index embedded for the ⌘K palette — swapped for /data/index.json fetch at catalog scale. */
export function buildApiIndex(): string {
  return JSON.stringify(
    catApis().map((a) => ({
      slug: a.slug,
      name: a.name,
      emoji: a.emoji,
      category: categoryBySlug.get(a.category)!.name,
      health: a.healthScore < 0 ? null : a.healthScore,
    })),
  )
}
`,
)

// --- atoms & shared components ---
const jsx = `import type { FC } from 'hono/jsx'\n`

write('components/Chev.tsx', `${jsx}\n${slice(165, 181)}\n`)
write('components/Logo.tsx', `${jsx}\n${slice(559, 567)}\n`)
write(
  'components/StatusBadge.tsx',
  `${jsx}
import type { LifecycleStatus } from '../../seed'
import { STATUS_LABEL } from '../lib/constants'

${slice(183, 185)}
`,
)
write('components/Checked.tsx', `${jsx}\n${slice(187, 189)}\n`)
write('components/ScoreRing.tsx', `${jsx}\n${slice(191, 226)}\n`)
write(
  'components/UptimeBars.tsx',
  `${jsx}
import { uptimePct, type ApiEntry } from '../../seed'
import { dayLabel } from '../lib/format'

${slice(228, 269)}
`,
)
write(
  'components/PickMenu.tsx',
  `${jsx}
import { Chev } from './Chev'

type PickOption = { value: string; label: string }

${slice(321, 321)}
${slice(324, 367)}
`,
)
write(
  'components/FacetRow.tsx',
  `${jsx}
import { categories } from '../../seed'
import { FACET_DEFS } from '../lib/constants'
import { PickMenu } from './PickMenu'

${slice(371, 410)}
`,
)
write(
  'components/AgentPrompt.tsx',
  `${jsx}
import { AGENT_PROMPT } from '../lib/constants'
import { Chev } from './Chev'

${slice(423, 436)}
`,
)
write(
  'components/ListEmpty.tsx',
  `${jsx}
import { categories } from '../../seed'

${slice(438, 449)}
`,
)
write('components/BarsLegend.tsx', `${jsx}\n${slice(451, 458)}\n`)
write('components/Sparkline.tsx', `${jsx}\n${slice(460, 487)}\n`)
write(
  'components/Chips.tsx',
  `${jsx}
import type { ApiEntry } from '../../seed'

${slice(489, 501)}
`,
)

write(
  'layout/HonestyBanner.tsx',
  `${jsx}
import { catalogCounts, dataTier } from '../../catalog'

${slice(507, 539)}
`,
)

write(
  'layout/Layout.tsx',
  `${jsx}
import type { Child, FC } from 'hono/jsx'
import { catalogCounts } from '../../catalog'
import { DEFAULT_DESC, FAVICON, PRIMARY_NAV, SITE, THEME_BOOT } from '../lib/constants'
import { jsonLdStr } from '../lib/format'
import { navAriaCurrent } from '../lib/nav'
import { buildApiIndex } from '../lib/palette'
import { Logo } from '../components/Logo'
import { HonestyBanner } from './HonestyBanner'

${slice(582, 812).replace('API_INDEX', 'buildApiIndex()')}
`,
)

write(
  'components/list/RowHead.tsx',
  `${jsx}\n${slice(1203, 1213)}\n`,
)
write(
  'components/list/ApiRow.tsx',
  `${jsx}
import { isMonitored } from '../../catalog'
import { categoryBySlug, uptimePct, type ApiEntry } from '../../../seed'
import { fmtAdded } from '../../lib/format'
import { Chips } from '../Chips'
import { ScoreRing } from '../ScoreRing'
import { StatusBadge } from '../StatusBadge'
import { UptimeBars } from '../UptimeBars'

${slice(1215, 1248)}
`,
)
write(
  'components/detail/EndpointsPanel.tsx',
  `${jsx}
import { endpointUrl, type ApiEntry } from '../../../seed'
import { Checked } from '../Checked'

${slice(1330, 1434)}
`,
)

write(
  'pages/state-parts.tsx',
  `${jsx}
import type { Child, FC } from 'hono/jsx'

${slice(1855, 1889).replace(/^const (StatBar|StateBlock)/gm, 'export const $1')}
`,
)

write(
  'start/diagrams.tsx',
  `${jsx}
${slice(2079, 2234).replace(/^const (StartChapterHead|WebWireframe|ApiWireframe|StartFlowDiagram|StartMonitorDiagram)/gm, 'export const $1')}
`,
)

write(
  'og/OgShell.tsx',
  `${jsx}
import type { Child, FC } from 'hono/jsx'

${slice(3057, 3068)}
`,
)

write(
  'pages/compare-meta.ts',
  `import { uptimePct, type ApiEntry } from '../../seed'

export ${slice(2974, 2988).replace(/^const CMP_META/, 'const CMP_META')}
`,
)

// --- pages (contiguous exports) ---
const pageSlices = [
  ['pages/Home.tsx', 816, 1127, `import type { FC } from 'hono/jsx'
import { catDeadApis, catGlobalStats, catLiveApis, catalogCounts, isMonitored } from '../../catalog'
import { apiOfTheDay, categories, recentSignals, uptimePct } from '../../seed'
import { AgentPrompt } from '../components/AgentPrompt'
import { Chips } from '../components/Chips'
import { FacetRow } from '../components/FacetRow'
import { ScoreRing } from '../components/ScoreRing'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { todayLabel } from '../lib/format'
import { ORG_LD, WEBSITE_LD } from '../lib/seo'
`],
  ['pages/CategoryPage.tsx', 1128, 1256, `import type { FC } from 'hono/jsx'
import { catApisInCategory, isMonitored } from '../../catalog'
import { categoryBySlug, uptimePct } from '../../seed'
import { FacetRow } from '../components/FacetRow'
import { ApiRow } from '../components/list/ApiRow'
import { RowHead } from '../components/list/RowHead'
import { Layout } from '../layout/Layout'
import { browseSorted } from '../lib/browse'
import { breadcrumbLd, itemListLd } from '../lib/seo'
`],
  ['pages/BrowsePage.tsx', 1257, 1328, `import type { FC } from 'hono/jsx'
import { catApis, isMonitored } from '../../catalog'
import { categories } from '../../seed'
import { FacetRow } from '../components/FacetRow'
import { ApiRow } from '../components/list/ApiRow'
import { RowHead } from '../components/list/RowHead'
import { Layout } from '../layout/Layout'
import { browseSorted } from '../lib/browse'
import { breadcrumbLd } from '../lib/seo'
import { SORT_DEFS } from '../lib/constants'
`],
  ['pages/DetailPage.tsx', 1436, 1790, `import type { FC } from 'hono/jsx'
import { catApisInCategory, catAllShapeChanges, isMonitored } from '../../catalog'
import { categoryBySlug, endpointUrl, uptimePct } from '../../seed'
import { AgentPrompt } from '../components/AgentPrompt'
import { BarsLegend } from '../components/BarsLegend'
import { Checked } from '../components/Checked'
import { Chips } from '../components/Chips'
import { ScoreRing } from '../components/ScoreRing'
import { Sparkline } from '../components/Sparkline'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { EndpointsPanel } from '../components/detail/EndpointsPanel'
import { Layout } from '../layout/Layout'
import { hlJson } from '../lib/format'
import { breadcrumbLd, detailDesc, detailTitle, webApiLd } from '../lib/seo'
import { Chev } from '../components/Chev'
`],
  ['pages/ChangelogPage.tsx', 1791, 1854, `import type { FC } from 'hono/jsx'
import { statusChanges } from '../../seed'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
import { Chev } from '../components/Chev'
`],
  ['pages/StatePage.tsx', 1891, 2071, `import type { FC } from 'hono/jsx'
import { catApis, catDeadApis, catGlobalStats, catLiveApis, catalogCounts, isMonitored } from '../../catalog'
import { categories, uptimePct } from '../../seed'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
import { StatBar, StateBlock } from './state-parts'
`],
  ['pages/StartPage.tsx', 2236, 2532, `import type { FC } from 'hono/jsx'
import { catalogCounts, catApis, isMonitored } from '../../catalog'
import { categories } from '../../seed'
import { AgentPrompt } from '../components/AgentPrompt'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { hlJson } from '../lib/format'
import { WEATHER_SAMPLE } from '../lib/constants'
import { breadcrumbLd } from '../lib/seo'
import { StartChapterHead, StartFlowDiagram, StartMonitorDiagram, WebWireframe, ApiWireframe } from '../start/diagrams'
`],
  ['pages/GraveyardPage.tsx', 2533, 2621, `import type { FC } from 'hono/jsx'
import { catDeadApis } from '../../catalog'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/DevelopersPage.tsx', 2622, 2743, `import type { FC } from 'hono/jsx'
import { catalogCounts } from '../../catalog'
import { AgentPrompt } from '../components/AgentPrompt'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/MethodologyPage.tsx', 2744, 2819, `import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/SignalsPage.tsx', 2820, 2868, `import type { FC } from 'hono/jsx'
import { recentSignals } from '../../seed'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
import { Chev } from '../components/Chev'
`],
  ['pages/SubmitPage.tsx', 2869, 2971, `import type { FC } from 'hono/jsx'
import { categories } from '../../seed'
import { PickMenu } from '../components/PickMenu'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/ComparePage.tsx', 2990, 3056, `import type { FC } from 'hono/jsx'
import type { ApiEntry } from '../../seed'
import { Chips } from '../components/Chips'
import { ScoreRing } from '../components/ScoreRing'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
import { CMP_META } from './compare-meta'
`],
  ['og/OgApiCard.tsx', 3070, 3109, `import type { FC } from 'hono/jsx'
import { categoryBySlug, uptimePct, type ApiEntry } from '../../seed'
import { OgShell } from './OgShell'
`],
  ['og/OgCatCard.tsx', 3110, 3156, `import type { FC } from 'hono/jsx'
import { catApisInCategory } from '../../catalog'
import { categoryBySlug, uptimePct } from '../../seed'
import { OgShell } from './OgShell'
`],
  ['og/OgHomeCard.tsx', 3157, 3205, `import type { FC } from 'hono/jsx'
import { catalogCounts } from '../../catalog'
import { OgShell } from './OgShell'
`],
  ['pages/AboutPage.tsx', 3206, 3285, `import type { FC } from 'hono/jsx'
import { catalogCounts } from '../../catalog'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/PrivacyPage.tsx', 3286, 3347, `import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/TermsPage.tsx', 3348, 3418, `import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'
`],
  ['pages/NotFound.tsx', 3419, 3431, `import type { FC } from 'hono/jsx'
import { Layout } from '../layout/Layout'
`],
]

for (const [rel, from, to, header] of pageSlices) {
  write(rel, `${header}\n${slice(from, to)}\n`)
}

// barrel
write(
  'index.ts',
  `/* shipapis.dev — SSR UI. Hono JSX, no client framework. Design system: public/styles.css */

export { Layout } from './layout/Layout'
export { Chev, Logo, StatusBadge, Checked, ScoreRing, UptimeBars, FacetRow, AgentPrompt, ListEmpty, BarsLegend, Sparkline, Chips } from './components'

export { Home } from './pages/Home'
export { CategoryPage } from './pages/CategoryPage'
export { BrowsePage } from './pages/BrowsePage'
export { DetailPage } from './pages/DetailPage'
export { ChangelogPage } from './pages/ChangelogPage'
export { StatePage } from './pages/StatePage'
export { StartPage } from './pages/StartPage'
export { GraveyardPage } from './pages/GraveyardPage'
export { DevelopersPage } from './pages/DevelopersPage'
export { MethodologyPage } from './pages/MethodologyPage'
export { SignalsPage } from './pages/SignalsPage'
export { SubmitPage } from './pages/SubmitPage'
export { ComparePage } from './pages/ComparePage'
export { OgApiCard, OgCatCard, OgHomeCard } from './og'
export { AboutPage } from './pages/AboutPage'
export { PrivacyPage } from './pages/PrivacyPage'
export { TermsPage } from './pages/TermsPage'
export { NotFound } from './pages/NotFound'
`,
)

write(
  'components/index.ts',
  `export { Chev } from './Chev'
export { Logo } from './Logo'
export { StatusBadge } from './StatusBadge'
export { Checked } from './Checked'
export { ScoreRing } from './ScoreRing'
export { UptimeBars } from './UptimeBars'
export { PickMenu } from './PickMenu'
export { FacetRow } from './FacetRow'
export { AgentPrompt } from './AgentPrompt'
export { ListEmpty } from './ListEmpty'
export { BarsLegend } from './BarsLegend'
export { Sparkline } from './Sparkline'
export { Chips } from './Chips'
`,
)

write(
  'og/index.ts',
  `export { OgShell } from './OgShell'
export { OgApiCard } from './OgApiCard'
export { OgCatCard } from './OgCatCard'
export { OgHomeCard } from './OgHomeCard'
`,
)

// archive monolith
if (!existsSync(join(UI, '_monolith.tsx.bak'))) {
  writeFileSync(join(UI, '_monolith.tsx.bak'), src)
}
rmSync(join(UI, 'index.tsx'))

console.log('Split complete — run wrangler deploy --dry-run to verify')
