# Task 01 — `@fineprint/core`: schemas, verdict rules, breach message

Fine Print fact-checks a privacy policy against code. Bob extracts **promises** from the policy,
writes **proofs** (Vitest tests), and a CLI turns proof results into a **ledger** of verdicts.
This package is the shared vocabulary for all of that. Build only `packages/core`.

Workspace is ready: pnpm, TypeScript 7, Vitest 5, Zod 4 installed; `packages/core/package.json`
exports `./src/index.ts`. Imports between files use the `.ts` extension.

## Files to create

```
packages/core/src/schema.ts         zod schemas + inferred types
packages/core/src/errors.ts         FinePrintBreach, FinePrintControlFailure
packages/core/src/verdict.ts        aggregateVerdict()
packages/core/src/breach.ts         formatBreach()
packages/core/src/export-schema.ts  writes JSON Schema files
packages/core/src/index.ts          re-exports everything
packages/core/test/schema.test.ts
packages/core/test/verdict.test.ts
packages/core/test/breach.test.ts
```

## schema.ts (Zod 4; export each schema and its `z.infer` type)

- `Category`: `sharing | purpose_limitation | retention_deletion | collection_minimization | security_storage | consent_gate | cookies_tracking | residency | human_review`
- `Testability`: `testable | partial | human_review`
- `Claim`: `{ kind: 'egress_only_to' | 'egress_never_to' | 'no_residue_after' | 'never_stored' | 'consent_required' | 'cookies_only' | 'region_only' | 'none', data: string[], allowedDestinations?: string[], forbiddenDestinations?: string[], withinDays?: int>=0, condition?: string }`
- `PromiseItem`: `{ id: /^p-\d+(-\d+)*-[a-z0-9-]+$/, section: non-empty string, quote: string (min 10), category, dataClasses: string[], claim: Claim, testability, rationale: non-empty string }`
- `PolicyRef`: `{ title, effectiveDate?: string, sourcePath, pdfPath?: string, sha256: 64-hex }`
- `PromiseFile`: `{ policy: PolicyRef, promises: PromiseItem[] }` — refine: promise ids unique.
- `DataStore`: `{ id, kind: 'sqlite'|'sqlite-table'|'json-file'|'file-glob'|'dir'|'postgres'|'http-dump', location: string, table?: string, notes?: string }`; `StoresFile`: `{ stores: DataStore[] }` (unique ids).
- `Trace`: `{ promiseId, dataFlow: {step: string, file: string, line?: int, symbol?: string}[], sinks: string[], journeys: string[], confidence: 'high'|'medium'|'low', openQuestions: string[] }`
- `Matched`: `{ field: string, form: string }` (form examples: `raw`, `sha256`, `base64`, `urlencoded`)
- `Evidence` (discriminated union on `kind`):
  - `egress`: `{ method, host, path, matched: Matched, callSite?: string }`
  - `residue`: `{ storeId, location, matched: Matched }`
  - `cookie`: `{ name, attributes: string }`
  - `note`: `{ text }`
- `Verdict`: `kept | broken | needs_review | couldnt_check | pending`
- `LedgerEntry`: `{ promiseId, section, quote, category, verdict, reason, evidence: Evidence[], proofPath?, tracePath?, durationMs?: number }`
- `RunMeta`: `{ id, startedAt: ISO string, durationMs, commit?: string, harnessVersion, promiseCount, counts: Record<Verdict, number> }`
- `Ledger`: `{ policy: PolicyRef, run: RunMeta, entries: LedgerEntry[] }`
- `GroundTruth`: `{ statements: { promiseId, section, quote, expectedCategory: Category, expectedVerdictBefore: Verdict, expectedVerdictAfterFix: Verdict, mutationPatch?: string }[] }`
- `EvalResults`: `{ target: { repo, commit }, baseline: { ledgerPath, falseAlarms: int }, mutants: { id, description, patchPath, targetsPromise, caught: boolean, caughtBy?: string, logPath }[] }`

Also export `parseOrExplain(schema, data, label)` that returns the parsed value or throws an
Error whose message names the exact failing path, e.g. `promises.json: promises[2].quote: Too small`.

## errors.ts

- `class FinePrintBreach extends Error` with `name = 'FinePrintBreach'` and `evidence: Evidence[]` — thrown by proofs when a promise is broken.
- `class FinePrintControlFailure extends Error` with `name = 'FinePrintControlFailure'` — thrown when a proof's positive control fails (the journey it needed never ran).

## verdict.ts — `aggregateVerdict(o)`

Input: `{ state: 'passed'|'failed'|'errored'|'skipped'|'missing', errorName?: string, category: Category }`.
Rules, in order:
1. `category === 'human_review'` → `needs_review`
2. `missing` → `couldnt_check`; `skipped` → `pending`
3. `errored` → `couldnt_check`
4. `failed` with `errorName === 'FinePrintBreach'` → `broken`
5. `failed` with any other error (including `FinePrintControlFailure`) → `couldnt_check`
6. `passed` → `kept`

Also `countVerdicts(entries)` returning `Record<Verdict, number>` with all five keys present.

## breach.ts — `formatBreach(entry: LedgerEntry): string`

Exact format (the guard prints this and the demo reads it on screen):

```
✖ Breaks §4.2 "We never share your email address with advertisers."
  sha256(email) → POST graph.facebook.com/tr (src/analytics/pixel.ts:12)
  proof: fineprint/proofs/p-4-2-email-no-ads.proof.test.ts
```

- Evidence lines: egress `form(field) → METHOD host+path (callSite)`; residue `form(field) left in storeId at location`; cookie `cookie name set: attributes`; note `text`. For `form === 'raw'` print just the field name. Omit `(callSite)` when absent.
- Omit the `proof:` line when `proofPath` is absent.

## export-schema.ts

Script `export-schema` (add to package.json scripts: `"export-schema": "node src/export-schema.ts"`)
that writes `packages/core/schema/promises.schema.json`, `stores.schema.json`, `trace.schema.json`,
`ledger.schema.json` using Zod 4's `z.toJSONSchema`.

## Tests (must pass)

- `schema.test.ts`: a valid PromiseFile parses; each is rejected with its path in the message:
  missing quote, unknown category, empty section, duplicate promise ids, bad id pattern.
- `verdict.test.ts`: table-driven, every rule above, plus `countVerdicts` includes zero keys.
- `breach.test.ts`: exact expected strings for an egress entry with callSite, a residue entry,
  a raw-form entry, and an entry without proofPath.

## Rules

- Only touch `packages/core/`. Don't edit tsconfig files, AGENTS.md, CLAUDE.md, spec.json.
- Every file under 300 lines. No `console.log` in `src/` (the export script may write files and print one summary line).
- Don't commit.

## Acceptance — run all and show the output

```
pnpm --filter @fineprint/core run typecheck
pnpm --filter @fineprint/core exec vitest run schema
pnpm --filter @fineprint/core exec vitest run verdict
pnpm --filter @fineprint/core exec vitest run breach
pnpm --filter @fineprint/core run export-schema
```
