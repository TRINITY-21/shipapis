import type { FC } from 'hono/jsx'

import { categories } from '../../data/seed'

export const ListEmpty: FC<{ home?: boolean }> = ({ home }) => (
  <div class="list-empty" data-empty>
    <span class="k">0 MATCHES</span>
    <p class="comment">0 matches</p>
    <p>{home ? 'Try fewer words, or pick a category below.' : 'Try fewer filters, or browse by category.'}</p>
    <div class="cats">
      {categories.slice(0, 5).map((c) => (
        <a class="facet" href={`/c/${c.slug}`}>{c.emoji} {c.name}</a>
      ))}
    </div>
  </div>
)
