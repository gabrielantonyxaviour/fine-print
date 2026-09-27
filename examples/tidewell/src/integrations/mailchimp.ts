import type { Settings } from '../settings.ts';

// Mailchimp holds our newsletter audience. We add a member for each patient who
// has opted in to news and offers.
export async function subscribeMember(settings: Settings, email: string): Promise<void> {
  const { listId, apiKey } = settings.mailchimp;
  const dc = apiKey.split('-')[1] ?? 'us21';
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`;
  const basic = Buffer.from(`anystring:${apiKey}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basic}`,
    },
    body: JSON.stringify({ email_address: email, status: 'subscribed' }),
  });
  if (!res.ok) throw new Error(`Mailchimp responded ${res.status}`);
}
