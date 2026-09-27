import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, book, runNightlyJobs } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-4-2-email-never-advertisers: email never to graph.facebook.com', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    const agent = await login(run, japp.instance);
    await book(run, agent);
    await runNightlyJobs(run, japp.instance);

    // Positive controls: confirm the journey ran and email is stored
    run.expect.flowExercised('book');
    run.expect.flowExercised('nightlyJobs');
    run.expect.present({ data: ['email'] });

    // Privacy assertion: email must never egress to graph.facebook.com
    run.expect.egress({ data: ['email'], never: ['graph.facebook.com'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
