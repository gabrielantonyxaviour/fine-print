import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { cpSync, rmSync, writeFileSync } from 'node:fs';

const cliPath = resolve(new URL('../src/main.ts', import.meta.url).pathname);
const fixtureRoot = resolve(new URL('./fixtures/tiny', import.meta.url).pathname);

afterAll(() => {
  try { rmSync(join(fixtureRoot, 'fineprint', 'ledger.json')); } catch { /* ok */ }
  try { rmSync(join(fixtureRoot, 'fineprint', 'runs'), { recursive: true, force: true }); } catch { /* ok */ }
});

describe('fineprint guard (tiny fixture)', () => {
  it('exits 1 and stderr contains section and promise quote', () => {
    const result = spawnSync('node', [cliPath, 'guard', '--target', fixtureRoot], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('§2');
    expect(result.stderr).toContain('Phone numbers are never shared');
  });

  it('exits 0 when trackSignup is a no-op', () => {
    const cleanRoot = resolve(new URL('./fixtures/tiny-clean', import.meta.url).pathname);
    try {
      cpSync(fixtureRoot, cleanRoot, { recursive: true });
      writeFileSync(
        join(cleanRoot, 'src', 'app.ts'),
        [
          'export async function sendSms(phone: string): Promise<void> {',
          '  await fetch(`https://api.twilio.com/2010-04-01/Accounts/TEST/Messages`, {',
          '    method: \'POST\',',
          '    headers: { \'Content-Type\': \'application/x-www-form-urlencoded\' },',
          '    body: `To=${encodeURIComponent(phone)}&Body=Hello`,',
          '  });',
          '}',
          '',
          'import { createHash as _createHash } from \'node:crypto\';',
          '',
          'export async function trackSignup(_phone: string): Promise<void> {',
          '  // no-op',
          '}',
        ].join('\n'),
      );

      const result = spawnSync('node', [cliPath, 'guard', '--target', cleanRoot], {
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Fine Print: all promises kept');
    } finally {
      try { rmSync(cleanRoot, { recursive: true, force: true }); } catch { /* ok */ }
    }
  });
});
