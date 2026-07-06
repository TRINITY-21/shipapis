# shipapis seed-import verification batch

You are verifying free-API candidates for a health-checked API directory. Your batch
file (path given in your prompt) contains ~24 candidates parsed from the MIT-licensed
public-apis list. For EACH candidate, either VERIFY it with a real HTTP probe or SKIP
it with a reason. Never fabricate: an entry ships only if you observed a live response.

## Per candidate

1. **Find the real API base URL and one keyless GET sample endpoint.**
   - Use your own knowledge first; if unsure, WebFetch the docsUrl and read the docs.
   - The sample endpoint must be a GET that needs NO key, NO signup, NO POST body,
     and returns JSON. Prefer a small, representative request (like `/latest?base=USD`).
2. **Probe it** (max 3 curl attempts total per candidate, then skip):
   ```
   curl -sS -m 8 -L \
     -H 'User-Agent: shipapisbot/1.0 (+https://shipapis.dev/methodology)' \
     -H 'Origin: https://shipapis.dev' \
     -D /tmp/h.txt -o /tmp/b.json -w '%{http_code} %{time_total}' 'https://…'
   ```
   - Require HTTP 200 and parseable JSON in the body.
   - `latencyMs` = time_total × 1000, rounded.
   - `corsObserved`: true if response headers include `access-control-allow-origin`
     (`*` or echoed origin), false if headers were readable but it's absent, null if unclear.
   - `sampleJson`: the real response, TRIMMED to a small representative object
     (≤ ~8 keys / ≤ ~12 lines; truncate arrays to 1–2 items). Must come from the
     actual body — never typed from memory.
3. **Write original copy.** `tagline` (≤ 70 chars) and `description` (2–3 sentences)
   in your own words — playful-but-precise, factual, no marketing fluff. Do NOT copy
   or lightly paraphrase the source description (legal requirement).
4. **Fill metadata honestly** — only from the provider's own docs/terms pages:
   - `freeTier`: stated limits, else `"Free — limits not published"`
   - `rateLimit`: stated policy, else `"Unpublished"`
   - `dataLicense`: stated license, else `"Unverified"`
   - `commercialUse`: `"yes"`/`"no"` only if terms are explicit, else `"unclear"`
   - Do NOT guess numbers. An honest "Unpublished" beats a plausible invention.

## Skip (record name + short reason) when:
- Docs or endpoint dead / requires key despite the listing / no keyless JSON GET
- Response is HTML, an error, or requires auth headers
- NSFW, piracy-adjacent, or obviously abandoned (docs mention shutdown, cert dead)
- You cannot verify within 3 attempts

## Output

Write ONE file: `batch-NN.json` (same NN as your input, same directory as your input file):

```json
{
  "batch": 7,
  "verified": [
    {
      "name": "Frankfurter", "slug": "frankfurter", "emoji": "💱",
      "tagline": "…", "description": "…",
      "sourceCategory": "Currency Exchange",
      "docsUrl": "https://…", "baseUrl": "https://api.…/v1",
      "sampleEndpoint": "/latest?base=USD&symbols=EUR",
      "latencyMs": 84, "corsObserved": true, "httpStatus": 200,
      "sampleJson": { "…": "trimmed real response" },
      "freeTier": "…", "rateLimit": "…", "dataLicense": "…",
      "commercialUse": "yes|no|unclear",
      "notes": "anything odd (optional)"
    }
  ],
  "skipped": [ { "name": "…", "reason": "…" } ]
}
```

- `slug`: kebab-case of the name (lowercase, alphanumeric + hyphens).
- `baseUrl`: no trailing slash. `sampleEndpoint`: starts with `/`, includes query string.
- Valid JSON only, no comments/trailing commas.

Your final message: just `batch NN: X verified, Y skipped` plus one line per skip reason
category. Do not paste entries into the message — the file is the deliverable.
