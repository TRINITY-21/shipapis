import type { FC } from 'hono/jsx';

import { Chev } from './Chev';

type PickOption = { value: string; label: string }

export const PickMenu: FC<{
  id?: string
  class?: string
  value: string
  options: PickOption[]
  ariaLabel: string
  name?: string
  required?: boolean
  triggerClass?: string
  activeWhen?: (value: string) => boolean
}> = ({ id, class: cls, value, options, ariaLabel, name, required, triggerClass, activeWhen }) => {
  const current = options.find((o) => o.value === value) ?? options[0]
  const panelId = id ? `${id}-list` : undefined
  const on = activeWhen ? activeWhen(value) : false
  return (
    <div class={`pick-menu${cls ? ` ${cls}` : ''}`} id={id} data-value={value}>
      {name && <input type="hidden" name={name} value={value} required={required || undefined} />}
      <button
        type="button"
        class={`pick-trigger${triggerClass ? ` ${triggerClass}` : ''}${on ? ' on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-controls={panelId}
        aria-label={ariaLabel}
      >
        <span class="pick-label">{current?.label ?? ''}</span>
        <Chev />
      </button>
      <div class="pick-panel" id={panelId} role="listbox" hidden>
        {options.map((o) => (
          <button
            type="button"
            role="option"
            class={`pick-opt${o.value === value ? ' on' : ''}`}
            data-value={o.value}
            aria-selected={o.value === value ? 'true' : 'false'}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
