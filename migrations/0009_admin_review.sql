-- Admin review queue: the columns the console writes when a submission is triaged, plus an audit
-- trail. Approving a submission mints a real row in `apis` (+ `endpoints`), so every approval is a
-- catalog mutation — it gets logged with who/what/when rather than silently changing the dataset.

alter table submissions add column reviewed_at   text;  -- ISO ts of the approve/reject decision
alter table submissions add column review_notes  text;  -- free-text reviewer note (internal only)
alter table submissions add column approved_slug text;  -- slug of the api row this became, if approved

-- Rows the admin console created, so a catalog entry's origin is always answerable.
-- `source` distinguishes seed-imported rows from console-approved ones.
alter table apis add column origin text not null default 'seed'
  check (origin in ('seed', 'submission'));

create table admin_audit (
  id         integer primary key,
  action     text not null,              -- 'approve' | 'reject' | 'spam' | 'login' | 'login_failed'
  subject    text,                       -- submission id / slug / email — whatever the action targeted
  detail     text,                       -- short human-readable summary
  ip         text,
  created_at text not null
);

create index idx_admin_audit_time on admin_audit(created_at);
create index idx_apis_origin on apis(origin);
