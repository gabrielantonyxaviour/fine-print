---
name: fp-guard
description: Explains the Fine Print commit guard that blocks commits breaking a privacy promise.
---

# fp-guard skill

The Fine Print guard runs automatically before every `git commit` via the Bob PreToolUse hook.

## What the guard does

`pnpm --silent fineprint guard` checks whether the current working-tree changes would break any
proven privacy promise. If any promise is broken, the commit is blocked with:

```
Blocked by Fine Print: this commit breaks a privacy promise.
```

## How to use it manually

Run before every commit:

```
pnpm --silent fineprint guard
```

If it exits 0, all promises still hold and the commit is safe to make.

If it exits non-zero, a privacy promise is broken. Fix the code (do not edit the proofs) and
rerun until it exits 0.

## Workflow

1. Make code changes.
2. Run `pnpm --silent fineprint guard`.
3. If broken, run `pnpm --silent fineprint prove <target>` to see the full table.
4. Apply fixes (use the fp-fix skill or fp-engineer mode).
5. Rerun guard until it exits 0.
6. Commit.

The guard is also enforced automatically: the Bob `commit-guard.mjs` hook intercepts any
`git commit` command and runs the guard before the commit proceeds.
