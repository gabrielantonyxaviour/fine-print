import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type TidewellApp } from '../src/app.ts';
import { all, one } from '../src/db.ts';

type OutboundCall = { url: string; method: string; body: string };

let calls: OutboundCall[];
let instance: TidewellApp;
let dataDir: string;

const PASSWORD = 'harbour-tide-92';

beforeEach(() => {
  calls = [];
  const stub = vi.fn(async (input: unknown, init: { method?: string; body?: unknown } = {}) => {
    calls.push({
      url: String(input),
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? init.body : '',
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', stub);
  dataDir = mkdtempSync(join(tmpdir(), 'tidewell-'));
  instance = createApp({ dataDir, testRoutes: true });
});

afterEach(() => {
  instance.close();
  rmSync(dataDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function callsTo(hostFragment: string): OutboundCall[] {
  return calls.filter((call) => call.url.includes(hostFragment));
}

type Person = { name: string; email: string; phone: string; marketingOptIn?: boolean };

async function register(person: Person) {
  await request(instance.app)
    .post('/api/signup')
    .send({ password: PASSWORD, marketingOptIn: false, ...person })
    .expect(201);
}

async function signIn(person: Person) {
  const agent = request.agent(instance.app);
  await agent.post('/api/login').send({ email: person.email, password: PASSWORD }).expect(200);
  const code = (
    await agent.get(`/__test/last-code?phone=${encodeURIComponent(person.phone)}`).expect(200)
  ).body.code as string;
  await agent.post('/api/login/verify').send({ code }).expect(200);
  return agent;
}

const priya: Person = { name: 'Priya Sharma', email: 'priya.sharma@example.co.uk', phone: '07700900123' };
const tom: Person = { name: 'Tom Whitfield', email: 'tom.whitfield@example.co.uk', phone: '07700900456' };

describe('accounts', () => {
  it('creates an account on signup', async () => {
    const res = await request(instance.app)
      .post('/api/signup')
      .send({ ...priya, password: PASSWORD, marketingOptIn: true })
      .expect(201);
    expect(res.body.email).toBe(priya.email);
    expect(res.body).not.toHaveProperty('password');
    expect(callsTo('api.postmarkapp.com')).toHaveLength(1);
  });

  it('rejects a duplicate email', async () => {
    await register(priya);
    const res = await request(instance.app)
      .post('/api/signup')
      .send({ ...priya, password: PASSWORD })
      .expect(409);
    expect(res.body.code).toBe('email_taken');
  });

  it('completes two-step login and exposes the profile', async () => {
    await register(priya);
    const agent = await signIn(priya);
    const me = await agent.get('/api/me').expect(200);
    expect(me.body.email).toBe(priya.email);
  });

  it('blocks verified actions until the code is entered', async () => {
    await register(priya);
    const agent = request.agent(instance.app);
    await agent.post('/api/login').send({ email: priya.email, password: PASSWORD }).expect(200);
    await agent
      .post('/api/appointments')
      .send({ clinicId: 'harbourside-physio-bristol', reason: 'knee pain', startsAt: '2026-10-01T09:00:00.000Z' })
      .expect(403);
  });
});

describe('clinics and appointments', () => {
  it('searches the clinic directory', async () => {
    const all6 = await request(instance.app).get('/api/clinics').expect(200);
    expect(all6.body.clinics).toHaveLength(6);
    const bristol = await request(instance.app).get('/api/clinics?q=bristol').expect(200);
    expect(bristol.body.clinics.map((c: { name: string }) => c.name)).toContain('Harbourside Physio');
  });

  it('books an appointment and finds it in the patient search', async () => {
    await register(priya);
    const agent = await signIn(priya);
    const booking = await agent
      .post('/api/appointments')
      .send({ clinicId: 'ashgrove-medical-leeds', reason: 'annual review', startsAt: '2026-10-05T14:30:00.000Z' })
      .expect(201);
    expect(booking.body.clinic).toBe('Ashgrove Medical Practice');

    const found = await agent.get('/api/appointments/search?q=annual').expect(200);
    expect(found.body.results).toHaveLength(1);
    expect(found.body.results[0].reason).toBe('annual review');
  });

  it('keeps each patient\'s booking search to their own appointments', async () => {
    await register(priya);
    await register(tom);
    const priyaAgent = await signIn(priya);
    const tomAgent = await signIn(tom);
    await priyaAgent
      .post('/api/appointments')
      .send({ clinicId: 'castlegate-health-york', reason: 'physio follow-up', startsAt: '2026-11-02T10:00:00.000Z' })
      .expect(201);
    const tomResults = await tomAgent.get('/api/appointments/search?q=physio').expect(200);
    expect(tomResults.body.results).toHaveLength(0);
  });
});

describe('payments', () => {
  it('stores the last four digits and never the full card number', async () => {
    await register(priya);
    const agent = await signIn(priya);
    const cardNumber = '4242424242424242';
    const res = await agent
      .post('/api/payments')
      .send({ cardNumber, expMonth: 4, expYear: 2030, cvc: '123', amountPence: 4500 })
      .expect(201);
    expect(res.body.last4).toBe('4242');

    const rows = all<Record<string, unknown>>(instance.context.db, 'SELECT * FROM payments');
    expect(rows).toHaveLength(1);
    const serialised = JSON.stringify(rows[0]);
    expect(serialised).toContain('4242');
    expect(serialised).not.toContain(cardNumber);
  });
});

describe('nightly jobs', () => {
  it('subscribes only opted-in users to the newsletter', async () => {
    await register({ ...priya, marketingOptIn: true });
    await register({ ...tom, marketingOptIn: false });

    await request(instance.app)
      .post('/__test/run-jobs')
      .send({ now: '2026-09-20T02:00:00.000Z', which: 'nightly' })
      .expect(200);

    const mailchimp = callsTo('api.mailchimp.com');
    expect(mailchimp).toHaveLength(1);
    expect(mailchimp[0]?.body).toContain(priya.email);
    expect(mailchimp[0]?.body).not.toContain(tom.email);
  });
});

describe('deletion and retention', () => {
  it('removes the account for good after the grace period', async () => {
    await register(priya);
    const agent = await signIn(priya);
    await agent.post('/api/me/delete').expect(200);

    await request(instance.app)
      .post('/__test/run-jobs')
      .send({ now: '2026-11-05T02:00:00.000Z', which: 'retention' })
      .expect(200);

    const user = one(instance.context.db, 'SELECT id FROM users WHERE email = ?', priya.email);
    expect(user).toBeUndefined();
    const sessions = all(instance.context.db, 'SELECT id FROM sessions');
    expect(sessions).toHaveLength(0);
  });
});
