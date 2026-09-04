import { TimetableSlot } from "../models/TimetableSlot";
import { CourseDoc } from "../models/Course";
import { notifySubscribers } from "./courseSubscriptionService";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 60 * 1000; // every minute — needed for ~10min precision
const REMINDER_LEAD_MINUTES = 10;
// Slots recur weekly, so this is a re-arming cooldown (not a one-time flag
// like Assignment's reminderSentAt) — long enough to never double-fire for
// the same occurrence, short enough to fire again next week.
const RESEND_COOLDOWN_MS = 20 * 60 * 60 * 1000;

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const DAY_NAMES = Object.keys(DAY_INDEX);

interface ReminderCheckInput {
  dayOfWeek: string;
  startTime: string; // "HH:MM"
  lastReminderSentAt?: Date | null;
}

/** Pure decision logic, no DB/network — how many minutes until `slot` starts
 *  right now, or null if it's not due a reminder (wrong day, outside the lead
 *  window, or already reminded within the cooldown). Kept separate from
 *  sendClassStartReminders so the tricky day/time math can be unit-tested
 *  without touching real data or sending real notifications. */
export function minutesUntilDue(
  slot: ReminderCheckInput,
  now: Date,
): number | null {
  if (DAY_INDEX[slot.dayOfWeek] !== now.getDay()) return null;

  const [hour, minute] = slot.startTime.split(":").map(Number);
  const startsAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
  );
  const minutesUntilStart = (startsAt.getTime() - now.getTime()) / 60_000;

  if (minutesUntilStart < 0 || minutesUntilStart > REMINDER_LEAD_MINUTES)
    return null;

  if (
    slot.lastReminderSentAt &&
    now.getTime() - slot.lastReminderSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return null;
  }

  return minutesUntilStart;
}

export async function sendClassStartReminders(): Promise<void> {
  const now = new Date();
  const todayName = DAY_NAMES.find((day) => DAY_INDEX[day] === now.getDay());
  const slots = await TimetableSlot.find({ dayOfWeek: todayName }).populate(
    "course",
  );

  for (const slot of slots) {
    const minutesUntilStart = minutesUntilDue(slot, now);
    if (minutesUntilStart === null) continue;

    const course = slot.course as unknown as CourseDoc;
    const venue = slot.venue ? ` at ${slot.venue}` : "";
    const roundedMinutes = Math.max(Math.round(minutesUntilStart), 1);
    const message = `⏰ *${course.code}* starts in ${roundedMinutes} minute${roundedMinutes === 1 ? "" : "s"}${venue}!`;

    await notifySubscribers(course, message);

    slot.lastReminderSentAt = now;
    await slot.save();

    logger.info("Sent class start reminder", {
      slotId: slot._id.toString(),
      courseCode: course.code,
    });
  }
}

export function startClassReminderScheduler(): void {
  setInterval(() => {
    sendClassStartReminders().catch((err) =>
      logger.error("Class start reminder sweep failed", {
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }, CHECK_INTERVAL_MS).unref();
}
