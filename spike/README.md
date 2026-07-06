# shipapis-spike — week-1 validation (MASTERPLAN §12 #1/#2)

Self-contained mini-worker. Before building the real health checker, measure from **real
Cloudflare Worker egress**:

1. **Spike #1 — bot-challenge rate.** What fraction of popular free-API endpoints
   bot-challenge or block Cloudflare egress IPs (the freepublicapis false-positive failure
   mode: an API marked "down" because the checker's IP got challenged, not because the API died).
2. **Spike #2 — keyless-checkable rate.** What fraction of a representative free-API sample
   is live-testable without a key (`auth: none` / `keyed-demo`) vs key-required vs unverifiable.

~100 endpoints in `endpoints.ts` (~70 keyless incl. 3 public-demo-key, ~30 keyed). Keyed
entries are hit **without** a key — the expected 401/403 proves the server answers
(server-up signal), it is not a health pass.

Nothing here touches the main worker: own `wrangler.jsonc`, no bindings, no storage.
Results are returned as JSON to the caller — you keep the outputs.

## Run locally (smoke test only)

```sh
cd spike
npx wrangler dev
curl -s 'http://localhost:8787/run?batch=0' | jq .headline
curl -s 'http://localhost:8787/run?batch=1' | jq .headline
curl -s 'http://localhost:8787/run?batch=2' | jq .headline
```

**`wrangler dev` egresses from your home IP, not Cloudflare's** — local runs only prove the
code works. The measurement requires the deploy below.

## Deploy to workers.dev (the real test)

```sh
cd spike
npx wrangler deploy
```

Then hit `https://shipapis-spike.<your-account>.workers.dev/run?batch=N`. Batches are
*interleaved* slices (`index % 3`), so each batch is a representative keyless/keyed mix and
stays under the 50-subrequest hard cap (~35 fetches per batch). `GET /` prints usage.

## 3-day protocol

3–4 times a day (spread across morning / midday / evening, so different colos and different
target-side load get sampled), fetch **all batches** and keep every output:

```sh
mkdir -p runs
STAMP=$(date +%Y%m%dT%H%M)
for b in 0 1 2; do
  curl -s "https://shipapis-spike.<account>.workers.dev/run?batch=$b" > "runs/$STAMP-b$b.json"
done
```

Etiquette baked in: single GET per endpoint per run, no retries, 5s abort, concurrency 5,
UA `shipapisbot-spike/0.1 (+https://shipapis.dev/methodology)`. At ~10 runs over 3 days each
endpoint sees ~10 requests total — well under anyone's radar. (The DEMO_KEY / agify / GitHub
entries share per-IP quotas with everyone else on that egress IP; a 429 there is itself data.)

Aggregate a day's runs:

```sh
jq -s '[.[].results[]] | group_by(.class) | map({(.[0].class): length}) | add' runs/*-b*.json
jq -s '[.[].results[] | select(.class=="bot_challenge")] | group_by(.slug) | map({slug:.[0].slug, hits:length, signal:.[0].signal})' runs/*.json
```

## Residential comparison (`local-run.mjs`)

Same list, same UA, same classification, direct from your machine — the diff separates
"blocks Cloudflare egress" from "just down":

```sh
node --experimental-strip-types local-run.mjs > runs/local-$(date +%Y%m%dT%H%M).json
# Node >= 23.6: plain `node local-run.mjs`. Optional batch arg mirrors the worker slices.
```

Per-slug diff of one worker run vs one local run:

```sh
join <(jq -r '.results[] | "\(.slug) \(.class)"' runs/<worker>.json | sort) \
     <(jq -r '.results[] | "\(.slug) \(.class)"' runs/<local>.json  | sort) \
  | awk '$2 != $3'
```

Rows where worker says `bot_challenge`/`auth_wall` and local says `ok_2xx` are the exact
false-positive population spike #1 exists to size.

## Decision thresholds (MASTERPLAN §12)

| Spike | Readout | Threshold | Consequence |
|---|---|---|---|
| #1 | `headline.bot_challenge_rate_pct`, sustained across the 3 days | **> 10–15%** | Plan a fallback runner for flagged APIs (GH Actions in the project's own repo is defensible, or any free-tier VPS/cron) before building the real checker |
| #2 | `headline.keyless_checkable_rate_pct` | **< 50%** | Ship explicit tiers: **live-tested** vs **link-verified** — honest labeling beats overclaiming |

Also eyeball `counts.keyless_now_walled` (keyless endpoints that grew an auth wall —
ecosystem drift the catalog import must handle) and the worker-vs-local diff list.

## Classification

| class | meaning |
|---|---|
| `ok_2xx` | answered 2xx |
| `auth_wall_401_403` | 401, or 403 with no challenge markers — *expected* for `auth: keyed` |
| `http_4xx` | other 4xx (incl. 429 without challenge markers) |
| `http_5xx` | 5xx (incl. 503 without challenge markers) |
| `timeout` | no response headers within 5s |
| `dns_or_network` | fetch threw before any response |
| `bot_challenge` | 403/429/503 **with** `cf-mitigated` header, Cloudflare challenge markers ("Just a moment", `challenge-platform`, "Attention Required", `cf_chl`), Akamai (AkamaiGHost, "Reference #"), or PerimeterX (`px-captcha`, `_pxhd`) signatures — bodies sniffed only on those statuses, capped at 2KB |

Per MASTERPLAN §6: bot-challenged endpoints are "unverifiable from our infrastructure",
**never** "down".

## Known list caveats

- `coindesk-bpi` is a **deliberate dead control** (retired mid-2024) — it should classify
  `dns_or_network`/`http_4xx` everywhere; if it reads `ok_2xx`, distrust the run.
- `numbersapi` (HTML 404s) and `spacex` (origin TLS broken, 525) were found already rotten
  during list curation (2026-07) and kept as honest rot samples — expect ~3 dead keyless
  entries to depress the keyless rate by ~3 points.
- `binance` geo-blocks some regions (451) — expected `http_4xx` from US colos.
- apilayer-run entries (`ipstack`, `exchangerate-host`) may answer 200 with an error body
  keyless; they're `auth: keyed`, so a 2xx there never inflates the keyless rate.
- `bored-api` points at the App Brewery community mirror of the dead boredapi.com —
  least-certain entry in the list.
- `quotable`, `swapi`, `httpbin` are known-flaky on purpose; `launch-library`, `agify`,
  `genderize`, `github`, `nasa-apod` are shared-IP quota canaries.
