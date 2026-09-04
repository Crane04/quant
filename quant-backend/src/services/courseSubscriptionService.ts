import { Types } from "mongoose";
import { CourseSubscription } from "../models/CourseSubscription";
import { Student, StudentDoc } from "../models/Student";
import { CourseDoc } from "../models/Course";
import { sendWhatsAppText } from "./waService";
import { logger } from "../utils/logger";

/** True if `student` is subscribed to `course` — explicit override, or the
 *  default (their own class) if no override exists. */
export async function isSubscribed(
  student: StudentDoc,
  course: CourseDoc,
): Promise<boolean> {
  const override = await CourseSubscription.findOne({
    student: student._id,
    course: course._id,
  });
  if (override) return override.subscribed;

  return (
    course.university === student.university &&
    course.department === student.department &&
    course.level === student.level
  );
}

/** Every student who should be notified about a change to `course`'s schedule:
 *  everyone in the course's own class who hasn't opted out, plus anyone
 *  outside it who's explicitly opted in. */
export async function getSubscribedStudents(
  course: CourseDoc,
): Promise<StudentDoc[]> {
  const inClass = await Student.find({
    university: course.university,
    department: course.department,
    level: course.level,
  });

  const overrides = await CourseSubscription.find({ course: course._id });
  const optOutIds = new Set(
    overrides
      .filter((o) => !o.subscribed)
      .map((o) => o.student.toString()),
  );
  const optInIds = overrides
    .filter((o) => o.subscribed)
    .map((o) => o.student);

  const inClassIds = new Set(inClass.map((s) => s._id.toString()));
  const subscribed = inClass.filter((s) => !optOutIds.has(s._id.toString()));

  const extraOptIns = await Student.find({
    _id: {
      $in: optInIds.filter((id) => !inClassIds.has(id.toString())),
    },
  });

  return [...subscribed, ...extraOptIns];
}

export async function notifySubscribers(
  course: CourseDoc,
  message: string,
): Promise<void> {
  const students = await getSubscribedStudents(course);

  await Promise.all(
    students.map((student) =>
      sendWhatsAppText(student.phone, message).catch((err) =>
        logger.error("Failed to notify course subscriber", {
          phone: student.phone,
          courseId: (course._id as Types.ObjectId).toString(),
          error: err instanceof Error ? err.message : "unknown",
        }),
      ),
    ),
  );
}

export async function setSubscription(
  studentId: Types.ObjectId,
  courseId: Types.ObjectId,
  subscribed: boolean,
): Promise<void> {
  await CourseSubscription.findOneAndUpdate(
    { student: studentId, course: courseId },
    { subscribed },
    { upsert: true },
  );
}
