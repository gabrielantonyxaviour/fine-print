import { describe, it, expect } from 'vitest';
import { formatBreach } from '../src/breach.ts';
import type { LedgerEntry } from '../src/schema.ts';

const baseEntry: LedgerEntry = {
  promiseId: 'p-4-2-email-no-ads',
  section: '4.2',
  quote: 'We never share your email address with advertisers.',
  category: 'sharing',
  verdict: 'broken',
  reason: 'Email sent to Facebook pixel',
  evidence: [],
};

describe('formatBreach', () => {
  it('egress entry with callSite matches exact spec example', () => {
    const entry: LedgerEntry = {
      ...baseEntry,
      evidence: [
        {
          kind: 'egress',
          method: 'POST',
          host: 'graph.facebook.com',
          path: '/tr',
          matched: { field: 'email', form: 'sha256' },
          callSite: 'src/analytics/pixel.ts:12',
        },
      ],
      proofPath: 'fineprint/proofs/p-4-2-email-no-ads.proof.test.ts',
    };
    const expected = [
      '✖ Breaks §4.2 "We never share your email address with advertisers."',
      '  sha256(email) → POST graph.facebook.com/tr (src/analytics/pixel.ts:12)',
      '  proof: fineprint/proofs/p-4-2-email-no-ads.proof.test.ts',
    ].join('\n');
    expect(formatBreach(entry)).toBe(expected);
  });

  it('residue entry', () => {
    const entry: LedgerEntry = {
      ...baseEntry,
      evidence: [
        {
          kind: 'residue',
          storeId: 'main-db',
          location: 'users.email_hash',
          matched: { field: 'email', form: 'sha256' },
        },
      ],
      proofPath: 'fineprint/proofs/p-4-2-email-no-ads.proof.test.ts',
    };
    const result = formatBreach(entry);
    expect(result).toContain('sha256(email) left in main-db at users.email_hash');
  });

  it('raw form entry omits form wrapper', () => {
    const entry: LedgerEntry = {
      ...baseEntry,
      evidence: [
        {
          kind: 'egress',
          method: 'GET',
          host: 'api.example.com',
          path: '/track',
          matched: { field: 'userId', form: 'raw' },
          callSite: 'src/tracker.ts:5',
        },
      ],
      proofPath: 'fineprint/proofs/p-1-test.proof.test.ts',
    };
    const result = formatBreach(entry);
    expect(result).toContain('userId → GET api.example.com/track (src/tracker.ts:5)');
  });

  it('entry without proofPath omits proof line', () => {
    const entry: LedgerEntry = {
      ...baseEntry,
      evidence: [
        {
          kind: 'note',
          text: 'Manual review required',
        },
      ],
    };
    const result = formatBreach(entry);
    expect(result).not.toContain('proof:');
    expect(result).toContain('Manual review required');
  });
});
