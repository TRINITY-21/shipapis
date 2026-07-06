import type { FC } from 'hono/jsx'

export const Checked: FC<{ min: number }> = ({ min }) => (
  <span class="checked">checked {min} min ago</span>
)
