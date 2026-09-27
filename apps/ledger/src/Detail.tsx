import { useEffect } from 'react';
import { VERDICT_LABEL, TARGET, type Evidence, type LedgerEntry } from './data.ts';
import { CASE_BY_SECTION } from './site/cases.ts';

const REPO = 'https://github.com/gabrielantonyxaviour/fine-print/blob/main';

function what(ev: { matched: { field: string; form: string } }): string {
  const field = ev.matched.field === 'pw' ? 'password' : ev.matched.field;
  return ev.matched.form === 'raw' ? field : `${ev.matched.form}(${field})`;
}

function EvidenceRow({ ev }: { ev: Evidence }) {
  if (ev.kind === 'egress') {
    return (
      <li>
        <code className="what">{what(ev)}</code> sent to <strong>{ev.host}</strong>
        <div className="sub"><code>{ev.method} {ev.path.length > 90 ? `${ev.path.slice(0, 90)}…` : ev.path}</code></div>
        {ev.callSite && (
          <div className="sub">from <a href={`${REPO}/examples/${TARGET}/${ev.callSite.replace(/:(\d+)$/, '#L$1')}`} target="_blank" rel="noreferrer"><code>{ev.callSite}</code></a></div>
        )}
      </li>
    );
  }
  if (ev.kind === 'residue') {
    return <li><code className="what">{what(ev)}</code> still in <strong>{ev.storeId}</strong><div className="sub"><code>{ev.location}</code></div></li>;
  }
  if (ev.kind === 'cookie') return <li>Cookie <strong>{ev.name}</strong> set<div className="sub"><code>{ev.attributes}</code></div></li>;
  return <li>{ev.text}</li>;
}

export function Detail({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <aside className="detail" role="dialog" aria-label={`Promise ${entry.section}`}>
      <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
      <div className={`pill v-${entry.verdict}`}>{VERDICT_LABEL[entry.verdict]}</div>
      <p className="eyebrow">Section {entry.section} · {entry.category.replace(/_/g, ' ')}</p>
      <blockquote>“{entry.quote}”</blockquote>
      {entry.verdict === 'broken' && CASE_BY_SECTION[entry.section] && <p className="realcase">{CASE_BY_SECTION[entry.section]}</p>}
      <h4>What the proof found</h4>
      <p className="reason">{entry.reason}</p>
      {entry.evidence.length > 0 && (<><h4>Evidence</h4><ul className="evidence">{entry.evidence.map((ev, i) => <EvidenceRow key={i} ev={ev} />)}</ul></>)}
      {entry.proofPath && (
        <>
          <h4>Proof</h4>
          <p><code>{entry.proofPath}</code></p>
          <p className="sub">Rerun: <code>pnpm fineprint prove examples/{TARGET} --promise {entry.promiseId}</code></p>
        </>
      )}
    </aside>
  );
}
