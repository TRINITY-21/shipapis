# Homepage review — prioritized fix list

> STATUS 2026-07-05: Conversion sprint SHIPPED (see bottom section). Tiers 1-4 SHIPPED 2026-07-04, plus the two-tier width system (--w-page 1128 / --w-wide 1360). Remaining: Tier 5 (scheduled with the D1 milestone) and one Tier-3 straggler: the full type-size ladder collapse (weights are done; the 14-size sweep is not).
>
> Output of the 4-lens design review (IA · copy · visual craft · mobile/a11y), 2026-07-04,
> synthesized and de-duplicated. Work top tier down. Full agent findings in session transcripts.

## Tier 1 — honesty bugs (the brand IS the numbers; these are falsifiable on-page)

- [x] **"2 · Died this month" is false.** Deaths were May 14 + Jun 2; today is Jul 4. Relabel "Deaths on record" or compute honestly ("0 died this month" is a flex).
- [x] **Kicker overclaims:** "EVERY ENDPOINT TESTED" → we probe one documented endpoint per API. Use "EVERY API PROBED · SWEEP EVERY 15 MIN". Standardize verbs site-wide: probe/check = the act, sweep = the batch.
- [x] **"Newest" rail padded with decade-old APIs** (Wikipedia REST, Open-Meteo). Rename "Newly added", add `ADDED JUN 22` chip, never pad — show 1–2 honest cards or hide the rail.
- [x] **Dev-strip sample JSON contradicts the cards** (open-meteo health 96 vs 100 on same page). Render the codeblock from the same seed as the cards — never hand-typed numbers.
- [x] **Naked metrics:** "Fastest" (→ "Fastest · P50"), "Median latency" (→ "Median latency · 24h"). Every number: what + window.
- [x] **AOTD "why" quote restates the tagline verbatim.** Spend the editorial slot on an angle: "Self-hostable is the real free tier — if it ever dies, you can run it yourself."

## Tier 2 — functional bugs

- [x] **Copyable curl is broken shell** — unquoted `&` backgrounds the command. Quote the URL in display + data-copy.
- [x] **Hero placeholder suggests "no auth" — which returns NO SIGNAL** (data-search encodes `none`). Add aliases (" no auth no key free") to auth:none cards' data-search.
- [x] **Signals mobile cap off-by-one AND cuts the only fail row:** `.sig:nth-child(n+5)` counts the head → 3 rows survive, Open Notify's red "timeout" hidden. Fix count, curate slice (always keep one non-OK), scope cap to ≤560px.
- [x] **AOTD 90-bar chart overflows every iPhone** (min 358px > ~306px available). ≤560px: render 30 bars (don't clip 90 — that misreports the window).
- [x] **No `scroll-padding-top`** — sticky 60px nav covers every anchor jump + search scrollIntoView. Add `html { scroll-padding-top: 76px }`.
- [x] **COPY buttons invisible to keyboard/touch** (opacity:0, hover-only). Add `:focus-visible` + `@media (hover:none)` reveal.
- [x] **iOS zoom:** 14px inputs → 16px at ≤900px.
- [x] **Footer/label mismatches:** "All APIs" → /browse; "Signals" column → "Explore"; three "VIEW ALL →" → `/browse?sort=reliable|fastest|newest` (and make /browse honor it).

## Tier 3 — craft (visual)

- [x] **Dedupe spotlight slots:** AOTD + rails currently surface 9 unique APIs in 13 slots. Exclude AOTD from rails; exclude earlier-rail picks from later rails. Reliable rail 6 → 3 cards.
- [x] **Flip the AOTD grid** — chart into the wide 1.3fr column (2.5px bars currently thinner than commodity cards); caption the ring "HEALTH" separately from "UPTIME · 90 DAYS" (stacked, not space-between).
- [x] **Accent scarcity in hero:** drop lime from `.signals-head .k` and `.k-accent`; one blinking dot per viewport (kicker keeps it; signals-head dot goes static).
- [x] **Vertical rhythm two-step (~40 inner / ~64 section):** hero padding-bottom 56→32 (kills the 108px statrow→AOTD gap), delete dev-strip's stray 26px margin, statrow margin 44→40.
- [x] **Serif budget back to 3:** keep H1 "alive", epitaphs, footer pledge; un-serif `.aotd-why` and dev-strip "itself".
- [x] **Radius scale:** `.aotd`/`.dev-strip` 16px → `var(--r-l)`; pads onto the 4px grid.
- [x] **Number scale inversion:** gy-count 30px > hero stats 26px. Hero stays largest.
- [x] **gy-count hover red** violates rule 7 (status ≠ decoration) → border-strong.
- [x] **Emoji in labels:** drop "☀" from AOTD label; wrap sig-change emoji in aria-hidden spans.
- [x] **Dead CSS:** `.search max-width:620px` (never binds), duplicate 560px statrow rule, no-op light `.j-str` override.
- [~] **Type-scale fuzz (partial):** heading weights collapsed to 600/650 and the h3/h2 collision fixed; the full 14-size sweep remains — collapse to the ladder (10.5/11.5/12.5/13.5/15/16.5/20/24/28), two heading weights (600/650).
- [x] **Copy batch:** "…verified before you ship." (the name's verb, once); pledge → "We don't sell placement. The data decides."; "Submit an API" everywhere; AOTD CTA → "Try Frankfurter live →"; home empty-state drops "loosen a filter"; graveyard blurb → "so you know exactly why that old tutorial broke."; one date grammar (ISO on tombstones, JUN 2 in feeds — documented).

## Tier 4 — accessibility structure

- [x] **Heading outline:** AOTD label becomes the section h2 (styled as .k); no more h3-before-h2.
- [x] **Palette dialog:** focus trap, `role="listbox"` + `aria-activedescendant`, restore focus on close.
- [x] `aria-hidden="true"` on all `.glyph` spans (cards/cats/AOTD/tombs).
- [x] Persistent sr-only live region for the results count (live regions inside `[hidden]` don't announce).
- [x] `aria-label="Search APIs"` + `type="search"` on inputs; quick-cats div → `<nav>`; mobile menu Escape/outside-tap close; 40px icon targets at ≤900px.
- [x] Mobile rows: keep API · Uptime · **Checked** (the tagline!), fold status+auth into the name cell.
- [x] Mobile hero length: quick-cats → single-row `overflow-x:auto` scroller (or 4 + "ALL 8 →").
- [x] Touch path for bar tooltips: tap routes `data-tip` through the shared `.tip`.

## Tier 5 — architecture (schedule with the D1 milestone)

- [ ] **Kill the hidden `#results` full-card grid** (194KB HTML at 16 APIs → multi-MB at 600; triple-renders the catalog with `#api-index`). Route hero search → command palette now; server-rendered `/browse?q=` at D1 time; palette index fetched on first open instead of inlined.
- [~] Categories grid differentiator at scale: tiles become status surfaces ("Weather · 41 APIS · 3 DEGRADED") — **category hub pages now open with a `.cat-stats` health strip**; the home TOC keeps counts only until D1.
- [x] DESIGN.md token drift (documented shipped hexes + accent-hover semantics; token NOT renamed to avoid churn): document shipped hexes (#4d7c0f light accent, #6e7580 text-3); rename `--accent-bright` → `--accent-hover`.

## Conversion & launch-readiness sprint — 2026-07-05 (external product-design review)

### Conversion paths
- [x] **Home start-here row** (`.quick`): NO AUTH / CORS ✓ / COMMERCIAL OK / FASTEST chips under the prompt → `/browse?facet=…`; browse pre-selects the facet server-side and app.js applies it on load.
- [x] **Browse sort tabs** (`.sort-tabs`): Health · Reliable · Fastest · Newest, active state + `aria-current`, `?facet=` preserved across sort switches.
- [x] **Home search feedback**: visible `Clear ✕` in the results board-head; count was already live via `#q-count`.
- [x] **Detail: `▶ Run live` in the header** (CORS+HTTPS+alive only) — scrolls to and fires the try console; plain `#try` anchor without JS.
- [x] **Detail: sticky sidebar** on desktop (`top: 76px`, max-height + thin internal scroll) — free-tier/commercial fine print stays in view.
- [x] **Detail: sticky on-this-page strip** (`.detail-nav`: Uptime · Sample · Try it · Shape · Metadata) with `scroll-margin-top` on targets.
- [x] **Sponsor placeholder replaced** with the house meta-API CTA ("This page, as JSON" + curl + docs link).

### Launch surface
- [x] **OG images**: `/og-card/home|api/:slug|cat/:slug` render targets + `scripts/og.mjs` (system Chrome) → `public/og/*.png`; full og:/twitter: meta set with per-page images. Regenerate after seed changes.
- [x] **Self-hosted fonts**: latin + latin-ext variable woff2 (~89KB total), preloaded, Google CDN removed (closes the DESIGN.md pre-production requirement).
- [x] **/submit page**: spec-sheet form + live browser probe (same voice as the try console); failed CORS probe doesn't disqualify — copy states server-side re-probe; output = submission JSON + COPY + mailto. Nav/footer/developers all point at `/submit`.
- [x] **Status badges**: `/badge/:slug.svg` (shields-grammar, mono, status-colored, 5-min cache) + README markdown snippet with preview on every detail page.
- [x] **Compare**: `/compare/:a/:b` two-spec-sheets ledger (objectively better numbers bolded, qualitative neutral) + VS tabs on detail "Similar" rows.

### Craft & trust
- [x] **Category hub health strip** (`.cat-stats`): tracked · healthy · degraded/dying · median P50 · median uptime 30d.
- [x] **Dead-API band on detail** (`🪦 DEAD · † date · // epitaph → THE GRAVEYARD`) — the graveyard reaches back into the directory.
- [x] **Developers: MCP one-liner** (`claude mcp add --transport http shipapis …`) with COPY.
- [x] **Methodology: weight cells** (60 / 20 / 20) above the formula.
- [x] **Empty state ASCII moment**: `// no signal on this frequency`.
- [x] **Try-console static skeleton** (`░` placeholder rows, no new motion).
- [x] ~~AOTD editorial marker: 2px `--rule` left bar~~ — **reverted on user review** (read as a half-open box); the accent AOTD label carries the editorial distinction alone.
- [x] **Graveyard band mobile**: epitaph restacks under the name instead of being hidden (the emotional hook survives ≤900px).
- [x] **Light-mode live accent** (`--accent-live` #65A30D): cursor, live dot, focus rings, input focus — non-text only; text accent unchanged.
- [x] **`?` shortcuts overlay** (floating dialog, palette treatment): `/`, `⌘K`, `←→`, `esc`, `?`.

### Hero edit — Option A "tighter console" (follow-up review, same day)
- [x] **One live clock**: meta strip is identity + `HOW WE PROBE · METHODOLOGY →` (the trust link); sweep time lives only in the signals head. Stat strip keeps its own labeled window (`Checks · last 24h` is a different metric, not a duplicate clock).
- [x] **Sub trimmed to one breath** (~17 words, no bold clause): "Free APIs probed every 15 minutes — uptime, latency, CORS, and the fine print, not stale links."
- [x] **Prompt hints `/` + `⌘K`** (⌘K hidden ≤560 — no ⌘ on phones); placeholder shortened to "search — weather, no auth, geocoding…".
- [x] **Quick row trimmed to 4** (No auth · CORS ✓ · Most reliable · Agents · MCP →), label dropped — chips self-explain. `⌘` glyph dropped from the MCP chip (non-Mac clarity).
- [x] **Category line removed from the hero** — categories live in the TOC section (14 tap targets → 4).
- [x] **Signals capped in the hero** (7 rows after user feedback — fills the column; curated slice keeps non-OK rows) + `VIEW ALL SIGNALS →`; **status changes moved out of the hero** to the new **`/signals` log page** (same tail grammar, footer-linked) — no dead-end CTA. Seed feed extended to 9 signals.
- [x] **Loadbar scanline** (user request): 2px `--accent-live` bar with blinking `--accent-bright` cursor head, fixed top, shown only while an internal navigation is in flight (click → pageshow, 8s strand guard; skips ⌘-click, `_blank`, external, in-page anchors). Functional motion — documented as exempt from the ambient budget. No fake spinners on SSR pages.

### Page-head kickers removed (user call, same day)
- [x] All page-head `.k` kicker labels deleted (`BROWSE · SORT`, `SUBMIT`, `DEVELOPERS`, `METHODOLOGY`, `COMPARE · …`, `SIGNAL LOG`, `🪦 THE GRAVEYARD`) — pages open with the h1; sort context lives in the tabs. Canon rule 9 extended. (404's `404 · NO SIGNAL` stays — it's the error state, not a label.)

### Adversarial review findings — 6-dimension multi-agent audit, 2-skeptic verification (same day)
15 raw confirmations → 13 unique defects, all fixed; 4 split verdicts triaged (3 fixed as cheap wins, 1 refuted):
- [x] **Badge SVG contrast**: white 11px text was 3.8:1 / 3.2:1 on healthy/degraded — BADGE_BG switched to the darker status steps (all ≥5:1).
- [x] **Submit COPY button resubmitted the form** (no `type="button"` inside `<form>`).
- [x] **Submit probe race**: no in-flight guard — resubmit now aborts the prior probe (generation counter) and disables the button while probing.
- [x] **⌘K under ? overlay**: palette opened invisibly underneath — ⌘K now closes the help first.
- [x] **? overlay a11y**: no focus move/trap/restore — dialog gets `tabindex="-1"`, focus moves in, Tab is held, focus restores on close.
- [x] **Facet buttons**: `aria-pressed` server-rendered + mirrored on toggle; `#sr-count` live region added to category pages and now announces facet-only filtering.
- [x] **Detail double-sticky chrome**: `html:has(.detail-nav)` bumps scroll-padding to 118px so keyboard focus isn't hidden behind nav + sub-nav.
- [x] **Compare**: uptime bars got a legend (§6.8) and the div grid got full table ARIA (`table/row/rowheader/columnheader/cell`).
- [x] **Honesty — MCP phantom**: /developers advertised a live `/mcp` that 404s — panel now reads `SHIPS WITH THE PUBLIC BETA`, tools list future-tense. (Real `/mcp` route is MVP item #1 in MASTERPLAN §Δ.)
- [x] **Honesty — methodology formula misprint**: `round(blend) × 100` could only yield 0 or 100 — parenthesization fixed to match seed.ts.
- [x] **Honesty — graveyard**: "delisted from the directory" was false (dead APIs render in /browse) — reworded: dead APIs stay listed, marked DEAD.
- [x] **Honesty — submit overclaims**: "same check our monitor runs" / "we re-probe server-side" dropped; copy now promises only the browser probe + verification before listing (Developers page aligned).
- [x] **Honesty — dev-strip sample**: `"cors": true` boolean contradicted the API's `"yes"` string — sample now renders API-shape values + a `// trimmed` marker.
- [x] **Submit auth vocabulary**: `key` → `apiKey` (catalog enum).
- Refuted (no change): aria-live-inside-hidden announcement race — only the transient progress line lands in the same tick; results announce.

### Alignment & hero data (user calls, same day)
- [x] **Two-tier width system retired** (user call — pages shifted width under the nav and read as misalignment): one `--w-page: 1360px` surface everywhere; per-block `max-width` keeps text measures readable. (Supersedes the Tier-3 `--w-page/--w-wide` split and the interim `wide` Layout prop.)
- [x] **Hero signals 4 → 7 rows** (seed feed extended to 9 with PokéAPI · Dog CEO · Nominatim), fills the column.
- [x] **Hero sub honesty**: "probed every 15 minutes" violated the §Δ covenant (sweep cadence ≠ per-API cadence) — now "probed around the clock".
- [x] **Loadbar scanline** on every page (see hero-edit section).
- [x] **Detail header restructured**: meta split into context/state row + chips row; Run live/Docs stacked in a tidy action column.

- [x] **Anchor-button hover ink bug** (user report): global `a:hover { color: var(--text) }` outranked `.btn-accent`'s ink (specificity 0,1,1 vs 0,1,0), so `▶ Run live` / `Submit an API` text flashed white on lime — hover color now explicit on `.btn:hover` and `.btn-accent:hover`.

### Footer, company pages & AOTD prominence (user request, same day)
- [x] **Newsletter — "The signal"**: homepage ruled band (mirrors the dev-strip grammar) + compact footer block. No fake subscriber counts; copy promises "short, occasional, one-click out". Submit is a prefilled mailto to hello@shipapis.dev until a real subscribe endpoint lands with D1 (swap point marked in app.js). Mast stat cells got breathing room above the masthead's bottom rule (2→18px).
- [x] **Footer rebuilt**: identity column gains the sweep line (`● SWEEP EVERY 15 MIN · N APIS ON THE BOARD`); columns → Directory (5) / Developers (Meta-API · MCP · Dataset · OpenAPI · llms.txt) / shipapis (About · Submit · Privacy · Terms); new mono **legal strip** (© · CC-BY-4.0 · no tracking scripts, no cookies · hello@).
- [x] **/about** — story, how-it-works, and the five house rules as ruled rows.
- [x] **/privacy + /terms** — plain-language, honest to the code (try-console calls go browser→provider directly; localStorage theme; CC-BY-4.0 data license; no-warranty framing). Starting-point drafts, not legal advice.
- [x] **AOTD zoned by tone**: sits on the masthead's `--bg-inset` plate (bleeds one pad past the column), name 17→21px, glyph 48→56px, chips/glyph swap to `--bg` fills.
- [x] **Mobile navbar fix** (user report): actions cluster was stranded mid-bar — `.nav-links`' `margin-right:auto` dies with `display:none`; `margin-left:auto` moved onto `.nav-actions`.

- [x] **Footer misalignment** (user report): `.footer-inner`/`.footer-legal` used `padding: Xpx 0 Ypx` shorthand on the same element as `.wrap`, wiping `.wrap`'s horizontal padding — footer sat 48px left of the content column (pre-existing since v2, exposed by the rebuild). Longhand `padding-top/bottom` now; rule of thumb recorded: never use padding shorthand on an element that also carries `.wrap`.

- [x] **Chevron icons replace text arrows** (user call): all 14 link/CTA `→` glyphs → `<Chev/>` SVG (stroke currentColor, 2.5 weight); kept: `↗` external, `← →` kbd key labels, mid-prose "maps to" arrows. Canon §4 amended.

- [x] **Footer v2** (user call — "professional & matured"): now the **closing plate** — same `--bg-inset` tone + 2px top rule as the masthead (the page opens and closes on the same surface). One 4-column grid (identity+newsletter | Directory | Developers | shipapis) instead of flex drift; telemetry (`● SWEEP …`) moved out of the identity column into the legal strip; newsletter trimmed to label + row; link type up to 12.5px/5px rhythm. Mobile: identity spans full width, link columns pair 2-up. About-page rules rows stack ≤700px (inline grid style removed).

### Deliberately deferred
- Learn/recipes pages — content milestone (real recipes only; no ghost-town scaffolding).
- Hidden `#results` removal — Tier 5, D1 milestone.
- PWA favicon pulse — review itself calls it overkill.
