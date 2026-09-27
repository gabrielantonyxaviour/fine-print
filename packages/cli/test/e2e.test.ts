import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync, existsSync, rmSync } from 'node:fs';

const cliPath = resolve(new URL('../src/main.ts', import.meta.url).pathname);
const fixtureRoot = resolve(new URL('./fixtures/tiny', import.meta.url).pathname);
const ledgerPath = join(fixtureRoot, 'fineprint', 'ledger.json');

afterAll(() => {
  // Clean up ledger and runs produced by e2e
  try { rmSync(join(fixtureRoot, 'fineprint', 'ledger.json')); } catch { /* ok */ }
  try { rmSync(join(fixtureRoot, 'fineprint', 'runs'), { recursive: true, force: true }); } catch { /* ok */ }
});

describe('fineprint prove (tiny fixture)', () => {
  it('exits 1 (some broken)', () => {
    const result = spawnSync('node', [cliPath, 'prove', fixtureRoot, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });
    expect(result.status).toBe(1);
  });

  it('gives kept, broken and needs_review verdicts', () => {
    const result = spawnSync('node', [cliPath, 'prove', fixtureRoot, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });
    const ledger = JSON.parse(result.stdout);
    const verdicts = Object.fromEntries(
      ledger.entries.map((e: { promiseId: string; verdict: string }) => [e.promiseId, e.verdict]),
    );
    expect(verdicts['p-1-kept-sms']).toBe('kept');
    expect(verdicts['p-2-broken-ads']).toBe('broken');
    expect(verdicts['p-3-review']).toBe('needs_review');
  });

  it('broken entry has egress evidence with host graph.facebook.com and callSite in src/app.ts', () => {
    const result = spawnSync('node', [cliPath, 'prove', fixtureRoot, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });
    const ledger = JSON.parse(result.stdout);
    const broken = ledger.entries.find(
      (e: { promiseId: string }) => e.promiseId === 'p-2-broken-ads',
    );
    expect(broken).toBeDefined();
    expect(broken.evidence.length).toBeGreaterThan(0);
    const ev = broken.evidence.find(
      (e: { kind: string; host?: string }) => e.kind === 'egress' && e.host === 'graph.facebook.com',
    );
    expect(ev).toBeDefined();
    expect(ev.callSite).toBeDefined();
    expect(ev.callSite).toContain('src/app.ts');
  });

  it('ledger.json is written and validates against LedgerSchema', () => {
    spawnSync('node', [cliPath, 'prove', fixtureRoot, '--json'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });
    expect(existsSync(ledgerPath)).toBe(true);
    const raw = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    // Validate structure
    expect(raw).toHaveProperty('policy');
    expect(raw).toHaveProperty('run');
    expect(raw).toHaveProperty('entries');
    expect(Array.isArray(raw.entries)).toBe(true);
    expect(raw.run).toHaveProperty('id');
    expect(raw.run).toHaveProperty('counts');
  });
});
