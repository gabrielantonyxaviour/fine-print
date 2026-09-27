import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, book, deleteAccount, runRetentionJob } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-6-1-deletion-30-days: personal data gone after 30 days', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    const agent = await login(run, japp.instance);
    await book(run, agent);

    // Record deletion timestamp so the retention job is advanced 31 days past it.
    const deletedAt = new Date().toISOString();
    await deleteAccount(run, agent);

    // Positive controls: canary data must be present in stores before retention runs.
    run.expect.flowExercised('book');
    run.expect.present({ data: ['email', 'name', 'phone'] });

    // Advance clock 31 days past deletion and run the retention job.
    await runRetentionJob(run, japp.instance, deletedAt);

    run.expect.flowExercised('retentionJob');

    // After retention, no trace of email, name, or phone must remain in any store.
    run.expect.noResidue({ data: ['email', 'name', 'phone'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
