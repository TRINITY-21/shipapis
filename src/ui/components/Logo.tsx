import type { FC } from 'hono/jsx'

/** The mark, theme-aware: bars in accent, hull in ink. */
export const Logo: FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style="flex:none">
    <rect x="17" y="28" width="7" height="12" rx="3.5" fill="var(--accent)" />
    <rect x="28" y="21" width="7" height="19" rx="3.5" fill="var(--accent)" />
    <rect x="39" y="14" width="7" height="26" rx="3.5" fill="var(--accent)" />
    <path d="M13 44.5 H51 L42.5 54.5 H21.5 Z" fill="var(--text)" />
  </svg>
)
