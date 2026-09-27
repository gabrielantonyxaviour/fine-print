import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import {
  bootApp,
  signupOptIn,
  login,
  book,
  pay,
  runNightlyJobs,
} from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-4-3-providers-only: personal data only to listed providers', async () => {
  const run = startRun({ targetRoot });
  const app = bootApp(run);

  try {
    await signupOptIn(run, app.instance);
    const agent = await login(run, app.instance);
    await book(run, agent);
    await pay(run, agent);
    await runNightlyJobs(run, app.instance);

    // Positive controls: all flows exercised and canary data written to stores
    run.expect.flowExercised('signupOptIn');
    run.expect.flowExercised('login');
    run.expect.flowExercised('book');
    run.expect.flowExercised('pay');
    run.expect.flowExercised('nightlyJobs');
    run.expect.present({ data: ['email', 'phone', 'name'] });

    // Promise check: email, phone, name must only egress to the five listed providers
    run.expect.egress({
      data: ['email', 'phone', 'name'],
      onlyTo: [
        'api.twilio.com',
        'api.postmarkapp.com',
        'api.mailchimp.com',
        'api.stripe.com',
      ],
    });
  } finally {
    app.teardown();
    run.stop();
  }
});
