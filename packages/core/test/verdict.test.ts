import { describe, it, expect } from 'vitest';
import { aggregateVerdict, countVerdicts } from '../src/verdict.ts';
import type { LedgerEntry } from '../src/schema.ts';

describe('aggregateVerdict', () => {
  it('Rule 1: human_review category always returns needs_review regardless of state', () => {
    expect(aggregateVerdict({ state: 'passed', category: 'human_review' })).toBe('needs_review');
    expect(aggregateVerdict({ state: 'failed', errorName: 'FinePrintBreach', category: 'human_review' })).toBe('needs_review');
    expect(aggregateVerdict({ state: 'errored', category: 'human_review' })).toBe('needs_review');
  });

  it('Rule 2a: missing state → couldnt_check', () => {
    expect(aggregateVerdict({ state: 'missing', category: 'sharing' })).toBe('couldnt_check');
  });

  it('Rule 2b: skipped state → pending', () => {
    expect(aggregateVerdict({ state: 'skipped', category: 'sharing' })).toBe('pending');
  });

  it('Rule 3: errored state → couldnt_check', () => {
    expect(aggregateVerdict({ state: 'errored', category: 'sharing' })).toBe('couldnt_check');
  });

  it('Rule 4: failed with FinePrintBreach → broken', () => {
    expect(
      aggregateVerdict({ state: 'failed', errorName: 'FinePrintBreach', category: 'sharing' }),
    ).toBe('broken');
  });

  it('Rule 5: failed with other error → couldnt_check', () => {
    expect(
      aggregateVerdict({ state: 'failed', errorName: 'FinePrintControlFailure', category: 'sharing' }),
    ).toBe('couldnt_check');
  });

  it('Rule 5: failed with no errorName → couldnt_check', () => {
    expect(aggregateVerdict({ state: 'failed', category: 'sharing' })).toBe('couldnt_check');
  });

  it('Rule 6: passed → kept', () => {
    expect(aggregateVerdict({ state: 'passed', category: 'sharing' })).toBe('kept');
  });
});

describe('countVerdicts', () => {
  it('returns all five keys when no entries', () => {
    const counts = countVerdicts([]);
    expect(counts).toEqual({
      kept: 0,
      broken: 0,
      needs_review: 0,
      couldnt_check: 0,
      pending: 0,
    });
  });

  it('counts correctly from entries', () => {
    const makeEntry = (verdict: LedgerEntry['verdict']): LedgerEntry => ({
      promiseId: 'p-1-test',
      section: '1',
      quote: 'a'.repeat(10),
      category: 'sharing',
      verdict,
      reason: 'test',
      evidence: [],
    });
    const entries: LedgerEntry[] = [
      makeEntry('kept'),
      makeEntry('kept'),
      makeEntry('broken'),
      makeEntry('needs_review'),
      makeEntry('couldnt_check'),
    ];
    const counts = countVerdicts(entries);
    expect(counts).toEqual({
      kept: 2,
      broken: 1,
      needs_review: 1,
      couldnt_check: 1,
      pending: 0,
    });
  });
});
