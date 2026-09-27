import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, book } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-4-1-health-never-advertisers: health reason never to advertisers', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    const agent = await login(run, japp.instance);
    await book(run, agent);

    // Positive controls: the booking flow ran and healthReason is on disk.
    run.expect.flowExercised('book');
    run.expect.present({ data: ['healthReason'] });

    // Privacy assertion: healthReason must never have egressed to graph.facebook.com.
    run.expect.egress({ data: ['healthReason'], never: ['graph.facebook.com'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
