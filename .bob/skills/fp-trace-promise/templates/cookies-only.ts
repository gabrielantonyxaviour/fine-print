// Template: cookies-only.ts
// Use when: only the listed cookie names may be set.
// Replace every UPPER_SNAKE_CASE placeholder before running.

import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts'; // path to target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

// PROMISE_ID      - the promise id (e.g. "cookies-only-session")
// ALLOWED_COOKIES - array of cookie names that are permitted (e.g. ['session_id', 'csrf'])

test('PROMISE_ID: PROMISE_SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  try {
    await journeys.signup(run);   // run every journey that might set cookies
    await journeys.login(run);
    await journeys.useApp(run);

    run.expect.flowExercised('signup'); // positive control: signup must have run

    run.expect.cookies({ allow: ALLOWED_COOKIES }); // only listed cookies may be set
  } finally {
    run.stop();
  }
});
