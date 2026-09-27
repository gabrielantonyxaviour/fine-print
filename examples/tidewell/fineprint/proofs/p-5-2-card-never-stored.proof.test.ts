import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, pay } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-5-2-card-never-stored: full card number never in any store', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    const agent = await login(run, japp.instance);
    await pay(run, agent);

    run.expect.flowExercised('pay');
    run.expect.noResidue({ data: ['card.number'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
