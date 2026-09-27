import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';

// Real output of the Fine Print guard on Tidewell after a leaky analytics pixel was added.
const SCRIPT: { t: string; c?: string; wait?: number }[] = [
  { t: '$ git commit -m "Add signup conversion pixel"', c: 'cmd', wait: 700 },
  { t: 'Fine Print: running the promise proofs…', c: 'dim', wait: 900 },
  { t: '✖ Breaks §4.2 "We never share your email address with advertisers."', c: 'bad', wait: 250 },
  { t: '  sha256(email) → POST graph.facebook.com/tr (src/analytics/pixel.ts:11)', c: 'ev', wait: 350 },
  { t: '✖ Breaks §4.3 "We share personal data only with the service providers listed in section 7."', c: 'bad', wait: 250 },
  { t: '  sha256(email) → POST graph.facebook.com/tr (src/analytics/pixel.ts:11)', c: 'ev', wait: 450 },
  { t: 'Blocked by Fine Print: this commit breaks a privacy promise.', c: 'bad', wait: 0 },
];

export function Guard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView || shown >= SCRIPT.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), SCRIPT[Math.max(0, shown - 1)]?.wait ?? 500);
    return () => window.clearTimeout(t);
  }, [inView, shown]);

  return (
    <section className="section guard" id="guard">
      <div className="guard-copy">
        <p className="eyebrow">Govern</p>
        <h2 className="h2">Once kept, it stays kept.</h2>
        <p className="lede">A git hook, a CI check and a Bob hook refuse any change that breaks a promise, quoting the exact sentence. No AI in the loop.</p>
      </div>
      <motion.div ref={ref} className="term" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="term-bar"><span className="dot" /><span className="dot" /><span className="dot" /><span>tidewell · zsh</span></div>
        <pre>
          {SCRIPT.slice(0, shown).map((l, i) => <div key={i} className={`t-${l.c ?? ''}`}>{l.t}</div>)}
          {shown < SCRIPT.length && <span className="caret">▍</span>}
        </pre>
      </motion.div>
    </section>
  );
}
