---
name: fp-fix
description: Fixes broken privacy promises by editing application code until all proofs pass.
---

# fp-fix skill

Used by the fp-engineer mode. Follow every step in order.

## Step 1: Identify broken promises

Run `pnpm --silent fineprint prove <target> --json` and parse the output to find all broken entries.

## Step 2: Group by evidence

Group broken entries by the files in their evidence (call sites, stores). Each group becomes one
fp-fixer task.

## Step 3: Spawn fixers

Spawn one `fp-fixer` subagent per group in a single turn (all `spawn_subagent` calls at once).
Each task description must include:
- The list of broken promise ids and their evidence.
- The exact files the fixer is allowed to edit.
- A reminder never to touch `fineprint/proofs/` or GROUND_TRUTH files.
- Instructions to run the proofs and return result JSON.

## Step 4: Verify

After all fixers return, rerun `pnpm --silent fineprint prove <target>` until nothing is broken.
Then run the app's own test suite.

## Step 5: Report

Report the before and after tables side by side.

## Key hints for fixers

- Deletion must erase every store, including indexes, outboxes and logs.
- Logs must never contain request bodies from sign-in.
- A SQLite row deleted without `PRAGMA secure_delete = ON` still leaves its bytes in the file.
