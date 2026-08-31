import { Assignment } from "../models/Assignment";
import { StudentCourse } from "../models/StudentCourse";
import { Student } from "../models/Student";
import { sendWhatsAppText } from "./waService";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
const REMINDER_WINDOW_HOURS = 24;
const RESEND_COOLDOWN_MS = 20 * 60 * 60 * 1000; // don't re-remind inside 20h of the last nudge

async function sendDueReminders(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    dueDate: { $gte: new Date(), $lte: windowEnd },
  }).populate("course");

  for (const assignment of assignments) {
    const lastReminder = assignment.reminderSentAt?.[assignment.reminderSentAt.length - 1];
    if (lastReminder && Date.now() - lastReminder.getTime() < RESEND_COOLDOWN_MS) continue;

    const enrollments = await StudentCourse.find({ course: assignment.course }).select("student");
    if (enrollments.length === 0) continue;

    const students = await Student.find({ _id: { $in: enrollments.map((e) => e.student) } });
    const course = assignment.course as unknown as { code: string };
    const due = assignment.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const message = `⏰ Reminder: *${course.code} — ${assignment.title}* is due ${due}. Type *menu* > 3 to view your assignments.`;

    await Promise.all(
      students.map((student) =>
        sendWhatsAppText(student.phone, message).catch((err) =>
          logger.error("Failed to send assignment reminder", {
            phone: student.phone,
            error: err instanceof Error ? err.message : "unknown",
          })
        )
      )
    );

    assignment.reminderSentAt = [...(assignment.reminderSentAt ?? []), new Date()];
    await assignment.save();

    logger.info("Sent assignment reminder", { assignmentId: assignment._id.toString(), students: students.length });
  }
}

export function startAssignmentReminderScheduler(): void {
  setInterval(() => {
    sendDueReminders().catch((err) =>
      logger.error("Assignment reminder sweep failed", {
        error: err instanceof Error ? err.message : "unknown",
      })
    );
  }, CHECK_INTERVAL_MS).unref();
}
