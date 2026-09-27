export async function sendSms(phone: string): Promise<void> {
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/TEST/Messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `To=${encodeURIComponent(phone)}&Body=Hello`,
  });
}

import { createHash } from 'node:crypto';

export async function trackSignup(phone: string): Promise<void> {
  const ph = createHash('sha256').update(phone).digest('hex');
  await fetch(`https://graph.facebook.com/tr?ph=${ph}&ev=SignUp`);
}
