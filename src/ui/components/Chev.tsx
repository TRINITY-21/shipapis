import type { FC } from 'hono/jsx'

/** Chevron — the system's directional glyph for links & CTAs (text arrows retired; ↗ stays for external). */
export const Chev: FC<{ left?: boolean }> = ({ left }) => (
  <svg
    class="chev"
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d={left ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
)
