import { Assignment } from "../models/Assignment";
import { Student } from "../models/Student";
import { sendWhatsAppText } from "./waService";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
const REMINDER_WINDOW_HOURS = 24;

async function sendDueReminders(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

  const assignments = await Assignment.find({
    dueDate: { $gte: new Date(), $lte: windowEnd },
    completed: false,
    reminderSentAt: null,
  });

  for (const assignment of assignments) {
    const student = await Student.findById(assignment.student);
    if (!student) continue;

    const due = assignment.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const message = `⏰ Reminder: *${assignment.courseLabel} — ${assignment.title}* is due ${due}. Type *menu* > 3 to view your assignments.`;

    try {
      await sendWhatsAppText(student.phone, message);
      assignment.reminderSentAt = new Date();
      await assignment.save();
      logger.info("Sent assignment reminder", { assignmentId: assignment._id.toString(), phone: student.phone });
    } catch (err) {
      logger.error("Failed to send assignment reminder", {
        phone: student.phone,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
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
