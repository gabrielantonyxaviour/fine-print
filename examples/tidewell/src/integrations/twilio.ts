import type { Settings } from '../settings.ts';

// Twilio sends the six-digit two-step verification code by SMS. This is the
// only thing we use the patient's phone number for at sign-in.
export async function sendVerificationSms(
  settings: Settings,
  toPhone: string,
  code: string,
): Promise<void> {
  const { accountSid, authToken, from } = settings.twilio;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: toPhone,
    From: from,
    Body: `Your Tidewell code is ${code}`,
  });
  const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
}
