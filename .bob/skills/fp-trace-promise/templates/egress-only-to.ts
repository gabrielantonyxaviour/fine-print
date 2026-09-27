// Template: egress-only-to.ts
// Use when: data may leave only for the listed hosts.
// Replace every UPPER_SNAKE_CASE placeholder before running.

import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts'; // path to target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

// PROMISE_ID  - the promise id from the privacy policy (e.g. "email-only-to-sendgrid")
// DATA_FIELDS - array of canary field names to check (e.g. ['email'])
// FLOW_NAMES  - array of journey names that touch the data (e.g. ['signup', 'newsletter'])
// ALLOWED_HOSTS - array of hostnames data is permitted to reach (e.g. ['api.sendgrid.com'])

test('PROMISE_ID: PROMISE_SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  try {
    await journeys.FLOW_NAMES[0](run); // run each journey that touches DATA_FIELDS

    run.expect.flowExercised('FLOW_NAMES[0]'); // positive control: journey must have run
    run.expect.present({ data: DATA_FIELDS });  // positive control: data must have been seen

    run.expect.egress({
      data: DATA_FIELDS,
      onlyTo: ALLOWED_HOSTS,
    });
  } finally {
    run.stop();
  }
});
