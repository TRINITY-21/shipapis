import type { FC } from 'hono/jsx'

import { tierLabel, type CheckTier } from '../../data/check-tier'
import type { LifecycleStatus } from '../../data/seed'
import { STATUS_LABEL } from '../lib/constants'

export const StatusBadge: FC<{ status: LifecycleStatus; checkTier?: CheckTier }> = ({ status, checkTier = 'endpoint' }) => {
  const label =
    checkTier === 'endpoint' || checkTier === 'listed'
      ? STATUS_LABEL[status]
      : tierLabel(checkTier, status).toUpperCase()
  return (
    <span class={`status ${status} tier-${checkTier}`} title={checkTier !== 'endpoint' ? `Check tier: ${checkTier}` : undefined}>
      {label}
    </span>
  )
}
