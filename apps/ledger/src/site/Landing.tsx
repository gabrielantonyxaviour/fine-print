import { motion, useInView, animate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CASES } from './cases.ts';
import { Flow } from './Flow.tsx';
import { Guard } from './Guard.tsx';
import { HeroDoc } from './HeroDoc.tsx';
import { Nav } from './Nav.tsx';

const REPO = 'https://github.com/gabrielantonyxaviour/fine-print';

function Count({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.2, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v}{suffix}</span>;
}

const up = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' } };

export function Landing() {
  return (
    <div className="site">
      <Nav />
      <header className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <motion.p className="eyebrow" {...up}>Built with <span className="ibm">IBM Bob</span></motion.p>
          <motion.h1 {...up} transition={{ delay: 0.05 }}>Your privacy policy, <em>fact-checked</em> against your code.</motion.h1>
          <motion.p className="lede" {...up} transition={{ delay: 0.12 }}>Fine Print turns every promise in your policy into a proof that runs, then keeps your code honest on every commit.</motion.p>
          <motion.div className="ctas" {...up} transition={{ delay: 0.2 }}>
            <a className="btn primary" href="/demo">See a real run</a>
            <a className="btn" href={REPO}>Install from GitHub</a>
          </motion.div>
        </div>
        <motion.div className="hero-art" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
          <img src="/img/web-hero.png" alt="" className="hero-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <HeroDoc />
        </motion.div>
      </header>

      <section className="section cases">
        <motion.h2 className="h2 center" {...up}>They all had a privacy policy.<br /><span className="muted">Their code didn't read it.</span></motion.h2>
        <div className="case-grid">
          {CASES.map((c, i) => (
            <motion.a key={c.company} className="case" href={c.source} target="_blank" rel="noreferrer" {...up} transition={{ delay: i * 0.08 }}>
              <span className="case-amt">{c.amount}</span>
              <span className="case-co">{c.company} · {c.year}</span>
              <span className="case-what">{c.what}</span>
            </motion.a>
          ))}
        </div>
      </section>

      <Flow />

      <section className="section proof">
        <motion.h2 className="h2 center" {...up}>Proof, not opinion.</motion.h2>
        <div className="stats">
          <motion.div className="stat" {...up}><b><Count to={9} />/9</b><span>promises graded correctly against a hidden answer key</span></motion.div>
          <motion.div className="stat" {...up} transition={{ delay: 0.08 }}><b><Count to={5} /></b><span>broken promises found and fixed by Bob</span></motion.div>
          <motion.div className="stat" {...up} transition={{ delay: 0.16 }}><b><Count to={4} />/4</b><span>kept proofs fail when their promise is broken</span></motion.div>
          <motion.div className="stat" {...up} transition={{ delay: 0.24 }}><b><Count to={0} /></b><span>proofs edited by the fixer: they're locked</span></motion.div>
        </div>
        <motion.div className="center" {...up}><a className="btn" href="/eval">How we measured it</a></motion.div>
      </section>

      <Guard />

      <section className="section install" id="install">
        <motion.div {...up}>
          <p className="eyebrow">Your repo, your policy</p>
          <h2 className="h2">Three steps. No account.</h2>
        </motion.div>
        <motion.ol className="install-steps" {...up} transition={{ delay: 0.1 }}>
          <li><span>Copy the mode pack</span><code>cp -r fine-print/.bob your-repo/</code></li>
          <li><span>Ask Bob, in Fine Print Auditor mode</span><code>Fact-check @privacy-policy.pdf against this repo.</code></li>
          <li><span>Lock it in</span><code>pnpm fineprint guard --install</code></li>
        </motion.ol>
      </section>

      <footer className="foot2">
        <span><span className="mark">¶</span> Fine Print · Team Zen · IBM Bob 2.0 Hackathon</span>
        <span><a href="/demo">Demo</a> · <a href="/eval">Evaluation</a> · <a href={REPO}>GitHub</a></span>
      </footer>
    </div>
  );
}
