# shipapis — Design System v2 · "the instrument"

> The UI **is** the argument: this product is a monitoring instrument, so the site looks like one.
> Grammar: **ruled ledgers and spec-sheets, not floating cards.** Reference points: Berkeley Graphics,
> McMaster-Carr, terminal UIs — committed metaphors, typographic discipline, zero decoration that
> doesn't inform. The 2026 SaaS template (card grids, pill kickers, serif-italic accent words,
> 12px-rounded everything) is explicitly banned.

## 1. Brand

- **Name:** `shipapis` (domain: shipapis.dev) — "ship" is the promise, live monitoring is the proof. No `.dev` in the wordmark or titles.
- **Logo: the Signal Sail** — three ascending uptime bars (accent) on a hull (ink). Theme-aware `<Logo/>`; favicon is the dark-tile variant. Wordmark: lowercase `shipapis`, JetBrains Mono Bold.
- **Voice:** terminal-precise, lowercase where the machine speaks (`the api directory with a pulse▊`), honest everywhere. **The "humanity drop" is the code comment**, not a serif: epitaphs, the footer pledge, and editorial asides are set as `// comments` in mono (`.comment`, `.epitaph` — the `//` comes from CSS, never typed in copy).
- **Copy honesty is a design rule:** every metric carries what + window; never claim beyond what the checker does; pages must never disagree with themselves (samples render from the same data as the listings).

## 2. Typography — two faces, no serif, no italics

| Role | Face | Notes |
|---|---|---|
| Display, headings, data, labels, code, buttons | **JetBrains Mono** | ALL h1/h2/h3 are mono (set globally). Hero at 42px/700/−0.045em. Buttons are mono 11.5px uppercase. |
| Body prose, descriptions | **Geist** | Paragraphs only. 15px/1.55. |

- Instrument Serif is **retired** (italics were hard to read and serif-accent-words are the #1 AI-design tell of 2026).
- The `.k` microlabel (mono 10.5px, 500, +0.09em, uppercase, text-3) remains the system's signature voice.
- `tabular-nums` on aligned columns only.
- **Fonts are self-hosted** (`public/fonts/*.woff2`, latin + latin-ext variable subsets, ~89KB total; latin files preloaded). No CDN.

## 3. Color

Dark default; light fully tokened (`data-theme="light"`).

- Surfaces: `#0B0C0F` page · `#12141A` raised · `#08090B` inset; hairlines `white@7%/14%`, **section rules `--rule` white@22%** (2px top rules mark major blocks — the board, AOTD, dev strip).
- Ink: `#EDEEF0` / `#9BA1AB` / `#6E7580` — three steps, never more.
- **Accent "signal lime":** `#A3E635` dark / `#4D7C0F` light (hover darkens light-mode). Used only: cursor block, live dot, accent buttons, focus rings, prompt `$`, sparkline, the `alive` word, AOTD label. Never on `.k` labels elsewhere.
- **`--accent-live`** — an interactive-only step (`#A3E635` dark / `#65A30D` light) for non-text signals: cursor, live dot, focus rings, input focus borders. Keeps light mode feeling "live" without failing text contrast; text accent stays `--accent`.
- **Chart marks (validated — do not restyle):** `#059669` ok · `#D97706` partial · `#DC2626` down · nodata gray. Passes CVD ΔE 16.9 + 3:1 on both surfaces. Badge text tints are the brighter WCAG-checked steps; status never appears without its text label.

## 4. Geometry & motion

- **Radii: 2 / 3 / 4px.** Sharp. An instrument, not a bubble. (999px survives only on literal dots.)
- **Directional glyph = the chevron icon** (`<Chev/>`, stroke `currentColor`) in links and CTAs — text arrows (`→`) are retired. `↗` stays for external links; literal `←`/`→` appear only as keyboard-key labels. Mid-prose "maps to" arrows are copy, not UI.
- Rules do the structure: hairlines between rows, `--rule` 2px tops on major blocks, dot leaders in the TOC. **No shadows, no glows, no glassmorphism, no gradients** (the one shadow treatment belongs to floating dialogs — the command palette and the `?` shortcut help — which genuinely float).
- **Width: one surface — `--w-page: 1200px` on every page** (the two-tier system is retired: pages shifting width under the fixed nav read as misalignment). Text measure is constrained per block instead (`max-width` in ch: hero sub 54, page-head p 60, about 68; methodology panels 720px). Backgrounds bleed; text never.
- **No background texture, anywhere.** Grids, dots, meshes, and noise are all template tells. Zones are made by **tone** (the masthead sits on `--bg-inset`, a half-step darker plate) and **rules** — nothing else. The single permitted ornament: two 12px **drafting registration ticks** (top-left / bottom-right corners of the masthead grid, hairline) — a spec-sheet mark, not decoration.
- Motion: three purposeful (view-transition crossfade 140ms, detail bars grow-in staggered, stat count-up) + one ambient (the hero **cursor blink**, 1.15s steps). All gated by `prefers-reduced-motion`. Adding one means removing one.
- **Functional motion is exempt from that budget but must reflect a real wait:** the **loadbar scanline** (2px `--accent-live` bar, blinking `--accent-bright` cursor head) appears only while a navigation is actually in flight; the try-console/submit `░` skeletons are static. No fake spinners, ever — SSR pages render instantly and pretending otherwise is dishonest.

## 5. Layout grammar — the ledger, not the card

- **The board** (`.board` + `.rows` + `.row.row-api`): the primary listing everywhere — 7 columns: API (glyph, mono name) · status · 14-day mini bars · uptime 90d · P50 · auth · checked. Group headers (`.board-head`) are mono caps labels with a rule filling to a VIEW ALL link. Mobile keeps API / uptime / checked and folds status+auth under the name.
- **Masthead** (home, "tighter console"): ruled meta strip (`● FREE-API OBSERVATORY` ←→ `HOW WE PROBE · METHODOLOGY →` — identity + trust, **not** telemetry) → lowercase mono headline with cursor → **one-breath sub (~20 words, no bold)** → **prompt search** (`$` prefix, inset field, `/` + `⌘K` hints) → **start-here row** (`.quick`, **four chips max**: No auth · CORS ✓ · Most reliable · Agents · MCP →). Right column: the live-signals **log tail** (flat, hairline-separated — not a card), **capped at 7 rows + `VIEW ALL SIGNALS →` to `/signals`**; the signals head carries the site's **one** live clock (`SWEEP · 4 MIN AGO`). Categories live in the TOC section, not the hero. The rail closes with the **stat meters** (`.signals-stats`, a ruled 2×2 grid under `VIEW ALL SIGNALS →` — column-divided, not tiles).
- **Signal log** (`/signals`): the raw feed page — last sweep's notable events + lifecycle changes in the same tail grammar (`.signals-full`), linked from the hero and footer.
- **API of the Day:** a featured spec-sheet entry **zoned by tone** — it sits on the same `--bg-inset` plate as the masthead (bleeding one `--pad-page` past the column), 2px top rule, accent label, 21px name, `// why` comment line, full-width 90-day chart. Chips and glyph swap to `--bg` fills on the plate. (A left bar was tried and rejected — it read as a half-open box.)
- **Category index:** a manual-style TOC with **dot leaders** and counts, two columns.
- **Graveyard band:** ruled rows — name † date · `// epitaph` · cause. Count as an inline mono footnote.
- **Boxes are reserved for genuine containers:** code blocks, the try-console output, the command palette, glyph tiles, form inputs, the dashed empty state. Everything else is rules on the page plane. (The old sponsor placeholder is retired — its slot is the house meta-API CTA until a real sponsor fills it.)
- **Detail page anatomy:** header (glyph · title · chips · score ring · `▶ Run live` when CORS allows · Docs · README badge + copy-markdown under the action cluster) → dead-band when applicable (`🪦 DEAD · † date · // epitaph → graveyard`) → sticky on-this-page strip (`.detail-nav`) → two columns: charts/sample/call-it/shape left; sticky sidebar right (verified metadata → similar + VS compare tabs → meta-API CTA).
- **Compare** (`/compare/a/b`): two spec sheets on one rule — `.cmp` ledger, 3-column rows, objectively-better numbers bolded, qualitative facts neutral.
- **Category hubs** open with a `.cat-stats` health strip (tracked · healthy · degraded/dying · median P50 · median uptime 30d) — the "status surface" grammar.
- **OG cards** (`/og-card/*` → `scripts/og.mjs` → `public/og/*.png`): every page ships a 1200×630 card in the same grammar — meta strip, mono title, chips, 30-day bars, `shipapis.dev/…` in accent.
- Homepage order: nav → masthead (meta / copy+prompt+quick | signals tail + stat meters) → API of the Day → the board (reliable / fastest / newly added) → category index → graveyard band → dev strip → footer.

## 6. Anti-slop rules (enforced taste)

1. **No card grids.** If a design needs a grid of rounded boxes, redesign it as a ledger.
2. One accent. No gradient text, no mesh backgrounds, no glassmorphism, no emoji outside glyph tiles.
3. No serif, no italics. Editorial voice = `// code comments`.
4. Three ink shades; hierarchy from type scale + mono/sans contrast.
5. Every metric labeled (what + window); every number plausible; real middle-clickable links.
6. Dead links and inert controls are bugs. Nav shows only pages that exist.
7. Status colors report state only — never hover feedback, never decoration.
8. Charts follow the dataviz method: baseline-anchored, recessive grid, legend when ≥2 meanings, validator-passed palettes, native `title` banned (shared `.tip` tooltip instead).
9. **No breadcrumbs, ever — and no page-head kicker labels** (`BROWSE · …`, `SUBMIT`, …). A page opens with its h1 and one-line sub; context = the category pill in the detail header. The logo is Home.
10. No CTA that dead-ends; no "Home" nav link.

## 7. File map

```
shipapis/
├── wrangler.jsonc        # one Worker + static assets (production architecture from day 1)
├── src/
│   ├── index.tsx         # Hono router: pages + meta-API v1 (/api/v1/*, /data/apis.json) + /badge/*.svg + /og-card/*
│   ├── ui.tsx            # SSR components & pages (Hono JSX, no client framework)
│   └── seed.ts           # deterministic seed catalog (→ replaced by D1 in the checker milestone)
├── public/
│   ├── styles.css        # the entire design system (tokens → components)
│   ├── app.js            # client behavior: filter, palette, tooltips, try-console, submit probe, ? help, menu
│   ├── fonts/            # self-hosted variable woff2 (latin + latin-ext) + fonts.css
│   └── og/               # pre-rendered 1200×630 OG cards (regenerate with scripts/og.mjs)
├── scripts/
│   ├── shots.mjs         # responsive screenshot rig (system Chrome)
│   └── og.mjs            # OG-card generator (needs `npm run dev` on :8787)
├── DESIGN.md             # this file — the canon
└── REVIEW.md             # design-review fix ledger (Tier 5 items pending with D1)
```

Pages: `/` `/browse` `/c/:slug` `/api/:slug` `/compare/:a/:b` `/signals` `/graveyard` `/developers` `/methodology` `/submit` `/about` `/privacy` `/terms` (+ 404). Footer: identity column (brand · pledge · sweep line) + Directory / Developers / shipapis columns + a mono legal strip (©, CC-BY-4.0, no-tracking pledge, contact). Prose pages use `.prose` (68ch, accent links) with `// last updated` comment lines instead of kickers.
