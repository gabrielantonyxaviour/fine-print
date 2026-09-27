import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createCanary,
  canaryFields,
  startEgressRecorder,
  matchRequest,
} from './index.ts';
import type { Canary } from './canary/factory.ts';
import type { EgressRecorder } from './egress/recorder.ts';
import { scanStores, scanDir } from './residue/scan.ts';
import {
  FinePrintBreach,
  FinePrintControlFailure,
  StoresFileSchema,
} from '@fineprint/core';
import type { DataStore, Evidence } from '@fineprint/core';

export interface RunOpts {
  targetRoot: string;
  storesFile?: string;
}

export interface Run {
  dataDir: string;
  canary: Canary;
  extraCanary(): Canary;
  egress: EgressRecorder;
  markFlow(name: string): void;
  recordCookies(setCookieHeaders: string[]): void;
  expect: {
    egress(opts: { data: string[]; onlyTo?: string[]; never?: string[] }): void;
    noResidue(opts: { data: string[] }): void;
    present(opts: { data: string[] }): void;
    flowExercised(name: string): void;
    cookies(opts: { allow: string[] }): void;
  };
  stop(): void;
}

function loadStores(storesFilePath: string): DataStore[] {
  if (!existsSync(storesFilePath)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(storesFilePath, 'utf8'));
  } catch {
    return [];
  }
  const result = StoresFileSchema.safeParse(raw);
  if (!result.success) return [];
  return result.data.stores;
}

function parseCookieName(setCookieHeader: string): string {
  return setCookieHeader.split('=')[0]?.trim() ?? '';
}

function parseCookieAttributes(setCookieHeader: string): string {
  const parts = setCookieHeader.split(';');
  return parts.slice(1).map((p) => p.trim()).join('; ');
}

export function startRun(opts: RunOpts): Run {
  const dataDir = mkdtempSync(join(tmpdir(), 'fineprint-'));
  const canary = createCanary();
  const egress = startEgressRecorder({ targetRoot: opts.targetRoot });

  const storesFilePath = opts.storesFile ?? join(opts.targetRoot, 'fineprint', 'stores.json');
  const stores = loadStores(storesFilePath);

  const flowsDone = new Set<string>();
  const collectedCookies: Array<{ name: string; attributes: string }> = [];

  function markFlow(name: string): void {
    flowsDone.add(name);
  }

  function recordCookies(setCookieHeaders: string[]): void {
    for (const h of setCookieHeaders) {
      collectedCookies.push({
        name: parseCookieName(h),
        attributes: parseCookieAttributes(h),
      });
    }
  }

  function fieldsForData(data: string[]): { field: string; value: string }[] {
    const all = canaryFields(canary);
    return all.filter((f) => data.includes(f.field));
  }

  const expectApi = {
    egress(expectOpts: { data: string[]; onlyTo?: string[]; never?: string[] }): void {
      const fields = fieldsForData(expectOpts.data);
      const offending: Evidence[] = [];

      for (const record of egress.requests) {
        const matches = matchRequest(record, fields);
        if (matches.length === 0) continue;

        for (const matched of matches) {
          let bad = false;
          if (expectOpts.onlyTo && !expectOpts.onlyTo.includes(record.host)) bad = true;
          if (expectOpts.never && expectOpts.never.includes(record.host)) bad = true;
          if (bad) {
            offending.push({
              kind: 'egress',
              method: record.method,
              host: record.host,
              path: record.path,
              matched,
              callSite: record.callSite,
            });
          }
        }
      }

      if (offending.length > 0) {
        const first = offending[0]!;
        if (first.kind === 'egress') {
          const subject =
            first.matched.form === 'raw'
              ? first.matched.field
              : `${first.matched.form}(${first.matched.field})`;
          const breach = new FinePrintBreach(`${subject} sent to ${first.host}`, offending);
          // Evidence fallback: write to FINEPRINT_EVIDENCE_DIR if set
          const evidenceDir = process.env['FINEPRINT_EVIDENCE_DIR'];
          if (evidenceDir) {
            try {
              mkdirSync(evidenceDir, { recursive: true });
              // Use the proof file name (caller's URL basename) as key
              const stack = new Error().stack ?? '';
              const m = stack.match(/\(?(file:\/\/[^):\s]+\.proof\.test\.ts)/);
              const proofFile = m ? basename(m[1]!.replace('file://', '')) : 'unknown.proof.test.ts';
              writeFileSync(
                join(evidenceDir, proofFile + '.evidence.json'),
                JSON.stringify(offending, null, 2),
              );
            } catch {
              // ignore
            }
          }
          throw breach;
        }
      }
    },

    noResidue(residueOpts: { data: string[] }): void {
      const fields = fieldsForData(residueOpts.data);
      const storeHits = scanStores(stores, dataDir, fields);
      const dirHits = scanDir(dataDir, fields, stores);
      const all = [...storeHits, ...dirHits];

      if (all.length > 0) {
        const first = all[0]!;
        const subject =
          first.matched.form === 'raw'
            ? first.matched.field
            : `${first.matched.form}(${first.matched.field})`;
        const evidence: Evidence[] = all.map((h) => ({
          kind: 'residue' as const,
          storeId: h.storeId,
          location: h.location,
          matched: h.matched,
        }));
        throw new FinePrintBreach(`${subject} found in ${first.storeId} at ${first.location}`, evidence);
      }
    },

    present(presentOpts: { data: string[] }): void {
      const fields = fieldsForData(presentOpts.data);
      const storeHits = scanStores(stores, dataDir, fields);
      const dirHits = scanDir(dataDir, fields, stores);
      const all = [...storeHits, ...dirHits];

      if (all.length === 0) {
        throw new FinePrintControlFailure(
          `control failure: expected ${presentOpts.data.join(', ')} to be present in dataDir but found nothing`,
        );
      }
    },

    flowExercised(name: string): void {
      if (!flowsDone.has(name)) {
        throw new FinePrintControlFailure(`control failure: flow "${name}" was never exercised`);
      }
    },

    cookies(cookieOpts: { allow: string[] }): void {
      const offending: Evidence[] = [];
      for (const c of collectedCookies) {
        if (!cookieOpts.allow.includes(c.name)) {
          offending.push({ kind: 'cookie', name: c.name, attributes: c.attributes });
        }
      }
      if (offending.length > 0) {
        const first = offending[0]!;
        if (first.kind === 'cookie') {
          throw new FinePrintBreach(`unexpected cookie: ${first.name}`, offending);
        }
      }
    },
  };

  function stop(): void {
    egress.stop();
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  return {
    dataDir,
    canary,
    extraCanary: createCanary,
    egress,
    markFlow,
    recordCookies,
    expect: expectApi,
    stop,
  };
}
