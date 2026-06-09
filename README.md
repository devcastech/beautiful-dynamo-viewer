# dynamo.viewer

Desktop tool (Tauri + React) for exploring DynamoDB single-table designs. You describe how a
table is modeled once — its entities, key patterns and indexes — and from then on you query it
by filling in pattern variables instead of hand-writing key conditions.

## Conceptual model

```
Schema                ← one DynamoDB table, modeled
├── keys              ← physical key attributes (e.g. PK / SK)
├── indexes           ← table-level GSI definitions (name → pkAttr/skAttr)
├── entities          ← record types living in the table
│   ├── pk / sk       ← key patterns, e.g. ORDER#<orderId> / ORDER
│   └── indexPatterns ← how the entity writes its keys into each GSI
└── queries           ← saved queries, each referencing an entity
```

- **Schema** — a model of one table. `name` is the display label; `tableName` is the real
  DynamoDB table queries run against (overridable in the top bar to point at another stage).
- **Entity** — a record type. Its `pk`/`sk` are *patterns* with `<variables>`; entities sharing
  a PK pattern are grouped in the sidebar as one partition.
- **Index pattern** — what the entity writes into a GSI. The GSI itself (its physical
  attributes) is defined once at schema level and created automatically the first time an
  entity references it; edit attribute names under *Edit schema*.
- **Saved query** — a bookmarked builder state (target index, variable values, SK condition).

## Workspace persistence

Everything is stored in `workspace.json` inside the app-data directory
(`~/Library/Application Support/<bundle-id>/` on macOS), written atomically on every change.
In browser dev mode (`pnpm dev` without Tauri) it falls back to localStorage and query
execution is disabled.

## Schema JSON (import/export)

Export produces the v2 format (one schema per file). Import accepts both v2 and the legacy v1
format (`{ name, table, story, entities: [...] }` with per-entity `gsis`/`savedQueries`) and
migrates it automatically. The `/dynamo-schema` Claude command generates v1 JSON from service
code, which imports cleanly.

## Development

```sh
pnpm install
pnpm tauri dev    # desktop app (requires Rust toolchain + AWS CLI for profiles)
pnpm dev          # browser-only UI dev (no query execution)
pnpm test         # domain tests (vitest)
pnpm build        # typecheck + bundle
```

Querying real tables requires the AWS CLI configured with profiles; SSO login is triggered
from the top bar.

## Code layout

```
src/
├── domain/schema/   pure logic: types, operations, migration, grouping, pattern parser (+ tests)
├── services/        Tauri bridges: dynamo, aws, storage, dialogs
├── hooks/           useSchemaStore, useWorkspace, useAwsConnection, useQueryExecutor
├── components/      UI (components/ui/ holds the shared primitives)
└── data/seed.ts     example schemas (kept in v1 format to exercise the migration)
src-tauri/           Rust backend: DynamoDB queries, AWS profiles, workspace persistence
```
