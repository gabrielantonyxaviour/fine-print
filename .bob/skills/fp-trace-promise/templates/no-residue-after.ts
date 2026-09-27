// Template: no-residue-after.ts
// Use when: no data remains after account deletion + retention window.
// Replace every UPPER_SNAKE_CASE placeholder before running.

import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts'; // path to target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

// PROMISE_ID   - the promise id from the privacy policy (e.g. "email-deleted-after-30d")
// DATA_FIELDS  - array of canary field names to check (e.g. ['email', 'name'])
// WINDOW_DAYS  - retention window in days after which data must be gone (e.g. 30)

test('PROMISE_ID: PROMISE_SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  try {
    await journeys.signup(run);   // sign up the canary user
    await journeys.useApp(run);   // use the app to generate stored data

    run.expect.flowExercised('signup'); // positive control: signup must have run
    run.expect.present({ data: DATA_FIELDS }); // positive control: data must be present before deletion

    await journeys.deleteAccount(run); // delete the account
    await run.advanceDays(WINDOW_DAYS + 1); // advance past the retention window
    await journeys.runRetentionJobs(run); // trigger retention/purge jobs

    run.expect.noResidue({ data: DATA_FIELDS }); // data must be gone
  } finally {
    run.stop();
  }
});
