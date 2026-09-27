import { motion } from 'motion/react';

const STEPS = [
  { k: 'Plan', mode: 'Fine Print Auditor', line: 'Bob reads your policy PDF and extracts every testable promise.' },
  { k: 'Execute', mode: 'parallel subagents', line: 'One subagent per promise traces the data and writes a proof.' },
  { k: 'Validate', mode: 'fineprint prove', line: 'Proofs really run. Every request captured, every store scanned.' },
  { k: 'Govern', mode: 'Fine Print Engineer + hooks', line: 'Bob fixes the code. Proofs are locked. Commits that break a promise are refused.' },
];

// The Execute step as a picture: one agent fanning out into parallel tracers.
function FanOut() {
  const ys = [30, 70, 110, 150, 190];
  return (
    <svg className="fan" viewBox="0 0 320 220" role="img" aria-label="One Bob agent fanning out into parallel subagents">
      <circle cx="40" cy="110" r="16" className="fan-root" />
      {ys.map((y, i) => (
        <g key={y}>
          <motion.path
            d={`M56 110 C 130 110, 150 ${y}, 220 ${y}`}
            className="fan-path"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.2 + i * 0.12 }}
          />
          <motion.circle
            cx="232" cy={y} r="9"
            className={i % 2 ? 'fan-kept' : 'fan-broken'}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1 + i * 0.12, type: 'spring' }}
          />
          <motion.rect
            x="250" y={y - 4} height="8" rx="4" width="54"
            className="fan-bar"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            style={{ originX: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.2 + i * 0.12 }}
          />
        </g>
      ))}
    </svg>
  );
}

export function Flow() {
  return (
    <section className="section" id="how">
      <p className="eyebrow">Runs inside <span className="ibm">IBM Bob</span></p>
      <h2 className="h2">Plan. Execute. Validate. Govern.</h2>
      <div className="flow">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.k}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12 }}
            >
              <span className="step-n">0{i + 1}</span>
              <div>
                <h3>{s.k} <code>{s.mode}</code></h3>
                <p>{s.line}</p>
              </div>
            </motion.li>
          ))}
        </ol>
        <div className="flow-art">
          <FanOut />
          <img src="/img/web-agents.png" alt="" className="flow-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      </div>
    </section>
  );
}
