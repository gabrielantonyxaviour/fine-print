import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-5-1-login-data-not-readable: password never in any store', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    await login(run, japp.instance);

    // Positive controls: both flows must have actually run before we check residue
    run.expect.flowExercised('signup');
    run.expect.flowExercised('login');

    // The canary password must not appear in plaintext in any store or log file.
    // BROKEN: requestLog writes req.body (including password) to logs/app.log at
    // debug level for /api/signup and /api/login, and LOG_LEVEL defaults to 'debug'.
    run.expect.noResidue({ data: ['pw'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
