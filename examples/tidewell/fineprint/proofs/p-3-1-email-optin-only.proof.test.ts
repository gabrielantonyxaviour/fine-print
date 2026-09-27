import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, runNightlyJobs } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-3-1-email-optin-only: email only to Mailchimp when opted in', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    // Register canary with marketing opt-out (marketingOptIn: false)
    await signup(run, japp.instance);

    // Run the nightly job that drives syncNewsletter → subscribeMember
    await runNightlyJobs(run, japp.instance);

    // Positive control: canary email must be stored in the database
    run.expect.present({ data: ['email'] });

    // Positive control: nightly job flow was exercised
    run.expect.flowExercised('nightlyJobs');

    // Core assertion: email must never have been sent to api.mailchimp.com
    // because the user did NOT opt in (marketing_opt_in = 0 is excluded by the SQL filter)
    run.expect.egress({ data: ['email'], never: ['api.mailchimp.com'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
