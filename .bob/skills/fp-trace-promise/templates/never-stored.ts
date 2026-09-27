// Template: never-stored.ts
// Use when: a sensitive value (e.g. password) must never appear in any store or log.
// Replace every UPPER_SNAKE_CASE placeholder before running.

import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts'; // path to target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

// PROMISE_ID  - the promise id from the privacy policy (e.g. "pw-never-stored")
// DATA_FIELDS - array of canary field names that must never be stored (e.g. ['pw'])
// FLOW_NAMES  - array of journey names that submit the value (e.g. ['signup', 'login'])

test('PROMISE_ID: PROMISE_SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  try {
    await journeys.signup(run);  // submit the value via signup
    await journeys.login(run);   // submit the value again via login

    run.expect.flowExercised('signup'); // positive control: journey must have run
    run.expect.flowExercised('login');  // positive control: journey must have run

    run.expect.noResidue({ data: DATA_FIELDS }); // value must not appear in any store or log
  } finally {
    run.stop();
  }
});
