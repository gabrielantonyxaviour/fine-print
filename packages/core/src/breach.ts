import type { Evidence, LedgerEntry } from './schema.ts';

function formatField(field: string, form: string): string {
  if (form === 'raw') return field;
  return `${form}(${field})`;
}

function formatEvidenceLine(ev: Evidence): string {
  if (ev.kind === 'egress') {
    const subject = formatField(ev.matched.field, ev.matched.form);
    const dest = `${ev.method} ${ev.host}${ev.path}`;
    const site = ev.callSite ? ` (${ev.callSite})` : '';
    return `  ${subject} → ${dest}${site}`;
  }
  if (ev.kind === 'residue') {
    const subject = formatField(ev.matched.field, ev.matched.form);
    return `  ${subject} left in ${ev.storeId} at ${ev.location}`;
  }
  if (ev.kind === 'cookie') {
    return `  cookie ${ev.name} set: ${ev.attributes}`;
  }
  // note
  return `  ${ev.text}`;
}

export function formatBreach(entry: LedgerEntry): string {
  const header = `✖ Breaks §${entry.section} "${entry.quote}"`;
  const evidenceLines = entry.evidence.map(formatEvidenceLine).join('\n');
  const lines = [header, evidenceLines];
  if (entry.proofPath) {
    lines.push(`  proof: ${entry.proofPath}`);
  }
  return lines.filter((l) => l !== '').join('\n');
}
