import type { Category, LedgerEntry, Verdict } from './schema.ts';

export interface AggregateVerdictInput {
  state: 'passed' | 'failed' | 'errored' | 'skipped' | 'missing';
  errorName?: string;
  category: Category;
}

export function aggregateVerdict(o: AggregateVerdictInput): Verdict {
  // Rule 1
  if (o.category === 'human_review') return 'needs_review';
  // Rule 2
  if (o.state === 'missing') return 'couldnt_check';
  if (o.state === 'skipped') return 'pending';
  // Rule 3
  if (o.state === 'errored') return 'couldnt_check';
  // Rule 4
  if (o.state === 'failed' && o.errorName === 'FinePrintBreach') return 'broken';
  // Rule 5
  if (o.state === 'failed') return 'couldnt_check';
  // Rule 6
  return 'kept';
}

export function countVerdicts(entries: LedgerEntry[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    kept: 0,
    broken: 0,
    needs_review: 0,
    couldnt_check: 0,
    pending: 0,
  };
  for (const entry of entries) {
    counts[entry.verdict]++;
  }
  return counts;
}
