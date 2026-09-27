# Task 04: the `fineprint` CLI (prove, validate, guard)

Proofs are Vitest files at `<target>/fineprint/proofs/<promiseId>.proof.test.ts`, written with
`startRun()` from `@fineprint/harness`. A proof signals a broken promise by throwing
`FinePrintBreach` (it carries `evidence`), and a failed positive control by throwing
`FinePrintControlFailure`. The CLI runs the proofs and turns the results into a ledger.
Build `packages/cli` (package name `fineprint`), depending on `@fineprint/core` and `@fineprint/harness` (both `workspace:*`) and `vitest`.

## Commands (`packages/cli/src/main.ts`, run with `node`)

- `fineprint validate <target>`: parse `<target>/fineprint/promises.json` and `stores.json` with core's `parseOrExplain`. Print `ok` or the exact error. Exit 0 or 1.
- `fineprint prove <target> [--json] [--promise <id>]`:
  1. Read `promises.json`. First write `<target>/fineprint/ledger.json` with every promise as `pending`, so a viewer can go live.
  2. Run the proofs through Vitest's Node API (`startVitest` from `vitest/node`, `watch: false`, `root: <target>`, include `fineprint/proofs/**/*.proof.test.ts`), with a reporter that collects each test file's state and its first error's `name`, `message` and `evidence`. If Vitest drops the custom `evidence` property, fall back to this: when the env var `FINEPRINT_EVIDENCE_DIR` is set, the harness writes each breach's evidence as JSON into that folder (add the few lines to `packages/harness/src/run.ts`), keyed by the proof file name.
  3. For each promise, take the proof file whose name starts with its id. Get the verdict from `aggregateVerdict` (a `human_review` promise is `needs_review` with no proof; a testable promise with no proof file is `missing`). The reason is the error message or `proof passed`. Evidence comes from the breach.
  4. Write the final `ledger.json` (`policy`, `run` with id, startedAt, durationMs, `git rev-parse --short HEAD` if available, harnessVersion and counts, then `entries`) and a copy at `fineprint/runs/<runId>.json`. Validate the ledger with core's schema before writing.
  5. Print a compact table (verdict, section, quote truncated to 60 characters), or the ledger JSON only on stdout if `--json` is given.
  6. Exit 0 if nothing is broken or unchecked, 1 if any promise is broken, 2 if any is `couldnt_check` and none is broken.
- `fineprint guard [--target <dir>]... [--install]`:
  - Default target: `examples/tidewell`.
  - Run prove for each target. For every broken entry, print `formatBreach(entry)` to **stderr**, then exit 1; otherwise print `✔ Fine Print: all promises kept` and exit 0.
  - `--install` writes `.githooks/pre-commit` (sh: `pnpm --silent fineprint guard || exit 1`), makes it executable and runs `git config core.hooksPath .githooks`.
- Add a root script in `package.json`: `"fineprint": "node packages/cli/src/main.ts"`, so it runs as `pnpm --silent fineprint prove examples/tidewell --json`.

## Tests (`packages/cli/test/`): a tiny fixture target

- **`fixtures/tiny/src/app.ts`:** `sendSms(phone)` fetches `https://api.twilio.com/...` with the phone, and `trackSignup(phone)` fetches `https://graph.facebook.com/tr?ph=<sha256(phone)>`.
- **`fixtures/tiny/fineprint/promises.json`:** three promises (valid per core's schema, with a policy `sha256` of 64 hex characters):
  - `p-1-kept-sms`: phone only to Twilio, calling only `sendSms`
  - `p-2-broken-ads`: phone only to Twilio, calling both
  - `p-3-review`: category `human_review`
- **`fixtures/tiny/fineprint/proofs/`:** the two proofs, written with `startRun({ targetRoot })`, `run.markFlow(...)`, `run.expect.flowExercised(...)` and `run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] })`.
- **`e2e.test.ts`:** `prove` on the fixture gives kept, broken and needs_review; the broken entry has egress evidence with host `graph.facebook.com` and a callSite in `src/app.ts`; `ledger.json` is written and valid; the exit code is 1.
- **`guard.test.ts`:** guard's stderr contains `§2` and the promise quote, and it exits 1. With a fixture copy where `trackSignup` isn't called, it exits 0.

## Rules

- Work in `packages/cli/` and the root `package.json` script. The only harness edit allowed is the optional evidence fallback.
- Files under 300 lines. Don't commit, and don't run `guard --install` against this repo.

## Acceptance: run all and show the output

```
pnpm install
pnpm --filter fineprint run typecheck
pnpm --filter fineprint exec vitest run
pnpm --filter @fineprint/harness exec vitest run
```
