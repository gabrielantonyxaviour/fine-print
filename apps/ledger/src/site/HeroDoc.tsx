import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

// A policy page that fact-checks itself: sentences are "checked" one by one and flip red or green.
const LINES: { text: string; verdict: 'kept' | 'broken'; section: string }[] = [
  { section: '3.1', text: 'We email you offers only if you opt in.', verdict: 'kept' },
  { section: '3.2', text: 'Your phone number is used only for two-step sign-in.', verdict: 'broken' },
  { section: '4.1', text: 'We never share your health information with advertisers.', verdict: 'broken' },
  { section: '4.2', text: 'We never share your email address with advertisers.', verdict: 'kept' },
  { section: '5.1', text: 'We never store or log your password in readable form.', verdict: 'broken' },
  { section: '5.2', text: 'We never store your full card number.', verdict: 'kept' },
  { section: '6.1', text: 'Deleted accounts are erased within 30 days.', verdict: 'broken' },
];

export function HeroDoc() {
  const [checked, setChecked] = useState(0);
  const [fixed, setFixed] = useState(false);

  useEffect(() => {
    // Check each line, hold on the result, "fix" everything, then loop.
    if (checked < LINES.length) {
      const t = window.setTimeout(() => setChecked((c) => c + 1), 650);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      if (!fixed) setFixed(true);
      else { setFixed(false); setChecked(0); }
    }, fixed ? 2600 : 2200);
    return () => window.clearTimeout(t);
  }, [checked, fixed]);

  const broken = LINES.slice(0, checked).filter((l) => l.verdict === 'broken' && !fixed).length;

  return (
    <div className="hero-doc" aria-hidden="true">
      <div className="doc-chrome">
        <span className="dot" /><span className="dot" /><span className="dot" />
        <span className="doc-file">privacy-policy.pdf</span>
        <span className={`doc-score ${broken ? 'bad' : 'good'}`}>
          {checked < LINES.length ? `checking ${checked}/${LINES.length}` : broken ? `${broken} promises broken` : 'every promise kept'}
        </span>
      </div>
      <div className="doc-body">
        {LINES.map((line, i) => {
          const state = i >= checked ? (i === checked ? 'scan' : 'idle') : fixed ? 'kept' : line.verdict;
          return (
            <motion.div
              key={line.section}
              className={`doc-line s-${state}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
            >
              <span className="doc-sec">§{line.section}</span>
              <span className="doc-text">{line.text}</span>
              <span className="doc-tag">{state === 'kept' ? '✓ kept' : state === 'broken' ? '✕ broken' : state === 'scan' ? 'proving…' : ''}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
