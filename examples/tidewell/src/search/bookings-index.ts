import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';

const BookingDocSchema = z.object({
  appointmentId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  clinic: z.string(),
  reason: z.string(),
  startsAt: z.string(),
});

const IndexFileSchema = z.object({ docs: z.array(BookingDocSchema) });

export type BookingDoc = z.infer<typeof BookingDocSchema>;

export type BookingsIndex = {
  add(doc: BookingDoc): void;
  search(userId: string, query: string): BookingDoc[];
};

// Bookings search index, so patients can search their own bookings by clinic,
// reason or date. It is a single JSON file next to the database.
export function createBookingsIndex(file: string): BookingsIndex {
  const load = (): BookingDoc[] => {
    if (!existsSync(file)) return [];
    const parsed = IndexFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data.docs : [];
  };

  const save = (docs: BookingDoc[]) => {
    writeFileSync(file, `${JSON.stringify({ docs }, null, 2)}\n`);
  };

  return {
    add(doc) {
      const docs = load().filter((existing) => existing.appointmentId !== doc.appointmentId);
      docs.push(doc);
      save(docs);
    },
    search(userId, query) {
      const needle = query.trim().toLowerCase();
      return load()
        .filter((doc) => doc.userId === userId)
        .filter((doc) => needle === '' || matches(doc, needle))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    },
  };
}

function matches(doc: BookingDoc, needle: string): boolean {
  return [doc.clinic, doc.reason, doc.startsAt.slice(0, 10)].some((field) =>
    field.toLowerCase().includes(needle),
  );
}
