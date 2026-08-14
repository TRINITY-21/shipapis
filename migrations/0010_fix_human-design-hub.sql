-- Owner-reported probe correction (2026-08-14), human-design-hub.
-- The active probe hit GET /v2/simple-bodygraph at the strict 'endpoint' tier, but that route is a
-- documented POST requiring X-API-Key + a JSON body — every 401 measured our misconfiguration, not
-- the API. Verified: GET /health returns 200 JSON with no key, and a CORS preflight from an
-- arbitrary origin returns 204 with the origin echoed. Repoint the probe, drop the auto-expanded
-- /v2 GET variants (an auth middleware 401s every path, so they are unverifiable), purge the check
-- history recorded against the wrong route, and reopen monitoring from scratch — the Δ2 honesty
-- gate re-stamps monitored_since on the next real check. Idempotent: delete-then-insert.

delete from endpoints
 where api_id = (select id from apis where slug = 'human-design-hub');
-- ^ cascades checks / checks_daily / response_shapes / shape_changes for these endpoints.

insert into endpoints (api_id, method, url_template, description, active) values
  ((select id from apis where slug = 'human-design-hub'),
   'GET', 'https://api.humandesignhub.app/health',
   'Health check — public, no key required.', 1),
  ((select id from apis where slug = 'human-design-hub'),
   'POST', 'https://api.humandesignhub.app/v2/simple-bodygraph',
   'Generate a simple bodygraph (JSON body, X-API-Key header).', 0);

update apis
   set tagline         = 'Human Design bodygraph charts — free tier with API key',
       description_md  = 'Human Design Hub generates bodygraph charts as JSON. The chart endpoint is POST /v2/simple-bodygraph with an X-API-Key header and a JSON body; we probe the public /health endpoint, which needs no key.',
       auth_header     = 'X-API-Key',
       cors_verified   = 1,
       status          = 'unmonitored',
       health_score    = null,
       health_series   = null,
       monitored_since = null,
       last_checked_at = null,
       tombstoned_at   = null,
       epitaph         = null,
       verified_at     = '2026-08-14'
 where slug = 'human-design-hub';
