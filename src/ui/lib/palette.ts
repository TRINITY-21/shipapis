import { catApis } from '../../data/catalog'
import { categoryBySlug } from '../../data/seed'
import { apiLogoHost } from './api-logo'

/** Slim index embedded for the ⌘K palette — swapped for /data/index.json fetch at catalog scale. */
export function buildApiIndex(): string {
  return JSON.stringify(
    catApis().map((a) => ({
      slug: a.slug,
      name: a.name,
      emoji: a.emoji,
      iconHost: apiLogoHost(a),
      category: categoryBySlug.get(a.category)!.name,
      health: a.healthScore < 0 ? null : a.healthScore,
    })),
  )
}
