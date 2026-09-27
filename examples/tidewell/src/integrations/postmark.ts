import type { Settings } from '../settings.ts';

// Transactional email through Postmark. We send account emails only: the
// welcome message and, later, appointment confirmations.
export async function sendWelcomeEmail(
  settings: Settings,
  to: string,
  name: string,
): Promise<void> {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': settings.postmark.serverToken,
    },
    body: JSON.stringify({
      From: settings.postmark.from,
      To: to,
      Subject: 'Welcome to Tidewell',
      TextBody:
        `Hi ${name},\n\nThanks for creating a Tidewell account. ` +
        `You can now book physio and GP appointments near you.\n\nThe Tidewell team`,
    }),
  });
  if (!res.ok) throw new Error(`Postmark responded ${res.status}`);
}
