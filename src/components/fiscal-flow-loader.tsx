import { toZonedTime } from 'date-fns-tz';
import { Entry } from './types';
import { formatCurrency } from './utils';
import { add, getDay, isAfter, isBefore, set } from 'date-fns';
import { recurrenceIntervalMonths } from './constants';

const NOTIFICATION_TAG_PREFIX = 'centsi-bill-';
const NOTIFICATION_WINDOW_DAYS = 90; // Schedule notifications for the next 90 days.

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  return navigator.serviceWorker.ready;
}

export async function cancelAllNotifications(toast: any) {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return;

  try {
    const notifications = await registration.getNotifications({
      tag: NOTIFICATION_TAG_PREFIX,
      includeTriggered: true,
    });
    notifications.forEach((notification) => notification.close());
    if (notifications.length > 0) {
       console.log(`${notifications.length} notifications cancelled.`);
    }
  } catch (e) {
    console.error('Error cancelling notifications:', e);
  }
}

function getNextBillOccurrences(entry: Entry, timezone: string): Date[] {
  const occurrences: Date[] = [];
  const now = new Date();
  const scheduleUntil = add(now, { days: NOTIFICATION_WINDOW_DAYS });

  const [year, month, day] = entry.date.split('-').map(Number);
  const baseDate = toZonedTime(new Date(year, month - 1, day), timezone);

  // Set the notification time to 8 AM for all occurrences
  const notificationTime = { hours: 8, minutes: 0, seconds: 0, milliseconds: 0 };

  if (entry.recurrence === 'none') {
    const occurrence = set(baseDate, notificationTime);
    if (isAfter(occurrence, now) && isBefore(occurrence, scheduleUntil)) {
      occurrences.push(occurrence);
    }
  } else if (entry.recurrence === 'weekly') {
    let nextOccurrence = set(baseDate, notificationTime);
    
    while(isBefore(nextOccurrence, now)){
      nextOccurrence = add(nextOccurrence, { weeks: 1 });
    }

    while (isBefore(nextOccurrence, scheduleUntil)) {
      occurrences.push(nextOccurrence);
      nextOccurrence = add(nextOccurrence, { weeks: 1 });
    }
  } else {
    const interval = recurrenceIntervalMonths[entry.recurrence as keyof typeof recurrenceIntervalMonths];
    let nextOccurrence = set(baseDate, notificationTime);

    while(isBefore(nextOccurrence, now)){
      nextOccurrence = add(nextOccurrence, { months: interval });
    }

    while (isBefore(nextOccurrence, scheduleUntil)) {
      occurrences.push(nextOccurrence);
      nextOccurrence = add(nextOccurrence, { months: interval });
    }
  }

  return occurrences;
}


export async function scheduleNotifications(entries: Entry[], timezone: string, toast: any) {
  const registration = await getServiceWorkerRegistration();
  if (!registration || !('showNotification' in registration)) {
    toast({
      title: 'Notification Scheduling Error',
      description: 'Could not access service worker for notifications.',
      variant: 'destructive',
    });
    return;
  }
  
  // First, cancel all previously scheduled notifications
  await cancelAllNotifications(toast);

  const billEntries = entries.filter((entry) => entry.type === 'bill');
  let scheduledCount = 0;

  for (const entry of billEntries) {
    const occurrences = getNextBillOccurrences(entry, timezone);
    
    for (const occurrenceDate of occurrences) {
      try {
        await registration.showNotification('Bill Due Today', {
          tag: `${NOTIFICATION_TAG_PREFIX}${entry.id}-${occurrenceDate.toISOString().split('T')[0]}`,
          body: `${entry.name} (${formatCurrency(entry.amount)}) is due.`,
          showTrigger: new (window as any).TimestampTrigger(occurrenceDate.getTime()),
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          silent: false,
        });
        scheduledCount++;
      } catch (e) {
        console.error('Error scheduling notification:', e);
        // This can fail if the timestamp is in the past, which is expected for some logic.
      }
    }
  }

  if (scheduledCount > 0) {
    console.log(`Successfully scheduled ${scheduledCount} bill notifications.`);
  }
}