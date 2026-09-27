import { useEffect, useState } from 'react';

export type Verdict = 'kept' | 'broken' | 'needs_review' | 'couldnt_check' | 'pending';

export type Evidence =
  | { kind: 'egress'; method: string; host: string; path: string; matched: { field: string; form: string }; callSite?: string }
  | { kind: 'residue'; storeId: string; location: string; matched: { field: string; form: string } }
  | { kind: 'cookie'; name: string; attributes: string }
  | { kind: 'note'; text: string };

export interface LedgerEntry {
  promiseId: string;
  section: string;
  quote: string;
  category: string;
  verdict: Verdict;
  reason: string;
  evidence: Evidence[];
  proofPath?: string;
  durationMs?: number;
}

export interface Ledger {
  policy: { title: string; effectiveDate?: string; sourcePath: string };
  run: { id: string; startedAt: string; durationMs: number; commit?: string; counts: Record<Verdict, number> };
  entries: LedgerEntry[];
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  kept: 'Kept',
  broken: 'Broken',
  needs_review: 'Needs review',
  couldnt_check: "Couldn't check",
  pending: 'Checking',
};

const params = new URLSearchParams(window.location.search);
export const TARGET = params.get('target') ?? 'tidewell';
export const LIVE = params.has('live');
const base = LIVE ? `/live/${TARGET}` : `${import.meta.env.BASE_URL}data/${TARGET}`;

export interface LoadState {
  policy?: string;
  ledger?: Ledger;
  error?: string;
}

async function fetchText(url: string): Promise<string | undefined> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

// Loads the policy once and the ledger repeatedly in live mode, so verdicts flip on screen.
export function useLedger(which: 'before' | 'after' = 'after'): LoadState {
  const [state, setState] = useState<LoadState>({});
  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const ledgerUrl = LIVE ? `${base}/ledger.json` : `${base}/ledger-${which}.json`;
        const [policy, ledgerText] = await Promise.all([fetchText(`${base}/policy.md`), fetchText(ledgerUrl)]);
        if (stopped) return;
        if (!policy) { setState({ error: `No policy found for "${TARGET}".` }); return; }
        let ledger: Ledger | undefined;
        if (ledgerText) {
          try { ledger = JSON.parse(ledgerText) as Ledger; } catch { setState({ policy, error: 'ledger.json is not valid JSON.' }); return; }
        }
        setState(ledger ? { policy, ledger } : { policy });
      } catch (err) {
        if (!stopped) setState((s) => ({ ...s, error: String(err) }));
      }
    };
    void load();
    const timer = LIVE ? window.setInterval(load, 1000) : undefined;
    return () => { stopped = true; if (timer) window.clearInterval(timer); };
  }, [which]);
  return state;
}

export function normalize(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '').toLowerCase();
}
