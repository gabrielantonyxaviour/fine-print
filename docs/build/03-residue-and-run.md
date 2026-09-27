# Task 03: residue scanner and the proof API (`@fineprint/harness`)

Proofs are Vitest tests that Bob will later write for each privacy promise. This task gives them:
a **residue scanner** (finds canary values left on disk) and **`startRun()`**, the one API a proof uses.
Build only inside `packages/harness`. Reuse what exists: `createCanary`, `canaryFields`,
`findCanaries` (it accepts `Uint8Array`), `startEgressRecorder` and `matchRequest`. Reuse
`FinePrintBreach` and `FinePrintControlFailure` and the `Evidence`, `StoresFile` and `DataStore` types from `@fineprint/core`.
Keep it lean: small files and focused tests.

## Files

```
src/residue/scan.ts   scanStores(stores, dataDir, fields) and scanDir(dataDir, fields)
src/run.ts            startRun(opts)
test/residue.test.ts
test/run.test.ts
```

Export both from `src/index.ts`.

## Residue scanner

`scanStores(stores: DataStore[], dataDir, fields)` returns `{ storeId, location, matched }[]`.
Store `location` paths are relative to `dataDir`.
- `sqlite`: open read-only with `node:sqlite` (`DatabaseSync`), scan every row of every table and every column. The location is `table.column (rowid N)`. Then scan the **raw bytes** of the file and of any `-wal` or `-journal` file. Report a canary found in the raw bytes but in no row with location `raw bytes (deleted but not erased)`.
- `json-file`: parse the file, walk it, and scan string values. The location is a JSON path such as `$.docs[2].email`.
- `file-glob`: a simple `*` glob within one folder. Scan line by line; the location is `relative/file.log:LINE`.
- `dir`: scan every file recursively as bytes; the location is the relative path.

`scanDir(dataDir, fields, declaredStores)` scans every file under `dataDir` that no declared store covers, as bytes. The `storeId` is `undeclared`, so data landing somewhere nobody declared is still caught.

## Proof API: `startRun(opts)`

`opts`: `{ targetRoot: string, storesFile?: string }`. `storesFile` defaults to `<targetRoot>/fineprint/stores.json`, parsed with core's schema; missing means no declared stores.

Returns a `run` with:
- `dataDir`: a fresh temp directory for this run's app data
- `canary`: `createCanary()`
- `extraCanary()`: another canary (e.g. an opted-out second user)
- `egress`: an egress recorder started with `targetRoot`
- `markFlow(name)`: journeys call this when a user flow completes
- `recordCookies(setCookieHeaders: string[])`: journeys pass on the `set-cookie` headers they receive
- `expect`:
  - `egress({ data, onlyTo?, never? })`: `data` is canary field names such as `['phone']`. For every recorded request whose matches include one of those fields: throw `FinePrintBreach` if the host isn't in `onlyTo` (when given) or is in `never` (when given). The evidence is `{kind:'egress', method, host, path, matched, callSite}` for every offending request.
  - `noResidue({ data })`: run `scanStores` plus `scanDir` for those fields and throw `FinePrintBreach` with residue evidence if anything is found.
  - `present({ data })`: the positive control. If `scanStores` plus `scanDir` finds **nothing** for those fields, throw `FinePrintControlFailure`. It proves the data was really stored before a deletion test.
  - `flowExercised(name)`: throw `FinePrintControlFailure` unless `markFlow(name)` was called.
  - `cookies({ allow })`: throw `FinePrintBreach` with `{kind:'cookie', name, attributes}` for each recorded cookie whose name isn't in `allow`.
- `stop()`: stop the egress recorder and delete `dataDir`.

Breach messages are short and human-readable, e.g. `phone sent to graph.facebook.com`.

## Tests (must pass)

- **`residue.test.ts`:**
  - A temp sqlite db with the canary email in a row is found with a table.column location.
  - After `DELETE` of that row (no secure_delete), it is found as `raw bytes (deleted but not erased)`.
  - With `PRAGMA secure_delete = ON` before the delete, nothing is found.
  - A JSON file is found with its JSON path.
  - A log file is found with `file:line`.
  - A file outside the declared stores is found with `undeclared`.
- **`run.test.ts`:**
  - `egress` with `onlyTo: ['api.twilio.com']` passes for a phone sent to Twilio and throws a breach naming `graph.facebook.com` for a SHA-256 phone sent there.
  - `present` throws a control failure on an empty dataDir.
  - `flowExercised` throws until `markFlow` is called.
  - `cookies({ allow: ['tw_session'] })` flags `tw_ad_id`.

## Rules

- Only touch `packages/harness/`.
- Files under 300 lines, with no `console.log` in `src/`.
- Don't commit.

## Acceptance: run all and show the output

```
pnpm --filter @fineprint/harness run typecheck
pnpm --filter @fineprint/harness exec vitest run residue
pnpm --filter @fineprint/harness exec vitest run run
pnpm --filter @fineprint/harness exec vitest run
```
