// src/ai/flows/sync-to-google-calendar.ts
'use server';

/**
 * @fileOverview A flow for syncing financial entries to Google Calendar.
 * 
 * - syncToGoogleCalendar - A function that takes entries and creates events in Google Calendar.
 * - SyncToGoogleCalendarInput - The input type for the syncToGoogleCalendar function.
 * - SyncToGoogleCalendarOutput - The return type for the syncToGoogleCalendar function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { EntrySchema } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

const SyncToGoogleCalendarInputSchema = z.object({
  entries: z.array(EntrySchema),
  timezone: z.string().describe('The IANA timezone identifier, e.g., "America/New_York".'),
  accessToken: z.string().describe('The OAuth2 access token for the Google Calendar API.'),
});
export type SyncToGoogleCalendarInput = z.infer<typeof SyncToGoogleCalendarInputSchema>;

const SyncToGoogleCalendarOutputSchema = z.object({
  syncedCount: z.number().describe('The number of events successfully synced to the calendar.'),
});
export type SyncToGoogleCalendarOutput = z.infer<typeof SyncToGoogleCalendarOutputSchema>;

export async function syncToGoogleCalendar(input: SyncToGoogleCalendarInput): Promise<SyncToGoogleCalendarOutput> {
  return syncToGoogleCalendarFlow(input);
}

const syncToGoogleCalendarFlow = ai.defineFlow(
  {
    name: 'syncToGoogleCalendarFlow',
    inputSchema: SyncToGoogleCalendarInputSchema,
    outputSchema: SyncToGoogleCalendarOutputSchema,
  },
  async (input) => {
    let syncedCount = 0;
    const { entries, timezone, accessToken } = input;

    // The Google Calendar API supports batching, but for simplicity, we'll do them one by one.
    // A production implementation should use batching for efficiency.
    for (const entry of entries) {
      const eventDate = toZonedTime(new Date(entry.date + 'T00:00:00'), timezone);
      const event = {
        summary: `[${entry.type === 'bill' ? 'Bill' : 'Income'}] ${entry.name}`,
        description: `Amount: ${formatCurrency(entry.amount)}`,
        start: {
          date: formatTz(eventDate, 'yyyy-MM-dd', { timeZone: 'UTC' }), // Google Calendar uses UTC for all-day events
          timeZone: timezone,
        },
        end: {
          date: formatTz(eventDate, 'yyyy-MM-dd', { timeZone: 'UTC' }),
          timeZone: timezone,
        },
        // Use a unique ID to prevent creating duplicate events on subsequent syncs
        id: `fiscalflow${entry.id.replace(/-/g, '')}`.substring(0, 1024), 
      };

      try {
        // Use the 'v3/calendars/primary/events' endpoint.
        // We use import() syntax for the event ID to specify an existing event to update/insert.
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/import`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          syncedCount++;
        } else {
          const errorData = await response.json();
          console.error(`Failed to sync event for "${entry.name}":`, errorData.error.message);
        }
      } catch (error) {
        console.error(`Network error syncing event for "${entry.name}":`, error);
      }
    }

    return { syncedCount };
  }
);
