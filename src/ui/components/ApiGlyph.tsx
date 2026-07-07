import type { FC } from 'hono/jsx'

import { catBySlug } from '../../data/catalog'
import type { ApiEntry } from '../../data/seed'
import { apiLogoSrc } from '../lib/api-logo'

type ApiLike = Pick<ApiEntry, 'baseUrl' | 'docsUrl'> & { emoji?: string }

/** Fetch size for crisp display on 1x–2x screens (capped at proxy max 128). */
export const logoFetchPx = (displayPx: number) => Math.min(128, Math.max(32, Math.ceil(displayPx * 2)))

export const ApiGlyph: FC<{
  api?: ApiLike
  slug?: string
  /** tile = 40px ledger box (default); inline = compact rows (signals, palette) */
  variant?: 'tile' | 'inline'
  /** CSS box size in px — pass when parent overrides .glyph dimensions (detail 56, row 30, OG 100). */
  displayPx?: number
  class?: string
  /** OG cards need absolute icon URLs for screenshot rendering. */
  absolute?: boolean
}> = ({ api, slug, variant = 'tile', displayPx, class: klass, absolute }) => {
  const entry = api ?? (slug ? catBySlug().get(slug) : undefined)
  if (!entry) return null

  const box = displayPx ?? (variant === 'inline' ? 16 : 40)
  const src = apiLogoSrc(entry, { size: logoFetchPx(box), absolute })
  const boxClass =
    variant === 'inline'
      ? klass
        ? `${klass} api-logo-inline`
        : 'api-logo-inline'
      : klass ?? 'glyph'

  return (
    <span class={boxClass} data-api-glyph aria-hidden="true">
      {entry.emoji ? <span class="glyph-fb">{entry.emoji}</span> : null}
      {src && (
        <img
          class="glyph-img"
          src={src}
          alt=""
          width={box}
          height={box}
          loading="lazy"
          decoding="async"
          onload="this.closest('[data-api-glyph]')?.classList.add('glyph-ok')"
          onerror="this.closest('[data-api-glyph]')?.classList.add('glyph-miss')"
        />
      )}
    </span>
  )
}
