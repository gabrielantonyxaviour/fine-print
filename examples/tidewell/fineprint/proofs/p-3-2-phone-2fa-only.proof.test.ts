import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, runNightlyJobs } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-3-2-phone-2fa-only: phone only to Twilio', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    // Drive the flows that exercise every phone-egress path:
    //   signup  → stores phone in DB
    //   login   → sendVerificationSms → api.twilio.com  (allowed)
    //   nightly → uploadPhoneAudience → graph.facebook.com (breach)
    await signup(run, japp.instance);
    await login(run, japp.instance);
    await runNightlyJobs(run, japp.instance);

    // Positive controls: the flows ran and the phone is actually in the data dir
    run.expect.flowExercised('login');
    run.expect.flowExercised('nightlyJobs');
    run.expect.present({ data: ['phone'] });

    // Promise assertion: phone must only egress to api.twilio.com
    run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
