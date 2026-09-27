# Task 02: `@fineprint/harness` canaries and egress recorder

Proofs create a **canary user** (unique, realistic personal data), drive the target app, and
check what left the process. This task builds the canary factory, the matcher that finds canary
values in any encoding, and the **egress recorder**: it intercepts every outbound request, never
sends it, and records it with the line of code that made it. Build only `packages/harness`.

Already installed: `@mswjs/interceptors@0.45`, `zod`, `@fineprint/core` (workspace; use its
`Matched` type). Imports between files use the `.ts` extension.

## Files

```
packages/harness/src/canary/factory.ts   createCanary(runId?)
packages/harness/src/canary/variants.ts  canaryVariants(field, value)
packages/harness/src/canary/match.ts     findCanaries(haystack, fields)
packages/harness/src/egress/recorder.ts  startEgressRecorder(opts)
packages/harness/src/egress/callsite.ts  callSiteFrom(stack, targetRoot)
packages/harness/src/index.ts            re-exports
packages/harness/test/canary.test.ts
packages/harness/test/egress-detect.test.ts
packages/harness/test/egress-clean.test.ts
packages/harness/test/egress-callsite.test.ts
packages/harness/test/fixtures/target/src/leaky.ts
```

## Canary (`createCanary(runId?: string)`)

- `runId`: 6 random lowercase alphanumerics unless given.
- Returns `{ runId, name, email, phone, pw, ip, healthReason, card: { number, expMonth, expYear, cvc } }`:
  - `name`: realistic, picked deterministically from runId out of 8 names such as "Priya Raman" or "Tomasz Nowak".
  - `email`: `<first>.<last>.<runId>@example.com`, lowercase.
  - `phone`: E.164 `+447700900NNN` (the UK drama range), with NNN derived from runId.
  - `pw`: `Harbour-<runId>-Lantern!`
  - `ip`: `203.0.113.N` (a test range), with N between 1 and 254, derived from runId.
  - `healthReason`: `Knee pain after running (<runId>)`
  - `card`: `4242424242424242`, 12, 2034, `123`
- `canaryFields(c)` returns `{ field, value }[]` for name, email, phone, pw, ip, healthReason and card.number.

## Variants (`canaryVariants(field, value)` returns `{ form, text }[]`)

- **Forms:**
  - `raw`, `lower`, `urlencoded` (encodeURIComponent), `form` (spaces as `+`), `json` (JSON-escaped, no quotes)
  - `base64`, `base64url`
  - `sha256`, `sha1`, `md5`, each lowercase hex **and** uppercase hex; for email, hash the trimmed lowercase value; for phone, hash the E.164 value
- **Extra phone forms:** `e164` (`+447700900123`), `digits` (`447700900123`), `national` (`07700900123`), `spaced` (`+44 7700 900123`), plus the sha256 of the digits.
- Drop any variant shorter than 8 characters and de-duplicate by text.

## Matching (`findCanaries(haystack: string | Uint8Array, fields)` returns `Matched[]`)

Substring search of every variant; a Uint8Array is searched as UTF-8 bytes.
`Matched` is `{ field, form }` from `@fineprint/core`. Return each (field, form) pair at most once.

## Egress recorder

`startEgressRecorder({ targetRoot, respond? })` returns `{ requests, stop(), clear() }`.

- `BatchInterceptor` from `@mswjs/interceptors` with `FetchInterceptor` (`@mswjs/interceptors/fetch`) and `ClientRequestInterceptor` (`@mswjs/interceptors/ClientRequest`); call `.apply()`, and `.dispose()` in `stop()`.
- In `interceptor.on('request', async ({ request, controller }) => ...)`:
  - read the body with `await request.clone().text()` (cap it at 64 KB)
  - record `{ method, url, host, path (pathname + search), headers (name to value; redact authorization values), body, callSite }`
  - **always** call `controller.respondWith(...)`: `respond?.(record)`, or a default `new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })`
  - so nothing ever reaches the network
- **Call site.** The listener runs after async hops, so its own stack loses the caller. Capture the stack synchronously at the call:
  - before applying the interceptors, wrap `globalThis.fetch`, `http.request`/`http.get` and `https.request`/`https.get` with functions that do `new Error().stack` and run the original inside an `AsyncLocalStorage` store holding that stack
  - read the store in the listener
  - restore the originals in `stop()`
- `callSiteFrom(stack, targetRoot)` returns the first frame whose file is inside `targetRoot` and not in `node_modules` or in the harness package itself, formatted `relative/path.ts:line`; `undefined` if none.
- `matchRequest(record, fields)` returns `Matched[]`, searching the URL (raw and decoded), header values and body.

## Tests (must pass)

- **`canary.test.ts`:** each field is present and unique per runId; the forms are included; the phone forms are correct; no variant is shorter than 8 characters.
- **`egress-detect.test.ts`:**
  - Setup: start the recorder, then send with both `fetch` and `node:http` to `http://collector.test/...`.
  - The raw email in a JSON body is found as `raw`.
  - `sha256(email)` in the query is found as `sha256`.
  - The base64 phone in a header is found as `base64`.
  - The form-encoded pw is found as `form`.
  - Every call receives a 200.
- **`egress-clean.test.ts`:**
  - 1,000 requests with seeded pseudo-random JSON, form and text payloads (no canaries) produce **zero** matches.
  - A request to `http://unroutable.fineprint.invalid/x` resolves with 200, which proves it was intercepted.
- **`egress-callsite.test.ts`:** `fixtures/target/src/leaky.ts` exports `sendLeak()`, which calls `fetch`. With `targetRoot` set to `test/fixtures/target`, the recorded callSite is `src/leaky.ts:<the fetch line>`. Do the same for a `node:http` call.

## Rules

- Only touch `packages/harness/`.
- Every file stays under 300 lines, with no `console.log` in `src/`.
- Don't commit.

## Acceptance: run all of these and show the output

```
pnpm --filter @fineprint/harness run typecheck
pnpm --filter @fineprint/harness exec vitest run canary
pnpm --filter @fineprint/harness exec vitest run egress-detect
pnpm --filter @fineprint/harness exec vitest run egress-clean
pnpm --filter @fineprint/harness exec vitest run egress-callsite
```
