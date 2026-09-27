import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { createCanary, canaryFields } from '../src/canary/factory.ts';
import { startEgressRecorder, matchRequest } from '../src/egress/recorder.ts';
import type { EgressRecorder } from '../src/egress/recorder.ts';

let recorder: EgressRecorder;
const canary = createCanary('cln001');
const fields = canaryFields(canary);

beforeEach(() => {
  recorder = startEgressRecorder({ targetRoot: '/tmp' });
});

afterEach(() => {
  recorder.stop();
});

// A simple deterministic pseudo-random number generator (seeded)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  'apple', 'carrot', 'forest', 'matrix', 'orange', 'purple', 'river', 'sunset',
  'tablet', 'winter', 'yellow', 'jungle', 'castle', 'flight', 'candle', 'breeze',
];

function randomWord(rng: () => number): string {
  return WORDS[Math.floor(rng() * WORDS.length)] ?? 'word';
}

function makePayload(rng: () => number, kind: 'json' | 'form' | 'text'): string {
  const a = randomWord(rng);
  const b = randomWord(rng);
  const c = Math.floor(rng() * 100000);
  if (kind === 'json') return JSON.stringify({ a, b, c, flag: rng() > 0.5 });
  if (kind === 'form') return `field1=${a}&field2=${b}&count=${c}`;
  return `${a} ${b} ${c}`;
}

describe('egress-clean', () => {
  it('1000 requests with no canary produce zero matches', async () => {
    const rng = mulberry32(42);
    const kinds = ['json', 'form', 'text'] as const;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 1000; i++) {
      const kind = kinds[i % 3]!;
      const body = makePayload(rng, kind);
      promises.push(
        fetch(`http://collector.test/clean-${i}`, {
          method: 'POST',
          body,
        }).then(() => undefined),
      );
    }

    await Promise.all(promises);

    expect(recorder.requests).toHaveLength(1000);

    for (const req of recorder.requests) {
      const matches = matchRequest(req, fields);
      expect(matches).toHaveLength(0);
    }
  });

  it('unroutable domain resolves with 200 (intercepted)', async () => {
    const res = await fetch('http://unroutable.fineprint.invalid/x', { method: 'GET' });
    expect(res.status).toBe(200);
  });
});
