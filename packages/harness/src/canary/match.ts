import type { Matched } from '@fineprint/core';
import { canaryVariants } from './variants.ts';

export function findCanaries(
  haystack: string | Uint8Array,
  fields: { field: string; value: string }[],
): Matched[] {
  const text: string =
    haystack instanceof Uint8Array
      ? new TextDecoder('utf-8').decode(haystack)
      : haystack;

  const seen = new Set<string>();
  const results: Matched[] = [];

  for (const { field, value } of fields) {
    const variants = canaryVariants(field, value);
    for (const { form, text: needle } of variants) {
      const key = `${field}:${form}`;
      if (seen.has(key)) continue;
      if (text.includes(needle)) {
        seen.add(key);
        results.push({ field, form });
      }
    }
  }

  return results;
}
