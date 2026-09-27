import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Nav } from './Nav.tsx';

const REPO = 'https://github.com/gabrielantonyxaviour/fine-print';

const ROWS: [string, string, string, string][] = [
  ['3.1', 'Email offers only with opt-in', 'kept', 'kept'],
  ['3.2', 'Phone used only for two-step sign-in', 'broken', 'kept'],
  ['4.1', 'Health info never shared with advertisers', 'broken', 'kept'],
  ['4.2', 'Email never shared with advertisers', 'kept', 'kept'],
  ['4.3', 'Data shared only with listed providers', 'broken', 'kept'],
  ['5.1', 'Password never stored or logged readably', 'broken', 'kept'],
  ['5.2', 'Full card number never stored', 'kept', 'kept'],
  ['5.3', 'No advertising or tracking cookies', 'kept', 'kept'],
  ['6.1', 'Deleted accounts erased within 30 days', 'broken', 'kept'],
];

interface RealTarget { target: { repo: string; commit: string }; findings?: { promise: string; result: string }[]; mutants: { id: string; description: string; caught: boolean }[] }

const up = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

export function Eval() {
  const [real, setReal] = useState<RealTarget | undefined>();
  useEffect(() => {
    fetch('/data/eval/results.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : undefined)).then(setReal).catch(() => undefined);
  }, []);
  const caught = real ? real.mutants.filter((m) => m.caught).length : 0;

  return (
    <div className="site">
      <Nav />
      <main className="page">
        <motion.p className="eyebrow" {...up}>Evaluation</motion.p>
        <motion.h1 className="page-h" {...up}>How we know it works.</motion.h1>

        <motion.section className="card" {...up}>
          <h2>1 · Graded against a hidden answer key</h2>
          <p className="muted">Tidewell's expected verdicts were written before the audit and hidden from Bob with <code>.bobignore</code>.</p>
          <table className="grade">
            <thead><tr><th>§</th><th>Promise</th><th>Bob's audit</th><th>After Bob's fix</th></tr></thead>
            <tbody>
              {ROWS.map(([s, p, b, a]) => (
                <tr key={s}><td>{s}</td><td>{p}</td><td><span className={`chip2 v-${b}`}>{b}</span></td><td><span className={`chip2 v-${a}`}>{a}</span></td></tr>
              ))}
            </tbody>
          </table>
          <p className="note">9/9 match the key before and after the fix. §4.3 was re-audited once. The original proof wrongly allowed Meta; the full account is in <a href={`${REPO}/blob/main/examples/tidewell/fineprint/AUDIT-NOTES.md`}>AUDIT-NOTES.md</a>.</p>
        </motion.section>

        <motion.section className="card" {...up}>
          <h2>2 · Every proof must be able to fail</h2>
          <p className="muted">For each kept promise, we break it on purpose with a small patch and rerun the proofs. The matching proof must turn red, and only that one.</p>
          <div className="big">4 / 4</div>
          <p className="note">Patches: newsletter ignores opt-in · analytics pixel sends hashed email · full card number stored · tracking cookie set.</p>
        </motion.section>

        <motion.section className="card" {...up}>
          <h2>3 · The fixer can't cheat</h2>
          <p className="muted">After the audit, proofs are frozen. Bob's Engineer mode may edit anything except proofs, and a hook blocks edits from any mode.</p>
          <div className="big">0 lines</div>
          <p className="note">of proof code changed by the fix. The git diff against the audit baseline is empty.</p>
        </motion.section>

        {real && (
          <motion.section className="card" {...up}>
            <h2>4 · Real open-source code</h2>
            <p className="muted"><a href={`https://github.com/${real.target.repo}/tree/${real.target.commit}`}>{real.target.repo}</a> at <code>{real.target.commit.slice(0, 7)}</code>, audited against its own public privacy page.</p>
            <div className="big">{caught} / {real.mutants.length}</div>
            <p className="note">planted privacy violations caught.</p>
            {real.findings && real.findings.length > 0 && (
              <ul className="findings">{real.findings.map((f) => <li key={f.promise}><b>{f.promise}</b> {f.result}</li>)}</ul>
            )}
          </motion.section>
        )}
      </main>
    </div>
  );
}
