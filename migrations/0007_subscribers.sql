-- Newsletter subscribers ("the signal"). Capture-only: we store the list here now; sending goes out
-- later via Email Sending / a provider (Email Routing is inbound-only). Email is unique so a repeat
-- subscribe is idempotent (re-activates rather than duplicating).
create table subscribers (
  id          integer primary key,
  email       text not null unique,
  status      text not null default 'active'
              check (status in ('active', 'unsubscribed', 'bounced')),
  source      text,                       -- where they subscribed from (e.g. 'footer')
  created_at  text not null
);

create index idx_subscribers_status on subscribers(status, created_at);
