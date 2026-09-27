/**
 * Tidewell journey functions for Fine Print proofs.
 *
 * Each exported function drives the real Tidewell app in-process using
 * supertest. They all accept a `Run` from `startRun` and return nothing;
 * assertions are left to the individual proof files.
 *
 * Flows exercised:
 *   signup          – POST /api/signup
 *   login           – POST /api/login → /__test/last-code → POST /api/login/verify
 *   book            – POST /api/appointments
 *   pay             – POST /api/payments
 *   nightlyJobs     – POST /__test/run-jobs { which: 'nightly' }
 *   deleteAccount   – POST /api/me/delete
 *   retentionJob    – POST /__test/run-jobs { which: 'retention', now: day-31 }
 */

import request from 'supertest';
import { createApp, type TidewellApp } from '../src/app.ts';
import type { Run } from '@fineprint/harness';

export type JourneyApp = {
  instance: TidewellApp;
  teardown(): void;
};

/** Boot a fresh Tidewell app rooted at `run.dataDir`. */
export function bootApp(run: Run): JourneyApp {
  const instance = createApp({ dataDir: run.dataDir, testRoutes: true });
  return {
    instance,
    teardown: () => instance.close(),
  };
}

/** Sign up the canary. Marks flow 'signup'. */
export async function signup(run: Run, app: TidewellApp): Promise<void> {
  await request(app.app)
    .post('/api/signup')
    .send({
      name: run.canary.name,
      email: run.canary.email,
      phone: run.canary.phone,
      password: run.canary.pw,
      marketingOptIn: false,
    })
    .expect(201);
  run.markFlow('signup');
}

/** Sign up the canary with marketing opt-in enabled. Marks flow 'signupOptIn'. */
export async function signupOptIn(run: Run, app: TidewellApp): Promise<void> {
  await request(app.app)
    .post('/api/signup')
    .send({
      name: run.canary.name,
      email: run.canary.email,
      phone: run.canary.phone,
      password: run.canary.pw,
      marketingOptIn: true,
    })
    .expect(201);
  run.markFlow('signupOptIn');
}

/**
 * Sign in the canary, complete 2FA, and return an authenticated supertest agent.
 * Calls `run.recordCookies`. Marks flow 'login'.
 */
export async function login(run: Run, app: TidewellApp): Promise<request.Agent> {
  const agent = request.agent(app.app);

  const loginRes = await agent
    .post('/api/login')
    .send({ email: run.canary.email, password: run.canary.pw })
    .expect(200);

  run.recordCookies(
    ([] as string[]).concat(loginRes.headers['set-cookie'] ?? []),
  );

  const codeRes = await agent
    .get(`/__test/last-code?phone=${encodeURIComponent(run.canary.phone)}`)
    .expect(200);
  const code = (codeRes.body as { code: string }).code;

  const verifyRes = await agent.post('/api/login/verify').send({ code }).expect(200);
  run.recordCookies(
    ([] as string[]).concat(verifyRes.headers['set-cookie'] ?? []),
  );

  run.markFlow('login');
  return agent;
}

/** Book an appointment with the canary's health reason. Marks flow 'book'. */
export async function book(run: Run, agent: request.Agent): Promise<void> {
  await agent
    .post('/api/appointments')
    .send({
      clinicId: 'harbourside-physio-bristol',
      reason: run.canary.healthReason,
      startsAt: '2026-10-01T09:00:00.000Z',
    })
    .expect(201);
  run.markFlow('book');
}

/** Submit a payment with the canary card. Marks flow 'pay'. */
export async function pay(run: Run, agent: request.Agent): Promise<void> {
  await agent
    .post('/api/payments')
    .send({
      cardNumber: run.canary.card.number,
      expMonth: run.canary.card.expMonth,
      expYear: run.canary.card.expYear,
      cvc: run.canary.card.cvc,
      amountPence: 4500,
    })
    .expect(201);
  run.markFlow('pay');
}

/** Run the nightly marketing jobs. Marks flow 'nightlyJobs'. */
export async function runNightlyJobs(run: Run, app: TidewellApp, now = '2026-09-20T02:00:00.000Z'): Promise<void> {
  await request(app.app)
    .post('/__test/run-jobs')
    .send({ now, which: 'nightly' })
    .expect(200);
  run.markFlow('nightlyJobs');
}

/** Delete the canary's account. Marks flow 'deleteAccount'. */
export async function deleteAccount(run: Run, agent: request.Agent): Promise<void> {
  const res = await agent.post('/api/me/delete').expect(200);
  run.recordCookies(
    ([] as string[]).concat(res.headers['set-cookie'] ?? []),
  );
  run.markFlow('deleteAccount');
}

/**
 * Run the retention clean-up job at day 31 after the given deletion date.
 * Marks flow 'retentionJob'.
 */
export async function runRetentionJob(
  run: Run,
  app: TidewellApp,
  deletedAt = '2026-09-15T00:00:00.000Z',
): Promise<void> {
  // Advance 31 days past deletion so the grace period has elapsed.
  const cutoff = new Date(new Date(deletedAt).getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
  await request(app.app)
    .post('/__test/run-jobs')
    .send({ now: cutoff, which: 'retention' })
    .expect(200);
  run.markFlow('retentionJob');
}

/**
 * Full canary journey: signup → login → book → pay → nightlyJobs → deleteAccount → retentionJob.
 * Returns the JourneyApp so the proof can call teardown.
 */
export async function fullJourney(run: Run): Promise<JourneyApp> {
  const japp = bootApp(run);
  await signup(run, japp.instance);
  const agent = await login(run, japp.instance);
  await book(run, agent);
  await pay(run, agent);
  await runNightlyJobs(run, japp.instance);
  await deleteAccount(run, agent);
  await runRetentionJob(run, japp.instance);
  return japp;
}
