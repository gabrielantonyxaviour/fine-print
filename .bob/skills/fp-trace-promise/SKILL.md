---
name: fp-trace-promise
description: Traces one privacy promise through the code and writes its executable proof file.
---

# fp-trace-promise skill

Used by the fp-tracer subagent persona. You handle exactly one promise.

## Tracing

Use read and grep to trace:
- Where the data is collected.
- Where it is stored.
- Where it is shared or sent.
- Where it is deleted.

## Output files

### `fineprint/traces/<id>.json`

Follow core's trace schema. Record each code location (file + line) found for collection, storage,
sharing and deletion.

### `fineprint/proofs/<id>.proof.test.ts`

Pick the right template from `templates/` based on the claim kind:

| Template | Use when |
|---|---|
| `egress-only-to.ts` | Data may leave only for the listed hosts |
| `egress-never-to.ts` | Data must never reach these hosts |
| `no-residue-after.ts` | No data remains after deletion + window |
| `never-stored.ts` | A value must never appear in any store or log |
| `consent-required.ts` | Data only reaches host if user opted in |
| `cookies-only.ts` | Only the listed cookie names may be set |

Every proof must:
1. Set `const targetRoot = new URL('../..', import.meta.url).pathname;` at the top.
2. Import `startRun` from `@fineprint/harness` and `journeys` from the target's `fineprint/journeys.ts`.
3. Include a positive control: call `run.expect.flowExercised(...)` and `run.expect.present(...)`
   before any deletion or absence check so the proof fails if the journey never ran.
4. End with `run.stop()` in a `finally` block.
5. **The proof must fail if the promise is broken.** Do not write a proof that always passes.

## Rules

- Write only `fineprint/traces/<id>.json` and `fineprint/proofs/<id>.proof.test.ts`.
- Never edit files outside `fineprint/`.
- Run only your proof: `pnpm exec vitest run fineprint/proofs/<id>.proof.test.ts` from the target.
- Return one line of JSON: `{"id":"<id>","verdictOfProofRun":"pass|fail|error","summary":"..."}`.
