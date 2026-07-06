-- 0003 — agent-access flag. Can a non-browser client (our shipapisbot UA) reach the API,
-- or does a WAF/bot-wall block server-side/agent calls? A first-class signal no other
-- directory carries. Maintained by the checker: 'ok' on a clean probe, 'blocked' on a
-- bot_challenge classification. Ships 'unknown' (like health) until the first real probe.
alter table apis add column agent_access text not null default 'unknown'
  check (agent_access in ('ok', 'blocked', 'unknown'));

create index idx_apis_agent_access on apis(agent_access);
