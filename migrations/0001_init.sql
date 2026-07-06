-- 0001_init — full D1 schema per MASTERPLAN §5.1 + Δ4 #9 additions.
-- Conventions: integer 0/1 booleans, TEXT ISO-8601 UTC timestamps, CHECK-constrained enums.
-- D1 free tier bills SCANNED rows against the 5M/day read budget — every query path
-- below carries an index; an unindexed scan is the #1 self-DoS risk (§5.1).
-- Deferred per Δ5 (add in a later migration when un-cut): recipes, videos.

-- --- core catalog -----------------------------------------------------------

create table categories (
  id             integer primary key,
  slug           text not null unique,
  name           text not null,
  emoji          text not null default '',
  description_md text not null default '',
  api_count      integer not null default 0   -- denormalized; nightly rollup maintains
);

create table apis (
  id               integer primary key,
  slug             text not null unique,
  name             text not null,
  emoji            text not null default '',
  tagline          text not null default '',
  description_md   text not null default '',  -- ORIGINAL prose, never copied (§12 legal)
  category_id      integer not null references categories(id),
  docs_url         text,
  base_url         text,
  openapi_url      text,                      -- Δ4 #9
  signup_url       text,                      -- Δ4 #9
  auth_type        text not null default 'none'
                   check (auth_type in ('none','apiKey','oauth','userAgent')),
  auth_param       text,                      -- Δ4 #9 — query-param key style (NASA ?api_key=)
  auth_header      text,                      -- Δ4 #9 — header key style (X-Api-Key …)
  check_tier       text not null default 'endpoint'
                   check (check_tier in ('endpoint','reachability','docs','listed')),
  https            integer not null default 1 check (https in (0,1)),
  cors_verified    integer check (cors_verified in (0,1)),  -- null = unverified; measured from real browser checks, not claimed
  free_tier_notes  text,                      -- "500 req/day, no card" — the metadata everyone omits
  rate_limit_notes text,
  requires_card    integer not null default 0 check (requires_card in (0,1)),
  commercial_use   text not null default 'unclear'
                   check (commercial_use in ('yes','no','unclear')),  -- SERVICE terms of the free tier (§6.8)
  data_license     text,                      -- license of the DATA itself, distinct from service terms
  status           text not null default 'unmonitored'
                   check (status in ('new','healthy','degraded','dying','dead','resurrected','unmonitored')),
  health_score     integer,                   -- null until first rollup; data_tier is computed at the API layer, never stored
  popularity       integer not null default 0,
  added_at         text not null,
  verified_at      text,
  monitored_since  text,                      -- Δ2 honesty gate: null until the first REAL check lands
  last_checked_at  text,
  tombstoned_at    text,                      -- date of death (seed diedAt)
  epitaph          text,                      -- graveyard copy; catalog metadata (addition over the §5.1 sketch)
  owner_claimed    integer not null default 0 check (owner_claimed in (0,1)),
  check_opt_out    integer not null default 0 check (check_opt_out in (0,1))
);

create index idx_apis_category_health on apis(category_id, health_score);
create index idx_apis_status on apis(status);
create index idx_apis_check_tier on apis(check_tier);

create table tags (
  id   integer primary key,
  slug text not null unique,
  name text not null
);

create table api_tags (
  api_id integer not null references apis(id) on delete cascade,
  tag_id integer not null references tags(id) on delete cascade,
  primary key (api_id, tag_id)
);

create index idx_api_tags_tag on api_tags(tag_id);  -- reverse lookup: apis for a tag

create table endpoints (
  id                 integer primary key,
  api_id             integer not null references apis(id) on delete cascade,
  method             text not null default 'GET',
  url_template       text not null,
  sample_params_json text,
  description        text,
  expects_json       integer not null default 1 check (expects_json in (0,1)),
  active             integer not null default 1 check (active in (0,1)),
  -- not-null epoch sentinel (= never checked) so the shard query needs no
  -- `or last_checked_at is null` branch, which would defeat the index below.
  last_checked_at    text not null default '1970-01-01T00:00:00Z'
);

create index idx_endpoints_api on endpoints(api_id);

-- cron #1 shard query (§9 + Δ3 per-endpoint 90-minute cooldown floor):
--   select id, api_id, method, url_template, sample_params_json
--   from endpoints
--   where active = 1 and last_checked_at < :now_minus_90min
--   order by last_checked_at asc
--   limit 45;
-- the partial index serves the filter AND the oldest-first ordering in one pass.
create index idx_endpoints_due on endpoints(last_checked_at) where active = 1;

-- --- health data (the moat) -------------------------------------------------

create table checks (
  id           integer primary key,
  endpoint_id  integer not null references endpoints(id) on delete cascade,
  ts           text not null,
  status_code  integer,                       -- null on network-level failures
  ok           integer not null check (ok in (0,1)),
  latency_ms   integer,
  failure_kind text                           -- null when ok
               check (failure_kind in ('timeout','dns','http4xx','http5xx','bot_challenge','schema_drift'))
);

create index idx_checks_endpoint_ts on checks(endpoint_id, ts);
create index idx_checks_ts on checks(ts);     -- 30-day retention purge path (delete where ts < cutoff)

create table checks_daily (
  endpoint_id integer not null references endpoints(id) on delete cascade,
  day         text not null,                  -- YYYY-MM-DD
  uptime_pct  real not null,
  avg_ms      integer,
  p95_ms      integer,
  checks_n    integer not null,
  primary key (endpoint_id, day)              -- also the per-endpoint history index
);

create index idx_checks_daily_day on checks_daily(day);  -- /data global dashboards

create table response_shapes (
  id                   integer primary key,
  endpoint_id          integer not null references endpoints(id) on delete cascade,
  captured_at          text not null,
  schema_json          text,                  -- inferred JSON schema (Δ4 #9)
  sample_json_redacted text,
  hash                 text not null
);

create index idx_response_shapes_endpoint on response_shapes(endpoint_id, captured_at);

create table shape_changes (
  id           integer primary key,
  endpoint_id  integer not null references endpoints(id) on delete cascade,
  ts           text not null,
  old_hash     text,
  new_hash     text,
  diff_summary text not null                  -- "field `price` → `prices[]`" — the changelog nobody else has
);

create index idx_shape_changes_endpoint on shape_changes(endpoint_id, ts);

-- --- content & ops ----------------------------------------------------------

create table submissions (
  id              integer primary key,
  name            text not null,
  docs_url        text,
  endpoint_url    text,
  auth_type       text check (auth_type in ('none','apiKey','oauth','userAgent')),
  submitter_email text,
  status          text not null default 'pending'
                  check (status in ('pending','auto_validated','approved','rejected','spam')),
  validation_json text,
  created_at      text not null
);

create index idx_submissions_queue on submissions(status, created_at);  -- admin review queue

create table disputes (
  id         integer primary key,
  api_id     integer not null references apis(id) on delete cascade,
  contact    text not null,
  message    text not null,
  status     text not null default 'open'
             check (status in ('open','resolved','dismissed')),
  created_at text not null
);

create index idx_disputes_api on disputes(api_id);

create table sponsors (
  id          integer primary key,
  name        text not null,
  url         text not null,
  logo_r2_key text,
  placement   text,
  starts_at   text,
  ends_at     text,
  active      integer not null default 0 check (active in (0,1))
);
-- no index: sponsors stays a handful of rows; a scan is cheaper than index upkeep.

create table collections (
  id             integer primary key,
  slug           text not null unique,
  title          text not null,
  description_md text not null default '',
  curated        integer not null default 1 check (curated in (0,1))
);

create table collection_items (
  collection_id integer not null references collections(id) on delete cascade,
  api_id        integer not null references apis(id) on delete cascade,
  position      integer not null,
  primary key (collection_id, api_id)
);

create index idx_collection_items_api on collection_items(api_id);  -- "collections featuring this API"
