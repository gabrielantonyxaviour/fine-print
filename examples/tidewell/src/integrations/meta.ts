import { sha256Hex } from '../lib/hash.ts';
import type { Settings } from '../settings.ts';

const GRAPH_VERSION = 'v19.0';

export type ScheduleEvent = {
  userId: string;
  clinicId: string;
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
          custom_data: { clinic_id: event.clinicId },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Meta Conversions API responded ${res.status}`);
}

