import type { Evidence } from './schema.ts';

export class FinePrintBreach extends Error {
  override name = 'FinePrintBreach';
  evidence: Evidence[];

  constructor(message: string, evidence: Evidence[] = []) {
    super(message);
    this.evidence = evidence;
  }
}

export class FinePrintControlFailure extends Error {
  override name = 'FinePrintControlFailure';

  constructor(message: string) {
    super(message);
  }
}
