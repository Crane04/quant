import { Announcement, AnnouncementDoc } from "../models/Announcement";
import { Student } from "../models/Student";
import { sendWhatsAppText } from "./waService";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes — lecture status changes are time-sensitive

function formatAnnouncementMessage(a: AnnouncementDoc): string {
  const icon = a.type === "lecture_alert" ? "📢" : "📣";
  return `${icon} *${a.title}*\n${a.message}`;
}

export async function deliverUnsent(): Promise<void> {
  const announcements = await Announcement.find({ sentAt: null }).sort({
    createdAt: 1,
  });

  for (const announcement of announcements) {
    const students = await Student.find({
      university: announcement.university,
      department: announcement.department,
      level: announcement.level,
    }).select("phone");

    const message = formatAnnouncementMessage(announcement);

    await Promise.all(
      students.map((student) =>
        sendWhatsAppText(student.phone, message).catch((err) =>
          logger.error("Failed to deliver announcement", {
            phone: student.phone,
            announcementId: announcement._id.toString(),
            error: err instanceof Error ? err.message : "unknown",
          }),
        ),
      ),
    );

    announcement.sentAt = new Date();
    await announcement.save();

    logger.info("Delivered announcement", {
      announcementId: announcement._id.toString(),
      type: announcement.type,
      students: students.length,
    });
  }
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
