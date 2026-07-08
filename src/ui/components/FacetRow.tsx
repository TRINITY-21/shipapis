import type { FC } from 'hono/jsx'

import { catApis } from '../../data/catalog'
import { categories } from '../../data/seed'
import { FACET_DEFS } from '../lib/constants'
import { PickMenu } from './PickMenu'

type PickOption = { value: string; label: string }

export const FacetRow: FC<{ count: number; active?: string; cats?: boolean }> = ({ count, active, cats }) => {
  const activeCat = !!cats && !!active && active.startsWith('cat-') ? active : ''
  const hasActive = FACET_DEFS.some(([token]) => token === active) || !!activeCat
  const catOptions: PickOption[] = [
    { value: 'all', label: 'Category · all' },
    ...categories.flatMap((c) => {
      const n = catApis().filter((a) => a.category === c.slug).length
      if (!n) return []
      return [{ value: `cat-${c.slug}`, label: `${c.emoji} ${c.name} · ${n}` }]
    }),
  ]
  return (
    <div class="facets" role="group" aria-label="Filters">
      <div class="facets-scroll">
        <button class={`facet${hasActive ? '' : ' on'}`} data-facet="all" aria-pressed={hasActive ? 'false' : 'true'}>
          All · {count}
        </button>
        {FACET_DEFS.map(([token, label]) => (
          <button
            class={`facet${token === active ? ' on' : ''}`}
            data-facet={token}
            aria-pressed={token === active ? 'true' : 'false'}
          >
            {label}
          </button>
        ))}
      </div>
      {cats && (
        <PickMenu
          id="cat-menu"
          class="facet-menu"
          value={activeCat || 'all'}
          options={catOptions}
          ariaLabel="Filter by category"
          triggerClass="facet"
          activeWhen={(v) => v !== 'all'}
        />
      )}
    </div>
  )
}
