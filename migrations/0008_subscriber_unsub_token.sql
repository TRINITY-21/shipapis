-- Per-subscriber unsubscribe token so the one-click unsubscribe link can't be forged for someone
-- else's address. Backfilled for existing rows; new rows set it on insert (crypto.randomUUID()).
alter table subscribers add column unsub_token text;
update subscribers set unsub_token = lower(hex(randomblob(16))) where unsub_token is null;
