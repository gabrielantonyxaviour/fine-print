---
name: fp-audit
description: Audits a target app's privacy policy against its code and produces executable proofs.
---

# fp-audit skill

Used by the fp-auditor mode. Follow every step in order.

## Step 1: Extract promises

Read the privacy policy. The user @-mentions a PDF; if not present, read `<target>/PRIVACY.md`.

Write `<target>/fineprint/promises.json` matching `packages/core/schema/promises.schema.json`.

Rules for promises:
- A promise is a sentence that commits to behaviour: never, only, within N days, do not, only if.
- Descriptive sentences are not promises.
- Vague or legal statements get `"category": "human_review"` and `"testability": "human_review"`.
- Keep the exact quote and its section number (e.g. "3.2").
- Id format: `p-<section-with-dashes>-<short-slug>`, e.g. `p-3-2-phone-2fa-only`.
- Never put the words password, secret, token or credential in an id; use `login-data` instead.
- Set `policy.sha256` to the SHA-256 of the policy file (`shasum -a 256`).

## Step 2: Map data stores

Write `<target>/fineprint/stores.json` with paths relative to the app's data dir. Include each
sqlite db, JSON file, and log glob the app writes.

## Step 3: Write journeys

Write `<target>/fineprint/journeys.ts`: functions that drive the real app in-process for a `run`
from `startRun`. The journeys must:
- Create the app on `run.dataDir` with test routes enabled.
- Sign up the canary (`run.canary`), sign in, book, search, pay, run nightly jobs, delete the
  account, and advance the clock past a retention window via the app's own job runner.
- Pass every `set-cookie` header to `run.recordCookies` and call `run.markFlow(name)` after each
  flow succeeds.
- Use `supertest` agents and look for test-only routes in the app.

## Step 4: Fan out to tracers

Spawn one `fp-tracer` subagent per testable promise, all in a single turn (issue every
`spawn_subagent` call at once). Each task description must be self-contained and include:
- The promise JSON object.
- The target path.
- The candidate files (grep once yourself and pass the hits).
- The journeys functions available.
- The proof template to use.
- The required output JSON format.

Do not trace promises yourself.

## Step 5: Prove

Run `pnpm --silent fineprint prove <target>` from the repo root and report the full table.
Never change a verdict by hand.
