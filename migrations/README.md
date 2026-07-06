# migrations

D1 schema (`0001_init.sql`) + seed catalog (`0002_seed.sql`, generated — never hand-edit).
Wrangler applies files in filename order and records what ran in its own `d1_migrations` table.

## One-time setup

```sh
npx wrangler d1 create shipapis
```

Copy the `database_id` from the output into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",                  // env.DB in the Worker
    "database_name": "shipapis",
    "database_id": "<uuid from create output>",
    "migrations_dir": "migrations"    // the default, pinned for clarity
  }
]
```

## Applying

```sh
npx wrangler d1 migrations apply shipapis --local    # .wrangler/state sqlite — used by wrangler dev
npx wrangler d1 migrations apply shipapis --remote   # production
```

`wrangler d1 migrations list shipapis --local` shows what's pending.

## Adding APIs without losing probe history

**Do not** `db:reset` when you only added new catalog entries. That wipes `checks`,
`checks_daily`, `response_shapes`, and every `monitored_since` timestamp.

Instead:

```sh
# after probe + batch import
npm run seed:add
# or step by step:
npm run seed:assemble
npm run seed:expand-endpoints
npm run seed:assemble
npm run seed:delta          # writes migrations/0005_catalog_*.sql (idempotent INSERTs)
npm run db:apply            # applies only pending migrations
```

`seed:delta` compares `src/seed.ts` to what's already in D1 and emits a new migration
with **only missing APIs, endpoints, and category count fixes**. Existing health history
is untouched.

Production: `node scripts/export-catalog-delta.ts --remote` then `npm run db:apply:remote`.

## Fresh local database (bootstrap)

When you need a clean slate (first clone, or after squashing migrations):

```sh
npm run seed:sql            # regen 0002 from current seed (optional but keeps bootstrap current)
npm run db:reset            # rm local D1 + apply 0001…000N from scratch
```

Delta migrations (`0005_catalog_*.sql`) are idempotent — safe on a fresh reset even if
0002 already contains the same APIs.

## Regenerating the full seed (0002)

```sh
node scripts/export-seed.ts     # Node ≥ 22.18 (native type stripping); or: npx tsx scripts/export-seed.ts
```

Output is deterministic — a clean regen with an unchanged seed is byte-identical, so
`git diff` shows only real catalog changes.

**Caveat:** once `0002_seed.sql` has been applied somewhere, wrangler will NOT re-run it
there after a regen. Use `seed:delta` for live databases; use `db:reset` locally when you
want to rebootstrap from an updated 0002.

## Validating without wrangler

```sh
{ echo "pragma foreign_keys=on;"; cat migrations/0001_init.sql migrations/0002_seed.sql; echo "pragma foreign_key_check;"; } | sqlite3 ":memory:"
```

Silence = valid. (Done for the committed 0002 — FK check clean, all hot query paths
confirmed index-backed via `explain query plan`.)
