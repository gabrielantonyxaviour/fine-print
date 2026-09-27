#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { startVitest } from 'vitest/node';
import type { Reporter, TestModule } from 'vitest/node';
import {
  parseOrExplain,
  PromiseFileSchema,
  StoresFileSchema,
  LedgerSchema,
  aggregateVerdict,
  countVerdicts,
  formatBreach,
} from '@fineprint/core';
import type { LedgerEntry, PromiseFile, Evidence } from '@fineprint/core';

// ── helpers ───────────────────────────────────────────────────────────────────

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function getCommit(): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { return undefined; }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// ── proof result types ────────────────────────────────────────────────────────

interface ProofState {
  state: 'passed' | 'failed' | 'errored' | 'skipped' | 'missing';
  errorName?: string;
  errorMessage?: string;
  evidence?: Evidence[];
  durationMs?: number;
}

// ── collect vitest results ────────────────────────────────────────────────────

function collectResults(testModules: ReadonlyArray<TestModule>): Map<string, ProofState> {
  const results = new Map<string, ProofState>();
  for (const mod of testModules) {
    const fileName = basename(mod.moduleId);
    const diag = mod.diagnostic();
    const durationMs = diag.duration ?? undefined;
    const state = mod.state();

    if (state === 'queued' || state === 'pending') {
      results.set(fileName, { state: 'skipped', durationMs });
      continue;
    }

    let moduleState: ProofState['state'] = 'passed';
    let errorName: string | undefined;
    let errorMessage: string | undefined;
    let evidence: Evidence[] | undefined;

    for (const tc of mod.children.allTests()) {
      const result = tc.result();
      if (result.state === 'failed') {
        const err = result.errors[0];
        if (err) {
          errorName = err.name;
          errorMessage = err.message;
          const ev = (err as Record<string, unknown>)['evidence'];
          if (Array.isArray(ev)) evidence = ev as Evidence[];
        }
        moduleState = 'failed';
        break;
      } else if (result.state === 'skipped' && moduleState === 'passed') {
        moduleState = 'skipped';
      }
    }

    results.set(fileName, { state: moduleState, errorName, errorMessage, evidence, durationMs });
  }
  return results;
}

// ── build ledger entries ──────────────────────────────────────────────────────

function buildEntries(
  promiseFile: PromiseFile,
  proofResults: Map<string, ProofState>,
  evidenceDir: string,
): LedgerEntry[] {
  return promiseFile.promises.map((p) => {
    let matchedKey: string | undefined;
    for (const key of proofResults.keys()) {
      if (key.startsWith(p.id)) { matchedKey = key; break; }
    }

    const proofState = matchedKey ? proofResults.get(matchedKey)! : undefined;

    // Evidence fallback from FINEPRINT_EVIDENCE_DIR
    if (proofState && proofState.state === 'failed' && !proofState.evidence) {
      const evidenceFile = join(evidenceDir, (matchedKey ?? '') + '.evidence.json');
      if (existsSync(evidenceFile)) {
        try {
          proofState.evidence = JSON.parse(readFileSync(evidenceFile, 'utf8')) as Evidence[];
        } catch { /* ignore */ }
      }
    }

    const verdictState: 'passed' | 'failed' | 'errored' | 'skipped' | 'missing' =
      p.testability === 'human_review'
        ? 'passed'
        : proofState
          ? proofState.state
          : 'missing';

    const verdict = aggregateVerdict({
      state: verdictState,
      errorName: proofState?.errorName,
      category: p.category,
    });

    const reason =
      verdict === 'needs_review' ? 'human review required'
        : verdictState === 'missing' ? 'no proof file found'
          : proofState?.errorMessage ?? 'proof passed';

    return {
      promiseId: p.id,
      section: p.section,
      quote: p.quote,
      category: p.category,
      verdict,
      reason,
      evidence: proofState?.evidence ?? [],
      proofPath: matchedKey ? `fineprint/proofs/${matchedKey}` : undefined,
      durationMs: proofState?.durationMs,
    };
  });
}

// ── run vitest ────────────────────────────────────────────────────────────────

async function runVitest(
  absTarget: string,
  evidenceDir: string,
): Promise<Map<string, ProofState>> {
  const collected = new Map<string, ProofState>();

  const reporter: Reporter = {
    onTestRunEnd(testModules) {
      const results = collectResults(testModules);
      for (const [k, v] of results) collected.set(k, v);
    },
  };

  const vitest = await startVitest([], {
    watch: false,
    root: absTarget,
    include: ['fineprint/proofs/**/*.proof.test.ts'],
    env: { FINEPRINT_EVIDENCE_DIR: evidenceDir },
    reporters: [reporter],
  });

  await vitest?.close();
  return collected;
}

// ── validate ──────────────────────────────────────────────────────────────────

function cmdValidate(target: string): void {
  const promisesPath = join(target, 'fineprint', 'promises.json');
  const storesPath = join(target, 'fineprint', 'stores.json');
  try {
    parseOrExplain(PromiseFileSchema, readJson(promisesPath), promisesPath);
    if (existsSync(storesPath)) {
      parseOrExplain(StoresFileSchema, readJson(storesPath), storesPath);
    }
    console.log('ok');
    process.exit(0);
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }
}

// ── prove ─────────────────────────────────────────────────────────────────────

async function cmdProve(
  target: string,
  opts: { json?: boolean; promise?: string },
): Promise<void> {
  const absTarget = resolve(target);
  const promisesPath = join(absTarget, 'fineprint', 'promises.json');

  let promiseFile: PromiseFile;
  try {
    promiseFile = parseOrExplain(PromiseFileSchema, readJson(promisesPath), promisesPath);
  } catch (e) { console.error(String(e)); process.exit(1); }

  const promises = opts.promise
    ? promiseFile!.promises.filter((p) => p.id === opts.promise)
    : promiseFile!.promises;

  const fineprintDir = join(absTarget, 'fineprint');
  const ledgerPath = join(fineprintDir, 'ledger.json');
  const runsDir = join(fineprintDir, 'runs');
  const runId = randomBytes(6).toString('hex');
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  // Step 1: write pending ledger
  mkdirSync(fineprintDir, { recursive: true });
  const pendingEntries: LedgerEntry[] = promiseFile!.promises.map((p) => ({
    promiseId: p.id, section: p.section, quote: p.quote, category: p.category,
    verdict: 'pending', reason: 'pending', evidence: [],
  }));
  writeFileSync(ledgerPath, JSON.stringify({
    policy: promiseFile!.policy,
    run: { id: runId, startedAt, durationMs: 0, harnessVersion: '0.1.0',
           promiseCount: promiseFile!.promises.length, counts: countVerdicts(pendingEntries) },
    entries: pendingEntries,
  }, null, 2));

  // Step 2: run proofs
  const evidenceDir = join(fineprintDir, `evidence-${runId}`);
  mkdirSync(evidenceDir, { recursive: true });
  const proofResults = await runVitest(absTarget, evidenceDir);

  // Step 3 & 4: build entries and write final ledger
  const entries = buildEntries(promiseFile!, proofResults, evidenceDir);
  // Filter to only requested promises for table output, but ledger holds all
  const displayEntries = opts.promise
    ? entries.filter((e) => e.promiseId === opts.promise)
    : entries;

  const durationMs = Date.now() - startMs;
  const counts = countVerdicts(entries);
  const commit = getCommit();
  const ledger = {
    policy: promiseFile!.policy,
    run: {
      id: runId, startedAt, durationMs,
      ...(commit ? { commit } : {}),
      harnessVersion: '0.1.0',
      promiseCount: promiseFile!.promises.length,
      counts,
    },
    entries,
  };

  parseOrExplain(LedgerSchema, ledger, 'ledger');
  mkdirSync(runsDir, { recursive: true });
  const ledgerStr = JSON.stringify(ledger, null, 2);
  writeFileSync(ledgerPath, ledgerStr);
  writeFileSync(join(runsDir, `${runId}.json`), ledgerStr);

  // Clean up evidence dir
  try {
    const { rmSync } = await import('node:fs');
    rmSync(evidenceDir, { recursive: true, force: true });
  } catch { /* ignore */ }

  // Step 5: print
  if (opts.json) {
    process.stdout.write(JSON.stringify(ledger, null, 2) + '\n');
  } else {
    const ICON: Record<string, string> = {
      kept: '✔', broken: '✖', needs_review: '?', couldnt_check: '!', pending: '…',
    };
    console.log('verdict        section        quote');
    console.log('-'.repeat(80));
    for (const e of displayEntries) {
      const icon = ICON[e.verdict] ?? ' ';
      const verdict = `${icon} ${e.verdict}`.padEnd(15);
      const section = e.section.padEnd(15);
      const quote = truncate(e.quote, 60);
      console.log(`${verdict}${section}${quote}`);
    }
  }

  // Step 6: exit code
  if (entries.some((e) => e.verdict === 'broken')) process.exit(1);
  if (entries.some((e) => e.verdict === 'couldnt_check')) process.exit(2);
  process.exit(0);
}

// ── guard ─────────────────────────────────────────────────────────────────────

async function cmdGuard(opts: { targets: string[]; install: boolean }): Promise<void> {
  const targets = opts.targets.length > 0 ? opts.targets : ['examples/tidewell'];

  if (opts.install) {
    mkdirSync('.githooks', { recursive: true });
    writeFileSync('.githooks/pre-commit', '#!/bin/sh\npnpm --silent fineprint guard || exit 1\n');
    execSync('chmod +x .githooks/pre-commit');
    execSync('git config core.hooksPath .githooks');
    console.log('✔ pre-commit hook installed');
    process.exit(0);
  }

  for (const target of targets) {
    const absTarget = resolve(target);
    const promisesPath = join(absTarget, 'fineprint', 'promises.json');
    let promiseFile: PromiseFile;
    try {
      promiseFile = parseOrExplain(PromiseFileSchema, readJson(promisesPath), promisesPath);
    } catch (e) { process.stderr.write(`fineprint guard: ${String(e)}\n`); process.exit(1); }

    const fineprintDir = join(absTarget, 'fineprint');
    const runId = randomBytes(6).toString('hex');
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const evidenceDir = join(fineprintDir, `evidence-${runId}`);
    mkdirSync(evidenceDir, { recursive: true });

    const proofResults = await runVitest(absTarget, evidenceDir);

    const durationMs = Date.now() - startMs;
    const entries = buildEntries(promiseFile!, proofResults, evidenceDir);
    const counts = countVerdicts(entries);
    const commit = getCommit();
    const ledger = {
      policy: promiseFile!.policy,
      run: { id: runId, startedAt, durationMs, ...(commit ? { commit } : {}),
             harnessVersion: '0.1.0', promiseCount: promiseFile!.promises.length, counts },
      entries,
    };
    mkdirSync(join(fineprintDir, 'runs'), { recursive: true });
    const ledgerStr = JSON.stringify(ledger, null, 2);
    writeFileSync(join(fineprintDir, 'ledger.json'), ledgerStr);
    writeFileSync(join(fineprintDir, 'runs', `${runId}.json`), ledgerStr);

    try {
      const { rmSync } = await import('node:fs');
      rmSync(evidenceDir, { recursive: true, force: true });
    } catch { /* ignore */ }

    const broken = entries.filter((e) => e.verdict === 'broken');
    if (broken.length > 0) {
      for (const entry of broken) process.stderr.write(formatBreach(entry) + '\n');
      process.exit(1);
    }
  }

  console.log('✔ Fine Print: all promises kept');
  process.exit(0);
}

// ── main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'validate') {
  const target = args[1];
  if (!target) { console.error('Usage: fineprint validate <target>'); process.exit(1); }
  cmdValidate(target);
} else if (cmd === 'prove') {
  const target = args[1];
  if (!target) { console.error('Usage: fineprint prove <target> [--json] [--promise <id>]'); process.exit(1); }
  const jsonFlag = args.includes('--json');
  const promiseIdx = args.indexOf('--promise');
  const promiseId = promiseIdx >= 0 ? args[promiseIdx + 1] : undefined;
  cmdProve(target, { json: jsonFlag, promise: promiseId }).catch((e) => {
    console.error(String(e)); process.exit(1);
  });
} else if (cmd === 'guard') {
  const targets: string[] = [];
  const install = args.includes('--install');
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) { targets.push(args[i + 1]!); i++; }
  }
  cmdGuard({ targets, install }).catch((e) => {
    console.error(String(e)); process.exit(1);
  });
} else {
  console.error('Usage: fineprint <validate|prove|guard> ...');
  process.exit(1);
}
