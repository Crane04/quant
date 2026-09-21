import { HydratedDocument } from "mongoose";
import { Announcement, AnnouncementDoc } from "../models/Announcement";
import { Student } from "../models/Student";
import { sendWhatsAppText } from "./waService";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes — lecture status changes are time-sensitive

function formatAnnouncementMessage(a: AnnouncementDoc): string {
  const icon = a.type === "lecture_alert" ? "📢" : "📣";
  return `${icon} *${a.title}*\n${a.message}`;
}

async function deliverOne(
  announcement: HydratedDocument<AnnouncementDoc>,
): Promise<{ targeted: number; delivered: number }> {
  const students = await Student.find({
    university: announcement.university,
    department: announcement.department,
    level: announcement.level,
  }).select("phone");

  const message = formatAnnouncementMessage(announcement);

  const results = await Promise.all(
    students.map((student) =>
      sendWhatsAppText(student.phone, message)
        .then(() => true)
        .catch((err) => {
          logger.error("Failed to deliver announcement", {
            phone: student.phone,
            announcementId: announcement._id.toString(),
            error: err instanceof Error ? err.message : "unknown",
          });
          return false;
        }),
    ),
  );

  announcement.sentAt = new Date();
  await announcement.save();

  const delivered = results.filter(Boolean).length;
  logger.info("Delivered announcement", {
    announcementId: announcement._id.toString(),
    type: announcement.type,
    targeted: students.length,
    delivered,
  });

  return { targeted: students.length, delivered };
}

export async function deliverUnsent(): Promise<void> {
  const announcements = await Announcement.find({ sentAt: null }).sort({
    createdAt: 1,
  });

  for (const announcement of announcements) {
    await deliverOne(announcement);
  }
}

/**
 * Delivers one freshly-created announcement immediately, instead of leaving it for the
 * next scheduler sweep (up to CHECK_INTERVAL_MS away) — used by the WhatsApp broadcast
 * confirm flow so the HOC who just tapped "Send broadcast" gets an instant delivery
 * count back, matching the "Broadcast Successfully Dispatched" confirmation.
 */
export async function deliverAnnouncementNow(
  announcementId: string,
): Promise<{ targeted: number; delivered: number } | null> {
  const announcement = await Announcement.findById(announcementId);
  if (!announcement || announcement.sentAt) return null;
  return deliverOne(announcement);
}

export function startAnnouncementDeliveryScheduler(): void {
  setInterval(() => {
    deliverUnsent().catch((err) =>
      logger.error("Announcement delivery sweep failed", {
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }, CHECK_INTERVAL_MS).unref();
}
