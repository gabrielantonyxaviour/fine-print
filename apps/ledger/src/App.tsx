import { useCallback, useState } from 'react';
import { LIVE, TARGET, VERDICT_LABEL, useLedger, type LedgerEntry, type Verdict } from './data.ts';
import { Detail } from './Detail.tsx';
import { Policy, unmatched } from './Policy.tsx';

const ORDER: Verdict[] = ['broken', 'kept', 'needs_review', 'couldnt_check', 'pending'];

export function App() {
  const { policy, ledger, error } = useLedger();
  const [open, setOpen] = useState<LedgerEntry | undefined>();
  const [filter, setFilter] = useState<string>('all');
  const close = useCallback(() => setOpen(undefined), []);
  const entries = ledger?.entries ?? [];
  const current = open ? entries.find((e) => e.promiseId === open.promiseId) ?? open : undefined;
  const counts = Object.fromEntries(ORDER.map((v) => [v, entries.filter((e) => e.verdict === v).length])) as Record<Verdict, number>;
  const missing = policy ? unmatched(policy, entries) : [];

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><span className="mark">¶</span> Fine Print</div>
        <div className="meta">
          {ledger ? (
            <>
              <span>{ledger.policy.title}</span>
              <span>checked {new Date(ledger.run.startedAt).toLocaleString()}</span>
              {ledger.run.commit && <span>commit {ledger.run.commit}</span>}
              {LIVE && <span className="live">● live</span>}
            </>
          ) : <span>{TARGET}</span>}
        </div>
      </header>

      {error && <div className="notice error" role="alert">{error}</div>}
      {!error && policy && !ledger && (
        <div className="notice">No proofs have run yet. Run <code>pnpm fineprint prove examples/{TARGET}</code> to fact-check this policy.</div>
      )}

      {ledger && (
        <nav className="summary" aria-label="Filter promises by verdict">
          <button type="button" className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>All {entries.length}</button>
          {ORDER.filter((v) => counts[v] > 0).map((v) => (
            <button type="button" key={v} className={`chip v-${v}${filter === v ? ' on' : ''}`} onClick={() => setFilter(filter === v ? 'all' : v)}>
              {VERDICT_LABEL[v]} {counts[v]}
            </button>
          ))}
        </nav>
      )}

      <main className={`layout${current ? ' with-detail' : ''}`}>
        {policy && <Policy markdown={policy} entries={entries} filter={filter} onOpen={setOpen} />}
        {current && <Detail entry={current} onClose={close} />}
      </main>

      {missing.length > 0 && (
        <section className="notice">
          <strong>Promises not found verbatim in the document:</strong>
          <ul>{missing.map((e) => <li key={e.promiseId}>§{e.section} {e.quote} ({VERDICT_LABEL[e.verdict]})</li>)}</ul>
        </section>
      )}
      <footer className="foot">Every verdict comes from an executed proof, not an AI opinion. Built with IBM Bob.</footer>
    </div>
  );
}
