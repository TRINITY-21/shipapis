-- Materialized per-API health series so the hot read path (loadCatalog) stops joining 90 days of
-- checks_daily on every request. Written nightly by the checker's recomputeHealth as a compact JSON
-- blob { u: uptime90[], l: latency48[], p50, p95 }; read directly by loadCatalog. NULL until the
-- first recompute backfills it, at which point loadCatalog skips the checks_daily join entirely.
alter table apis add column health_series text;
