import { createHash } from 'node:crypto';

export interface Variant {
  form: string;
  text: string;
}

function hex(h: ReturnType<typeof createHash>): string {
  return h.digest('hex');
}

function hashVariants(field: string, value: string): Variant[] {
  // For email: trim+lowercase; for phone: E.164 value
  const normalized = field === 'email' ? value.trim().toLowerCase() : value;
  const buf = Buffer.from(normalized, 'utf8');
  const variants: Variant[] = [];
  for (const algo of ['sha256', 'sha1', 'md5'] as const) {
    const lower = createHash(algo).update(buf).digest('hex');
    const upper = lower.toUpperCase();
    variants.push({ form: algo, text: lower });
    variants.push({ form: `${algo}_upper`, text: upper });
  }
  return variants;
}

export function canaryVariants(field: string, value: string): Variant[] {
  const raw = value;
  const lower = value.toLowerCase();
  const urlencoded = encodeURIComponent(value);
  const form = value.replace(/ /g, '+');
  // JSON-escaped, no surrounding quotes
  const json = JSON.stringify(value).slice(1, -1);
  const base64 = Buffer.from(value, 'utf8').toString('base64');
  const base64url = Buffer.from(value, 'utf8').toString('base64url');

  const variants: Variant[] = [
    { form: 'raw', text: raw },
    { form: 'lower', text: lower },
    { form: 'urlencoded', text: urlencoded },
    { form: 'form', text: form },
    { form: 'json', text: json },
    { form: 'base64', text: base64 },
    { form: 'base64url', text: base64url },
    ...hashVariants(field, value),
  ];

  if (field === 'phone') {
    // E.164: value as-is (e.g. +447700900123)
    const e164 = value;
    // digits: strip leading +
    const digits = value.replace(/^\+/, '');
    // national: replace leading +44 with 0
    const national = value.replace(/^\+44/, '0');
    // spaced: +44 7700 900123
    const spaced = value.replace(/^\+44(\d{4})(\d{6})$/, '+44 $1 $2');
    // sha256 of digits
    const sha256digits = createHash('sha256').update(digits, 'utf8').digest('hex');

    variants.push({ form: 'e164', text: e164 });
    variants.push({ form: 'digits', text: digits });
    variants.push({ form: 'national', text: national });
    variants.push({ form: 'spaced', text: spaced });
    variants.push({ form: 'sha256_digits', text: sha256digits });
  }

  // Drop variants shorter than 8 chars, de-duplicate by text
  const seen = new Set<string>();
  const result: Variant[] = [];
  for (const v of variants) {
    if (v.text.length < 8) continue;
    if (seen.has(v.text)) continue;
    seen.add(v.text);
    result.push(v);
  }
  return result;
}
