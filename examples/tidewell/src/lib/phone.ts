// Phone numbers are stored in E.164 form (+447700900123) so that SMS delivery
// works the same way whichever format the patient typed.
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/[\s().-]/g, '');

  let normalised: string;
  if (digits.startsWith('+')) normalised = digits;
  else if (digits.startsWith('00')) normalised = `+${digits.slice(2)}`;
  else if (digits.startsWith('0')) normalised = `+44${digits.slice(1)}`;
  else if (digits.startsWith('44')) normalised = `+${digits}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(normalised) ? normalised : null;
}
