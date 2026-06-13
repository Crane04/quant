import { Student } from "../models/Student";
import { logInfo, logPhone, logWarn } from "../utils/logger";
import { sendText } from "./twilioService";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_INTERVAL_MS = 60 * 60 * 1000;

const getReminderWindow = () => {
  const now = new Date();
  return {
    now,
    windowEnd: new Date(now.getTime() + DAY_MS),
  };
};

export const sendDueAssignmentReminders = async (): Promise<void> => {
  const { now, windowEnd } = getReminderWindow();

  const students = await Student.find({
    assignments: {
      $elemMatch: {
        dueDate: { $gte: now, $lte: windowEnd },
        reminderSent: false,
      },
    },
  });

  for (const student of students) {
    let changed = false;

    for (const assignment of student.assignments) {
      if (
        assignment.reminderSent ||
        assignment.dueDate < now ||
        assignment.dueDate > windowEnd
      ) {
        continue;
      }

      await sendText(
        student.phoneNumber,
        `Reminder: ${assignment.courseCode} ${assignment.description} is due within 24 hours.`
      );

      assignment.reminderSent = true;
      changed = true;

      logInfo("Assignment reminder sent", {
        from: logPhone(student.phoneNumber),
        courseCode: assignment.courseCode,
      });
    }

    if (changed) await student.save();
  }
};

export const startAssignmentReminderScheduler = (): NodeJS.Timeout => {
  const intervalMs =
    Number.parseInt(process.env.REMINDER_INTERVAL_MS || "", 10) ||
    DEFAULT_REMINDER_INTERVAL_MS;

  void sendDueAssignmentReminders().catch((err) => {
    logWarn("Assignment reminder scan failed", {
      error: err instanceof Error ? err.message : "Unknown reminder error",
    });
  });

  return setInterval(() => {
    void sendDueAssignmentReminders().catch((err) => {
      logWarn("Assignment reminder scan failed", {
        error: err instanceof Error ? err.message : "Unknown reminder error",
      });
    });
  }, intervalMs);
};
