import type { FC } from 'hono/jsx'
import { checkedAgo } from '../lib/format'

export const Checked: FC<{ min: number }> = ({ min }) => (
  <span class="checked">checked {checkedAgo(min)}</span>
)
