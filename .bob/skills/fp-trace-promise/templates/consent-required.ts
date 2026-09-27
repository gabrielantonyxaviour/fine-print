// Template: consent-required.ts
// Use when: data only reaches a host if the user opted in.
// Replace every UPPER_SNAKE_CASE placeholder before running.

import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import * as journeys from '../journeys.ts'; // path to target's fineprint/journeys.ts

const targetRoot = new URL('../..', import.meta.url).pathname;

// PROMISE_ID      - the promise id (e.g. "email-marketing-consent-required")
// MARKETING_HOST  - the host that must only receive opted-in users' data (e.g. 'api.mailchimp.com')
// DATA_FIELDS     - array of canary field names (e.g. ['email'])

test('PROMISE_ID: PROMISE_SHORT_DESCRIPTION', async () => {
  const run = startRun({ targetRoot });
  const optedOut = run.extraCanary(); // second canary who does NOT opt in
  try {
    await journeys.signupOptedIn(run);       // sign up run.canary with marketing consent
    await journeys.signupOptedOut(optedOut); // sign up optedOut canary without consent
    await journeys.runMarketingJobs(run);    // trigger the marketing send jobs

    run.expect.flowExercised('signupOptedIn'); // positive control: opted-in journey must have run

    // Control: opted-in user's email must have reached MARKETING_HOST
    const reached = run.egress.requests.some(
      (req) => req.host === MARKETING_HOST && req.body.includes(run.canary.email),
    );
    if (!reached) throw new Error('Opted-in email never reached ' + MARKETING_HOST);

    // Assertion: opted-out user's email must not reach MARKETING_HOST
    run.expect.egress({
      data: DATA_FIELDS,
      matchRequest: (req) => req.body.includes(optedOut.email),
      never: [MARKETING_HOST],
    });
  } finally {
    run.stop();
  }
});
