import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { bootApp, signup, login, book, deleteAccount } from '../journeys.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-5-3-session-cookie-only: only tw_session cookie set', async () => {
  const run = startRun({ targetRoot });
  const japp = bootApp(run);
  try {
    await signup(run, japp.instance);
    const agent = await login(run, japp.instance);
    await book(run, agent);
    await deleteAccount(run, agent);

    // Positive controls: confirm the journey actually exercised the key flows
    run.expect.flowExercised('login');
    run.expect.flowExercised('deleteAccount');

    // Promise assertion: no cookie other than tw_session was ever set
    run.expect.cookies({ allow: ['tw_session'] });
  } finally {
    japp.teardown();
    run.stop();
  }
});
