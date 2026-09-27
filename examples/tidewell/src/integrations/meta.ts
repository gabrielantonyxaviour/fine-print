import { sha256Hex } from '../lib/hash.ts';
import type { Settings } from '../settings.ts';

const GRAPH_VERSION = 'v19.0';

export type ScheduleEvent = {
  userId: string;
  clinicId: string;
  reason: string;
  eventTime: number;
};

// Conversions API: reports a completed booking so we can measure how well our
// ad campaigns turn into appointments. The person is identified only by a
// hashed internal id, never by contact details.
export async function sendScheduleEvent(settings: Settings, event: ScheduleEvent): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.meta.pixelId}/events?access_token=${settings.meta.accessToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        {
          event_name: 'Schedule',
          event_time: event.eventTime,
          action_source: 'website',
          user_data: { external_id: sha256Hex(event.userId) },
          custom_data: { clinic_id: event.clinicId, reason: event.reason },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Meta Conversions API responded ${res.status}`);
}

// Custom Audiences: refreshes a lookalike source so our campaigns can reach
// more patients like the ones we already help. Matching uses a hashed phone
// number, which is how the audience is keyed.
export async function uploadPhoneAudience(settings: Settings, phonesE164: string[]): Promise<void> {
  if (phonesE164.length === 0) return;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${settings.meta.audienceId}/users?access_token=${settings.meta.accessToken}`;
  const data = phonesE164.map((phone) => [sha256Hex(phone)]);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: { schema: ['PHONE_SHA256'], data } }),
  });
  if (!res.ok) throw new Error(`Meta Custom Audiences responded ${res.status}`);
}
