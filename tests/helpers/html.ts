// Tiny dependency-free HTML probes for SSR assertions.

/** All <script type="application/ld+json"> payloads, JSON-parsed (< decodes natively). */
export function jsonLdBlocks(html: string): any[] {
  const blocks: any[] = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) blocks.push(JSON.parse(m[1]))
  return blocks
}

/** Raw (unparsed) ld+json script contents — for breakout-safety checks. */
export function jsonLdRaw(html: string): string[] {
  const out: string[] = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(m[1])
  return out
}

export const countTag = (html: string, tag: string) =>
  (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'gi')) || []).length

export function metaContent(html: string, attr: 'name' | 'property', key: string): string | null {
  const re = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, 'i')
  const m = html.match(re)
  return m ? m[1] : null
}

export function titleText(html: string): string | null {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return m ? m[1] : null
}

/** Common template-leak markers that should never survive into rendered HTML. */
export const LEAK_MARKERS = ['[object Object]', 'undefinedundefined', 'NaN%', '>undefined<', '>NaN<', 'class="undefined"']
