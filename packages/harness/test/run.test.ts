import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { startRun } from '../src/run.ts';
import { FinePrintBreach, FinePrintControlFailure } from '@fineprint/core';

const runs: ReturnType<typeof startRun>[] = [];

function makeRun() {
  const run = startRun({ targetRoot: '/tmp/fineprint-test-target' });
  runs.push(run);
  return run;
}

afterEach(async () => {
  for (const run of runs) {
    try {
      run.stop();
    } catch {
      // ignore
    }
  }
  runs.length = 0;
});

describe('run.expect.egress', () => {
  it('passes when phone is sent only to allowed host', async () => {
    const run = makeRun();
    const phone = run.canary.phone;

    // Simulate a recorded request to Twilio carrying the phone
    await fetch(`https://api.twilio.com/sms?to=${encodeURIComponent(phone)}`);

    // Should not throw — phone going to twilio is allowed
    expect(() =>
      run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] }),
    ).not.toThrow();
  });

  it('throws FinePrintBreach naming graph.facebook.com for SHA-256 phone sent there', async () => {
    const run = makeRun();
    const phone = run.canary.phone;
    const sha256 = createHash('sha256').update(phone, 'utf8').digest('hex');

    // Send SHA-256 hashed phone to Facebook
    await fetch(`https://graph.facebook.com/events?ph=${sha256}`);

    expect(() =>
      run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] }),
    ).toThrowError(FinePrintBreach);

    // Verify the error names the offending host
    try {
      run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] });
    } catch (err) {
      expect(err).toBeInstanceOf(FinePrintBreach);
      expect((err as FinePrintBreach).message).toContain('graph.facebook.com');
    }
  });
});

describe('run.expect.present', () => {
  it('throws FinePrintControlFailure on an empty dataDir', () => {
    const run = makeRun();

    expect(() => run.expect.present({ data: ['email'] })).toThrowError(FinePrintControlFailure);
  });
});

describe('run.expect.flowExercised', () => {
  it('throws until markFlow is called', () => {
    const run = makeRun();

    expect(() => run.expect.flowExercised('signup')).toThrowError(FinePrintControlFailure);

    run.markFlow('signup');

    expect(() => run.expect.flowExercised('signup')).not.toThrow();
  });
});

describe('run.expect.cookies', () => {
  it('flags tw_ad_id when only tw_session is allowed', () => {
    const run = makeRun();

    run.recordCookies([
      'tw_session=abc123; Path=/; HttpOnly',
      'tw_ad_id=xyz789; Path=/; SameSite=None',
    ]);

    expect(() => run.expect.cookies({ allow: ['tw_session'] })).toThrowError(FinePrintBreach);

    try {
      run.expect.cookies({ allow: ['tw_session'] });
    } catch (err) {
      expect(err).toBeInstanceOf(FinePrintBreach);
      expect((err as FinePrintBreach).message).toContain('tw_ad_id');
      const breach = err as FinePrintBreach;
      const cookieEvidence = breach.evidence.filter((e) => e.kind === 'cookie');
      expect(cookieEvidence.some((e) => e.kind === 'cookie' && e.name === 'tw_ad_id')).toBe(true);
    }
  });
});
