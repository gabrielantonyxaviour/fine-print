# Task 05b: proof templates for `fp-trace-promise`

Create `.bob/skills/fp-trace-promise/templates/` with six short, complete Vitest proof templates.
In `SKILL.md`, replace "Import `startRun` from the core runner" with "Import `startRun` from `@fineprint/harness`".
Placeholders are UPPER_SNAKE_CASE with a comment saying what goes there. Plain ASCII.

## The harness API (already built)

```ts
import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts';          // the target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

test('PROMISE_ID: SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  try {
    // run.canary: { name, email, phone, pw, ip, healthReason, card }; run.extraCanary()
    // journeys receive `run` and drive the app; they call run.markFlow(name) and run.recordCookies(headers)
    // run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] } | { data, never: ['graph.facebook.com'] })
    // run.expect.noResidue({ data: ['email', 'name'] })  run.expect.present({ data: ['email'] })
    // run.expect.flowExercised('signup')  run.expect.cookies({ allow: ['tw_session'] })
  } finally {
    run.stop();
  }
});
```

Canary field names for `data` are `name`, `email`, `phone`, `pw`, `ip`, `healthReason` and `card`.

## Templates, one file each, 15 to 30 lines

- **`egress-only-to.ts`:** run all the journeys that touch the data, then `flowExercised`, then `egress({ data, onlyTo: ALLOWED_HOSTS })`.
- **`egress-never-to.ts`:** the same, with `never: FORBIDDEN_HOSTS`.
- **`no-residue-after.ts`:** sign up and use the app, then `present({ data })`. Next, delete the account, advance past WINDOW_DAYS + 1 and run the retention jobs, then `noResidue({ data })`.
- **`never-stored.ts`:** run the journeys that submit the value (e.g. sign up and sign in), then `flowExercised`, then `noResidue({ data: ['pw'] })`.
- **`consent-required.ts`:** sign up `run.canary` opted in and `run.extraCanary()` opted out, then run the jobs. The opted-in user's email must reach MARKETING_HOST (the control: the proof checks `run.egress.requests` contains it), and `egress({ data: ['email'] ... })` must not carry the opted-out user's email there. Match on that user's value with `matchRequest`.
- **`cookies-only.ts`:** run every journey, then `flowExercised('signup')`, then `cookies({ allow: ALLOWED_COOKIES })`.

## Acceptance: show the output

```
ls .bob/skills/fp-trace-promise/templates
grep -n "fineprint/harness" .bob/skills/fp-trace-promise/SKILL.md
```
