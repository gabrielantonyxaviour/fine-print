import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as nodePath from 'node:path';
import * as nodeUrl from 'node:url';
import { startEgressRecorder } from '../src/egress/recorder.ts';
import type { EgressRecorder } from '../src/egress/recorder.ts';

const fixturesRoot = nodePath.resolve(
  nodePath.dirname(nodeUrl.fileURLToPath(import.meta.url)),
  'fixtures/target',
);

let recorder: EgressRecorder;

beforeEach(() => {
  recorder = startEgressRecorder({ targetRoot: fixturesRoot });
});

afterEach(() => {
  recorder.stop();
});

describe('egress-callsite', () => {
  it('fetch callSite points to leaky.ts with correct line', async () => {
    // Dynamically import AFTER recorder is started so the wrapped fetch is captured
    const { sendLeak } = await import('./fixtures/target/src/leaky.ts');
    await sendLeak();

    expect(recorder.requests.length).toBeGreaterThanOrEqual(1);
    const req = recorder.requests[recorder.requests.length - 1]!;
    expect(req.callSite).toBeDefined();
    // Should point into src/leaky.ts
    expect(req.callSite).toMatch(/src\/leaky\.ts:\d+/);
  });

  it('http callSite points to leaky.ts with correct line', async () => {
    const { sendLeakHttp } = await import('./fixtures/target/src/leaky.ts');
    await sendLeakHttp();

    expect(recorder.requests.length).toBeGreaterThanOrEqual(1);
    const req = recorder.requests[recorder.requests.length - 1]!;
    expect(req.callSite).toBeDefined();
    expect(req.callSite).toMatch(/src\/leaky\.ts:\d+/);
  });
});
