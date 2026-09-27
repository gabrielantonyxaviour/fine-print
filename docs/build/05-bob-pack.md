# Task 05: the Fine Print mode pack for Bob

This is what makes Fine Print run **inside Bob**: two custom modes, two subagent personas, four
skills, and two hooks. Write plain ASCII only: no emoji, curly quotes or em dashes (Bob's loader strips them).
Everything goes under `.bob/`, plus `scripts/check-bob-pack.mjs`.

## 1. `.bob/custom_modes.yaml`

```yaml
customModes:
  - slug: fp-auditor
    name: Fine Print Auditor
    description: Fact-checks a privacy policy against this codebase with executable proofs.
    roleDefinition: >-
      You are Fine Print's auditor. You turn a privacy policy into testable promises, map where
      personal data lives, and write executable proofs. You never edit application code.
    whenToUse: Use to audit a target app's privacy policy (a PDF or Markdown) against its code.
    customInstructions: >-
      Follow the fp-audit skill exactly. Verdicts come only from running `pnpm --silent fineprint prove`.
    groups:
      - read
      - execute
      - skill
      - todo
      - subagent
      - - edit
        - fileRegex: "(^|/)fineprint/"
          description: Only the target's fineprint/ folder
    allowedSubagents:
      - fp-tracer
  - slug: fp-engineer
    name: Fine Print Engineer
    description: Fixes code so broken privacy promises are kept, without touching the proofs.
    roleDefinition: >-
      You are Fine Print's engineer. You change application code until every broken promise's
      proof passes. You may never edit a proof.
    whenToUse: Use after an audit, to fix broken promises.
    customInstructions: Follow the fp-fix skill exactly.
    groups:
      - read
      - execute
      - skill
      - todo
      - subagent
      - - edit
        - fileRegex: "^(?!.*fineprint/proofs/)(?!.*GROUND_TRUTH).*$"
          description: Anything except the proofs
    allowedSubagents:
      - fp-fixer
```

## 2. Subagent personas (block lists only, not `[a, b]`)

**`.bob/agents/fp-tracer.md`**
```
---
name: fp-tracer
description: Traces one privacy promise through the code and writes its executable proof.
groups:
  - read
  - edit
  - execute
maxTurns: 25
---
```
The body gives the job: follow the fp-trace-promise skill for the single promise in your task,
write `fineprint/traces/<id>.json` and `fineprint/proofs/<id>.proof.test.ts`, run only your proof
(`pnpm exec vitest run fineprint/proofs/<id>.proof.test.ts` from the target folder), and return one
line of JSON: `{"id","verdictOfProofRun":"pass|fail|error","summary"}`. Never edit files outside `fineprint/`.

**`.bob/agents/fp-fixer.md`**: the same shape. It fixes one group of broken promises, edits only the files named in its task, never touches `fineprint/proofs/`, runs its proofs and returns one line of JSON.

## 3. Skills: `.bob/skills/<name>/SKILL.md` with frontmatter `name` (equal to the folder name) and `description`

### `fp-audit` (used by fp-auditor). Steps, in order:
1. **Extract.** Read the policy (the user @-mentions a PDF; if not, use `<target>/PRIVACY.md`). Write `<target>/fineprint/promises.json` matching `packages/core/schema/promises.schema.json`.
   - A promise is a sentence that commits to behaviour: *never, only, within N days, do not, only if*. Descriptive sentences are not promises. Vague or legal statements become `category: human_review`, `testability: human_review`.
   - Keep the exact quote and its section number (e.g. `3.2`).
   - Ids look like `p-<section with dashes>-<short-slug>`, e.g. `p-3-2-phone-2fa-only`. Never put the words password, secret, token or credential in an id; say `login-data` instead.
   - Set `policy.sha256` to the SHA-256 of the policy file (`shasum -a 256`).
2. **Map.** Write `<target>/fineprint/stores.json`, with paths relative to the app's data dir. Include each sqlite db, JSON file and log glob the app writes.
3. **Journeys.** Write `<target>/fineprint/journeys.ts`: functions that drive the real app in-process for a `run` from `startRun`:
   - create the app on `run.dataDir` with test routes on
   - sign up the canary (`run.canary`), sign in, book, search, pay, run nightly jobs, delete the account, and advance the clock past a retention window via the app's own job runner
   - pass every `set-cookie` header to `run.recordCookies` and call `run.markFlow(name)` after each flow succeeds
   - use `supertest` agents, and look for test-only routes in the app
4. **Fan out.** Spawn **one `fp-tracer` subagent per testable promise, all in a single turn** (issue every `spawn_subagent` call at once). Each task description is self-contained: the promise JSON, the target path, the candidate files (grep once yourself and pass the hits), the journeys functions available, the proof template to use, and the output JSON format. Do not trace promises yourself.
5. **Prove.** Run `pnpm --silent fineprint prove <target>` from the repo root and report the table. Never change a verdict by hand.

### `fp-trace-promise` (used by fp-tracer)
- Trace collection, storage, sharing and deletion of the promise's data with read and grep.
- Write `traces/<id>.json` (core's trace schema) and the proof from a template in `templates/`.
- **A proof must fail if the promise is broken.** Always add a positive control: `run.expect.flowExercised(...)`, and `run.expect.present(...)` before any deletion check.

`templates/` holds one `.ts` file per claim kind, each a complete Vitest proof using `startRun({ targetRoot })`, `journeys` and `run.expect.*`:
- `egress-only-to.ts`: data may leave only for the listed hosts
- `egress-never-to.ts`: data must never reach these hosts
- `no-residue-after.ts`: sign up, `present`, delete, advance past the window, run jobs, `noResidue`
- `never-stored.ts`: a value (e.g. the login text) must never appear in any store or log, in any form
- `consent-required.ts`: a second canary that did not opt in must never reach the host, and the opted-in one must (control)
- `cookies-only.ts`: only the listed cookie names may be set

Every proof sets `const targetRoot = new URL('../..', import.meta.url).pathname;` (proofs live in `<target>/fineprint/proofs/`) and ends with `run.stop()` in a `finally`.

### `fp-fix` (used by fp-engineer)
1. Run `pnpm --silent fineprint prove <target> --json`.
2. Group broken entries by the files in their evidence (call sites, stores).
3. Spawn **one `fp-fixer` per group in a single turn**.
4. After all return, rerun prove until nothing is broken, then run the app's own tests.
5. Report the before and after tables.

Hints to include: deletion must erase every store, including indexes, outboxes and logs; logs must never contain request bodies from sign-in; a SQLite row deleted without `PRAGMA secure_delete = ON` still leaves its bytes in the file.

### `fp-guard`
Explains the guard: `pnpm --silent fineprint guard` blocks a commit that breaks a promise. Use it before every commit.

## 4. Hooks: `.bob/settings.json`

```json
{ "hooks": { "PreToolUse": [
  { "matcher": "^execute_command$", "hooks": [ { "type": "command", "command": "node .bob/hooks/commit-guard.mjs", "timeout": 300 } ] },
  { "matcher": "^(write_file|apply_diff|insert_content|search_and_replace)$", "hooks": [ { "type": "command", "command": "node .bob/hooks/proof-lock.mjs", "timeout": 10 } ] }
] } }
```

- **`.bob/hooks/commit-guard.mjs`:**
  - Read stdin JSON (accept both `{tool_input:{command}}` and `{input:{command}}`).
  - If the command matches `/\bgit\s+commit\b/`, run `pnpm --silent fineprint guard`.
  - On failure, write its stderr plus `Blocked by Fine Print: this commit breaks a privacy promise.` to stderr and exit 2. Otherwise exit 0.
  - Never call `bob` here.
- **`.bob/hooks/proof-lock.mjs`:**
  - Read the target `path` (from `tool_input` or `input`).
  - If it contains `fineprint/proofs/` **and** the git tag `fineprint-audit-baseline` exists (`git rev-parse -q --verify refs/tags/fineprint-audit-baseline`), exit 2 with `Blocked by Fine Print: proofs are frozen after the audit. Fix the code, not the test.`
  - Otherwise exit 0.

## 5. `scripts/check-bob-pack.mjs`

A small YAML read (a tiny parser or regex is fine; no new dependencies) that checks:
- both modes exist
- the auditor's fileRegex matches `examples/tidewell/fineprint/promises.json` but not `examples/tidewell/src/app.ts`
- the engineer's fileRegex matches `examples/tidewell/src/app.ts` but not `examples/tidewell/fineprint/proofs/p-1.proof.test.ts`
- all four skills have `name` and `description`, both personas exist, and `settings.json` parses

Test both hooks by piping sample JSON: a `git commit` payload runs the guard; a proof-path payload with no tag exits 0.

## Rules

- Only `.bob/` and `scripts/check-bob-pack.mjs`.
- ASCII only. Don't commit.

## Acceptance: run and show the output

```
node scripts/check-bob-pack.mjs
echo '{"tool_input":{"path":"examples/tidewell/fineprint/proofs/x.proof.test.ts"}}' | node .bob/hooks/proof-lock.mjs; echo "exit $?"
echo '{"tool_input":{"command":"ls"}}' | node .bob/hooks/commit-guard.mjs; echo "exit $?"
```
