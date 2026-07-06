import type { FC } from 'hono/jsx'
import type { FaqItem } from '../lib/faq'

/**
 * Visible FAQ capsules. The same copy is emitted as FAQPage JSON-LD (via faqLd) — text is never
 * hidden, so crawlers and AI answer engines cite exactly what a reader sees. Heading level is `h2`
 * for the section with `h3` per question, sitting under each page's single `h1`.
 */
export const Faq: FC<{ heading: string; items: FaqItem[] }> = ({ heading, items }) => {
  if (!items.length) return null
  return (
    <section class="faq panel" aria-labelledby="faq-h">
      <h2 class="faq-h" id="faq-h">{heading}</h2>
      <div class="faq-list">
        {items.map(({ q, a }) => (
          <div class="faq-item">
            <h3 class="faq-q">{q}</h3>
            <p class="faq-a">{a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
