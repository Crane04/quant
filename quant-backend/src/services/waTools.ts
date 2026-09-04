import { Types } from "mongoose";
import { Student, StudentDoc } from "../models/Student";
import { Course, CourseDoc } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { DocumentFile } from "../models/DocumentFile";
import { TimetableSlot } from "../models/TimetableSlot";
import { Assignment } from "../models/Assignment";
import { GradeRecord, GRADE_POINTS } from "../models/GradeRecord";
import {
  notifySubscribers,
  setSubscription,
} from "./courseSubscriptionService";

/** JSON-schema tool definitions in Groq/OpenAI's function-calling format. */
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_course_materials",
      description:
        "Search for course material (lecture notes, past questions, exam summaries) by course " +
        "code and/or a topic keyword. Returns a list of matches with an id for each — call " +
        "get_document_link with that id once the user says which one they want (or auto-pick if " +
        "there's exactly one obvious match) to actually send it to them.",
      parameters: {
        type: "object",
        properties: {
          courseCode: {
            type: "string",
            description: "e.g. 'MEE 305' — normalize spacing/case",
          },
          topic: {
            type: "string",
            description:
              "A keyword/topic to search by, if no course code was given",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_document_link",
      description:
        "Sends one specific document to the student as a WhatsApp file attachment, by its id. " +
        "The file is delivered automatically as a separate message — do not include a link in " +
        "your reply, just briefly confirm you're sending it.",
      parameters: {
        type: "object",
        properties: { documentId: { type: "string" } },
        required: ["documentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timetable",
      description:
        "Get the student's weekly class timetable, based on their most recent course enrollment.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_course_schedule",
      description:
        "Look up a course's current weekly class schedule, with an id for each slot. Call this " +
        "before update_class_schedule or cancel_class to find the slot id.",
      parameters: {
        type: "object",
        properties: { courseCode: { type: "string" } },
        required: ["courseCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_class",
      description:
        "HOC-only. Add a new weekly class time for a course, and notify students subscribed to " +
        "that course. Only works for the HOC's own class (university/department/level).",
      parameters: {
        type: "object",
        properties: {
          courseCode: { type: "string" },
          dayOfWeek: {
            type: "string",
            enum: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
          },
          startTime: { type: "string", description: "24h HH:MM, e.g. '09:00'" },
          endTime: { type: "string", description: "24h HH:MM, e.g. '11:00'" },
          venue: { type: "string" },
        },
        required: ["courseCode", "dayOfWeek", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_class_schedule",
      description:
        "HOC-only. Edit an existing class time slot (by id, from get_course_schedule) — e.g. a " +
        "venue or time change — and notify subscribed students of the update.",
      parameters: {
        type: "object",
        properties: {
          slotId: { type: "string" },
          dayOfWeek: {
            type: "string",
            enum: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
          },
          startTime: { type: "string" },
          endTime: { type: "string" },
          venue: { type: "string" },
        },
        required: ["slotId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_class",
      description:
        "HOC-only. Remove a class time slot (by id, from get_course_schedule) — e.g. a cancelled " +
        "lecture — and notify subscribed students.",
      parameters: {
        type: "object",
        properties: { slotId: { type: "string" } },
        required: ["slotId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "subscribe_to_course",
      description:
        "Subscribe the student to WhatsApp notifications for a course's schedule changes " +
        "(new classes, time/venue updates, cancellations). Students are subscribed by default " +
        "to courses matching their own class — this is mainly for courses outside it " +
        "(carryovers, borrowed courses).",
      parameters: {
        type: "object",
        properties: { courseCode: { type: "string" } },
        required: ["courseCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unsubscribe_from_course",
      description:
        "Stop notifications for a course's schedule changes — including for a course in the " +
        "student's own class, which they're otherwise subscribed to by default.",
      parameters: {
        type: "object",
        properties: { courseCode: { type: "string" } },
        required: ["courseCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_assignment",
      description:
        "Save a personal assignment/reminder for the student. This is just a personal note to " +
        "self — it doesn't require the course to exist in the system or the student to be " +
        "enrolled in it. Just take whatever course name/code and title they give you and save it.",
      parameters: {
        type: "object",
        properties: {
          courseLabel: {
            type: "string",
            description: "Whatever they call the course, e.g. 'MEE 501'",
          },
          title: {
            type: "string",
            description: "What the assignment is, e.g. 'Lab report submission'",
          },
          dueDate: {
            type: "string",
            description:
              "ISO 8601 datetime (e.g. '2026-08-31T20:00:00'). Resolve relative phrases like " +
              "'today 8pm' or 'next Friday' against today's date, given in the system prompt.",
          },
        },
        required: ["courseLabel", "title", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assignments",
      description:
        "Get the student's saved personal assignments, with due dates and completion status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_assignment_done",
      description:
        "Mark one of the student's assignments as completed, by its id.",
      parameters: {
        type: "object",
        properties: { assignmentId: { type: "string" } },
        required: ["assignmentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cgpa",
      description:
        "Get the student's cumulative GPA and a per-semester breakdown, from their recorded " +
        "grades. If they've set a CGPA target, this also returns their progress toward it — " +
        "the GPA they need to maintain each remaining semester, and whether that's achieved/on " +
        "track/unrealistic.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_cgpa_target",
      description:
        "Set the student's target CGPA (0-5 scale) and get back what GPA they'll need to " +
        "maintain each remaining semester to hit it. Requires at least one semester of grades " +
        "already recorded via record_grade — ask them to record grades first if they have none.",
      parameters: {
        type: "object",
        properties: {
          targetCgpa: { type: "number", minimum: 0, maximum: 5 },
        },
        required: ["targetCgpa"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description:
        "Get the student's own profile details (name, email, matric number, department, etc).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "enroll_in_courses",
      description:
        "Enroll the student in one or more courses for a given semester, in the current academic " +
        "session. Ask for the semester if missing — don't guess it.",
      parameters: {
        type: "object",
        properties: {
          semester: { type: "string", enum: ["first", "second"] },
          courseCodes: {
            type: "array",
            items: { type: "string" },
            description: "e.g. ['MEE 305', 'GST 201']",
          },
        },
        required: ["semester", "courseCodes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_grade",
      description:
        "Record/update the student's grade for one course in a given semester, in the current " +
        "academic session.",
      parameters: {
        type: "object",
        properties: {
          courseCode: { type: "string" },
          semester: { type: "string", enum: ["first", "second"] },
          creditUnits: { type: "integer", minimum: 1, maximum: 10 },
          grade: { type: "string", enum: Object.keys(GRADE_POINTS) },
        },
        required: ["courseCode", "semester", "creditUnits", "grade"],
      },
    },
  },
] as const;

// Only offered to students with isHOC set — filtered out of the tool list for
// everyone else, see buildToolDefinitions in waConversationService.ts. The
// executeTool functions also re-check isHOC themselves as defense in depth.
export const HOC_ONLY_TOOLS = new Set([
  "schedule_class",
  "update_class_schedule",
  "cancel_class",
]);

// Nigerian academic sessions run roughly September through July/August — derived from
// the current date instead of asking the student, since it's unambiguous either way.
function getCurrentSession(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

async function latestEnrollmentPeriod(
  studentId: Types.ObjectId,
): Promise<{ session: string; semester: "first" | "second" } | null> {
  const latest = await StudentCourse.findOne({ student: studentId }).sort({
    createdAt: -1,
  });
  if (!latest) return null;
  return {
    session: latest.session,
    semester: latest.semester as "first" | "second",
  };
}

export async function searchCourseMaterials(args: {
  courseCode?: string;
  topic?: string;
}) {
  // Deliberately not scoped to the student's own (university, department, level) —
  // students can be taking a course outside their own class (carryovers, borrowed
  // courses), and there's no course-registration system yet to know what someone
  // is actually enrolled in beyond their base profile fields.
  let courseIds: Types.ObjectId[] | undefined;

  if (args.courseCode) {
    const courses = await Course.find({
      code: new RegExp(args.courseCode.replace(/\s+/g, "\\s*"), "i"),
    });
    if (courses.length === 0)
      return { found: false, message: "No matching course found." };
    courseIds = courses.map((c) => c._id);
  }

  const filter: Record<string, unknown> = { status: "approved" };
  if (courseIds) filter.course = { $in: courseIds };
  if (args.topic) filter.$text = { $search: args.topic };

  const docs = await DocumentFile.find(filter)
    .populate("course")
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    found: docs.length > 0,
    count: docs.length,
    documents: docs.map((d) => ({
      id: d._id.toString(),
      title: d.title,
      category: d.category,
      courseCode: (d.course as unknown as { code: string }).code,
      courseTitle: (d.course as unknown as { title: string }).title,
    })),
  };
}

function sanitizeFilename(title: string, fileType: string): string {
  const base =
    title
      .trim()
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, "_") || "document";
  return `${base}.${fileType}`;
}

export async function getDocumentLink(args: { documentId: string }) {
  const doc = await DocumentFile.findById(args.documentId).populate("course");
  if (!doc || doc.status !== "approved")
    return { found: false, message: "Document not found." };

  await DocumentFile.updateOne(
    { _id: doc._id },
    { $inc: { downloadCount: 1 } },
  );

  return {
    found: true,
    title: doc.title,
    courseCode: (doc.course as unknown as { code: string }).code,
    fileUrl: doc.fileUrl,
    filename: sanitizeFilename(doc.title, doc.fileType),
  };
}

export async function getTimetable(student: StudentDoc) {
  const period = await latestEnrollmentPeriod(student._id);
  if (!period)
    return {
      enrolled: false,
      message: "Student isn't enrolled in any courses yet.",
    };

  const enrollments = await StudentCourse.find({
    student: student._id,
    session: period.session,
    semester: period.semester,
  }).select("course");
  const courseIds = enrollments.map((e) => e.course);

  const slots = await TimetableSlot.find({
    course: { $in: courseIds },
  }).populate("course");

  return {
    enrolled: true,
    session: period.session,
    semester: period.semester,
    slots: slots.map((s) => ({
      id: s._id.toString(),
      courseCode: (s.course as unknown as { code: string }).code,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      venue: s.venue,
    })),
  };
}

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDay(value: string): value is (typeof DAYS_OF_WEEK)[number] {
  return (DAYS_OF_WEEK as readonly string[]).includes(value);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function describeSlot(course: CourseDoc, slot: { dayOfWeek: string; startTime: string; endTime: string; venue?: string | null }): string {
  const venue = slot.venue ? ` at ${slot.venue}` : "";
  return `*${course.code}* — ${capitalize(slot.dayOfWeek)} ${slot.startTime}-${slot.endTime}${venue}`;
}

export async function getCourseSchedule(args: { courseCode: string }) {
  const course = await Course.findOne({
    code: new RegExp(`^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`, "i"),
  });
  if (!course) return { found: false, message: "Course not found." };

  const slots = await TimetableSlot.find({ course: course._id }).sort({
    dayOfWeek: 1,
    startTime: 1,
  });

  return {
    found: true,
    courseCode: course.code,
    slots: slots.map((s) => ({
      id: s._id.toString(),
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      venue: s.venue,
    })),
  };
}

// HOCs can only manage the schedule for their own class — a write action with
// real consequences (it notifies people), unlike the deliberately-open search.
function assertOwnClass(student: StudentDoc, course: CourseDoc): string | null {
  if (
    course.university !== student.university ||
    course.department !== student.department ||
    course.level !== student.level
  ) {
    return "You can only manage the schedule for your own class.";
  }
  return null;
}

export async function scheduleClass(
  student: StudentDoc,
  args: {
    courseCode: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    venue?: string;
  },
) {
  if (!student.isHOC)
    return { success: false, message: "Only HOCs can schedule classes." };

  if (!isValidDay(args.dayOfWeek.toLowerCase())) {
    return { success: false, message: "Invalid day of week." };
  }
  if (!TIME_FORMAT.test(args.startTime) || !TIME_FORMAT.test(args.endTime)) {
    return { success: false, message: "Times must be 24h HH:MM, e.g. '09:00'." };
  }

  const course = await Course.findOne({
    code: new RegExp(`^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`, "i"),
    university: student.university,
  });
  if (!course) return { success: false, message: "Course not found." };

  const scopeError = assertOwnClass(student, course);
  if (scopeError) return { success: false, message: scopeError };

  const slot = await TimetableSlot.create({
    course: course._id,
    dayOfWeek: args.dayOfWeek.toLowerCase(),
    startTime: args.startTime,
    endTime: args.endTime,
    venue: args.venue,
  });

  await notifySubscribers(
    course,
    `📅 New class scheduled: ${describeSlot(course, slot)}`,
  );

  return { success: true, id: slot._id.toString() };
}

export async function updateClassSchedule(
  student: StudentDoc,
  args: {
    slotId: string;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    venue?: string;
  },
) {
  if (!student.isHOC)
    return { success: false, message: "Only HOCs can update the class schedule." };

  if (args.dayOfWeek && !isValidDay(args.dayOfWeek.toLowerCase())) {
    return { success: false, message: "Invalid day of week." };
  }
  if (
    (args.startTime && !TIME_FORMAT.test(args.startTime)) ||
    (args.endTime && !TIME_FORMAT.test(args.endTime))
  ) {
    return { success: false, message: "Times must be 24h HH:MM, e.g. '09:00'." };
  }

  const slot = await TimetableSlot.findById(args.slotId).populate("course");
  if (!slot)
    return { success: false, message: "Class schedule entry not found." };

  const course = slot.course as unknown as CourseDoc;
  const scopeError = assertOwnClass(student, course);
  if (scopeError) return { success: false, message: scopeError };

  if (args.dayOfWeek)
    slot.dayOfWeek = args.dayOfWeek.toLowerCase() as (typeof DAYS_OF_WEEK)[number];
  if (args.startTime) slot.startTime = args.startTime;
  if (args.endTime) slot.endTime = args.endTime;
  if (args.venue !== undefined) slot.venue = args.venue;
  await slot.save();

  await notifySubscribers(course, `🔄 Class updated: ${describeSlot(course, slot)}`);

  return { success: true };
}

export async function cancelClass(student: StudentDoc, args: { slotId: string }) {
  if (!student.isHOC)
    return { success: false, message: "Only HOCs can cancel classes." };

  const slot = await TimetableSlot.findById(args.slotId).populate("course");
  if (!slot)
    return { success: false, message: "Class schedule entry not found." };

  const course = slot.course as unknown as CourseDoc;
  const scopeError = assertOwnClass(student, course);
  if (scopeError) return { success: false, message: scopeError };

  await TimetableSlot.findByIdAndDelete(args.slotId);

  await notifySubscribers(
    course,
    `❌ Class cancelled: ${describeSlot(course, slot)} has been removed from the schedule.`,
  );

  return { success: true };
}

export async function subscribeToCourse(
  student: StudentDoc,
  args: { courseCode: string },
) {
  const course = await Course.findOne({
    code: new RegExp(`^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`, "i"),
    university: student.university,
  });
  if (!course) return { success: false, message: "Course not found." };

  await setSubscription(student._id, course._id, true);
  return { success: true, courseCode: course.code, subscribed: true };
}

export async function unsubscribeFromCourse(
  student: StudentDoc,
  args: { courseCode: string },
) {
  const course = await Course.findOne({
    code: new RegExp(`^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`, "i"),
    university: student.university,
  });
  if (!course) return { success: false, message: "Course not found." };

  await setSubscription(student._id, course._id, false);
  return { success: true, courseCode: course.code, subscribed: false };
}

export async function saveAssignment(
  student: StudentDoc,
  args: { courseLabel: string; title: string; dueDate: string },
) {
  const dueDate = new Date(args.dueDate);
  if (isNaN(dueDate.getTime()))
    return { success: false, message: "Couldn't parse that due date." };

  const assignment = await Assignment.create({
    student: student._id,
    courseLabel: args.courseLabel.trim(),
    title: args.title.trim(),
    dueDate,
  });

  return { success: true, id: assignment._id.toString() };
}

export async function getAssignments(student: StudentDoc) {
  const assignments = await Assignment.find({ student: student._id })
    .sort({ dueDate: 1 })
    .limit(20);

  return {
    assignments: assignments.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      courseLabel: a.courseLabel,
      dueDate: a.dueDate.toISOString().slice(0, 10),
      completed: a.completed,
    })),
  };
}

export async function markAssignmentDone(
  student: StudentDoc,
  args: { assignmentId: string },
) {
  const assignment = await Assignment.findOneAndUpdate(
    { _id: args.assignmentId, student: student._id },
    { completed: true, completedAt: new Date() },
  );
  if (!assignment) return { success: false, message: "Assignment not found." };

  return { success: true };
}

// 5 levels (100-500) x 2 semesters — matches the level enum used everywhere
// else in this system (registration, enrollment). LASU Engineering's "all
// programs are 5-year" note is already consistent with this: 500 is already
// the terminal level system-wide, no separate program-length concept needed.
const TOTAL_PROGRAM_SEMESTERS = 10;

interface CgpaSnapshot {
  cumulativePoints: number;
  cumulativeUnits: number;
  semestersRecorded: number;
}

/**
 * Projects the GPA required in each remaining semester to hit a target CGPA
 * by graduation, using the student's own historical average credit load to
 * estimate future units (we have no way to know their actual future course
 * load). `status` is "achieved" if they're already there, "unrealistic" if
 * the required GPA exceeds the maximum possible (5.0) or no semesters are
 * left, "on_track" otherwise.
 */
function projectCgpaTarget(snapshot: CgpaSnapshot, targetCgpa: number) {
  const { cumulativePoints, cumulativeUnits, semestersRecorded } = snapshot;
  const currentCgpa = cumulativeUnits ? cumulativePoints / cumulativeUnits : 0;
  const remainingSemesters = Math.max(
    TOTAL_PROGRAM_SEMESTERS - semestersRecorded,
    0,
  );

  // Already there — regardless of how many semesters are left, don't tell them
  // they need to "maintain" some lower GPA to hit a target they've already cleared.
  if (currentCgpa >= targetCgpa) {
    return {
      remainingSemesters,
      requiredGpaPerSemester: null,
      status: "achieved",
    } as const;
  }

  if (remainingSemesters === 0) {
    return {
      remainingSemesters: 0,
      requiredGpaPerSemester: null,
      status: "unrealistic",
    } as const;
  }

  // Fallback only matters if a target somehow exists with zero recorded
  // grades (set_cgpa_target itself won't allow that) — a plausible average load.
  const avgUnitsPerSemester =
    semestersRecorded > 0 ? cumulativeUnits / semestersRecorded : 15;
  const projectedRemainingUnits = avgUnitsPerSemester * remainingSemesters;
  const requiredRemainingPoints =
    targetCgpa * (cumulativeUnits + projectedRemainingUnits) -
    cumulativePoints;
  const requiredGpaPerSemester =
    requiredRemainingPoints / projectedRemainingUnits;

  const status = requiredGpaPerSemester <= 5 ? "on_track" : "unrealistic";

  return {
    remainingSemesters,
    requiredGpaPerSemester: Number(
      Math.max(requiredGpaPerSemester, 0).toFixed(2),
    ),
    status,
  } as const;
}

export async function getCgpa(student: StudentDoc) {
  const records = await GradeRecord.find({ student: student._id }).populate(
    "course",
  );

  const bySemester = new Map<
    string,
    { totalPoints: number; totalUnits: number }
  >();
  let cumulativePoints = 0;
  let cumulativeUnits = 0;

  for (const r of records) {
    const key = `${r.session} - ${r.semester}`;
    const bucket = bySemester.get(key) ?? { totalPoints: 0, totalUnits: 0 };
    bucket.totalPoints += (r.gradePoint ?? 0) * r.creditUnits;
    bucket.totalUnits += r.creditUnits;
    bySemester.set(key, bucket);
    cumulativePoints += (r.gradePoint ?? 0) * r.creditUnits;
    cumulativeUnits += r.creditUnits;
  }

  const target =
    student.targetCgpa != null
      ? {
          targetCgpa: student.targetCgpa,
          ...projectCgpaTarget(
            {
              cumulativePoints,
              cumulativeUnits,
              semestersRecorded: bySemester.size,
            },
            student.targetCgpa,
          ),
        }
      : null;

  return {
    hasGrades: records.length > 0,
    cgpa: cumulativeUnits
      ? Number((cumulativePoints / cumulativeUnits).toFixed(2))
      : 0,
    totalCreditUnits: cumulativeUnits,
    semesterBreakdown: Array.from(bySemester.entries()).map(([key, v]) => ({
      session: key.split(" - ")[0],
      semester: key.split(" - ")[1],
      gpa: v.totalUnits ? Number((v.totalPoints / v.totalUnits).toFixed(2)) : 0,
      totalUnits: v.totalUnits,
    })),
    target,
  };
}

export async function setCgpaTarget(
  student: StudentDoc,
  args: { targetCgpa: number },
) {
  if (args.targetCgpa < 0 || args.targetCgpa > 5) {
    return { success: false, message: "CGPA target must be between 0 and 5." };
  }

  const records = await GradeRecord.find({ student: student._id });
  if (records.length === 0) {
    return {
      success: false,
      message:
        "No grades recorded yet — record at least one semester's grades first so I have something to project from.",
    };
  }

  const bySemester = new Set<string>();
  let cumulativePoints = 0;
  let cumulativeUnits = 0;
  for (const r of records) {
    bySemester.add(`${r.session} - ${r.semester}`);
    cumulativePoints += (r.gradePoint ?? 0) * r.creditUnits;
    cumulativeUnits += r.creditUnits;
  }

  await Student.updateOne(
    { _id: student._id },
    { targetCgpa: args.targetCgpa },
  );
  // Also mutate the in-memory object passed in — updateOne only touches the DB,
  // and this same `student` may be reused by a later get_cgpa call in the same
  // conversation turn, which would otherwise see the stale pre-update value.
  student.targetCgpa = args.targetCgpa;

  const projection = projectCgpaTarget(
    { cumulativePoints, cumulativeUnits, semestersRecorded: bySemester.size },
    args.targetCgpa,
  );

  return {
    success: true,
    currentCgpa: cumulativeUnits
      ? Number((cumulativePoints / cumulativeUnits).toFixed(2))
      : 0,
    targetCgpa: args.targetCgpa,
    ...projection,
  };
}

export function getProfile(student: StudentDoc) {
  return {
    fullName: student.fullName,
    email: student.email,
    matricNumber: student.matricNumber,
    university: student.university,
    department: student.department,
    level: student.level,
    isAmbassador: student.isAmbassador,
    points: student.points,
  };
}

export async function enrollInCourses(
  student: StudentDoc,
  args: { semester: "first" | "second"; courseCodes: string[] },
) {
  const codes = args.courseCodes.map((c) => c.trim().toUpperCase());
  const courses = await Course.find({
    code: { $in: codes },
    university: student.university,
  });

  if (courses.length === 0) {
    return {
      success: false,
      message:
        "None of those course codes were found for the student's university.",
    };
  }

  const session = getCurrentSession();

  await StudentCourse.bulkWrite(
    courses.map((course) => ({
      updateOne: {
        filter: { student: student._id, course: course._id },
        update: {
          $setOnInsert: {
            student: student._id,
            course: course._id,
            session,
            semester: args.semester,
          },
        },
        upsert: true,
      },
    })),
  );

  const foundCodes = courses.map((c) => c.code);
  const notFound = codes.filter((c) => !foundCodes.includes(c));

  return { success: true, enrolled: foundCodes, notFound };
}

export async function recordGrade(
  student: StudentDoc,
  args: {
    courseCode: string;
    semester: "first" | "second";
    creditUnits: number;
    grade: string;
  },
) {
  const course = await Course.findOne({
    code: new RegExp(
      `^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`,
      "i",
    ),
    university: student.university,
  });
  if (!course)
    return {
      success: false,
      message: "That course wasn't found for the student's university.",
    };

  if (!Object.keys(GRADE_POINTS).includes(args.grade.toUpperCase())) {
    return {
      success: false,
      message: "Invalid grade letter — must be one of A, B, C, D, E, F.",
    };
  }

  await GradeRecord.findOneAndUpdate(
    {
      student: student._id,
      course: course._id,
      session: getCurrentSession(),
      semester: args.semester,
    },
    { creditUnits: args.creditUnits, grade: args.grade.toUpperCase() },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  return { success: true };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  student: StudentDoc,
): Promise<unknown> {
  switch (name) {
    case "search_course_materials":
      return searchCourseMaterials(
        args as { courseCode?: string; topic?: string },
      );
    case "get_document_link":
      return getDocumentLink(args as { documentId: string });
    case "get_timetable":
      return getTimetable(student);
    case "get_course_schedule":
      return getCourseSchedule(args as { courseCode: string });
    case "schedule_class":
      return scheduleClass(
        student,
        args as {
          courseCode: string;
          dayOfWeek: string;
          startTime: string;
          endTime: string;
          venue?: string;
        },
      );
    case "update_class_schedule":
      return updateClassSchedule(
        student,
        args as {
          slotId: string;
          dayOfWeek?: string;
          startTime?: string;
          endTime?: string;
          venue?: string;
        },
      );
    case "cancel_class":
      return cancelClass(student, args as { slotId: string });
    case "subscribe_to_course":
      return subscribeToCourse(student, args as { courseCode: string });
    case "unsubscribe_from_course":
      return unsubscribeFromCourse(student, args as { courseCode: string });
    case "save_assignment":
      return saveAssignment(
        student,
        args as { courseLabel: string; title: string; dueDate: string },
      );
    case "get_assignments":
      return getAssignments(student);
    case "mark_assignment_done":
      return markAssignmentDone(student, args as { assignmentId: string });
    case "get_cgpa":
      return getCgpa(student);
    case "set_cgpa_target":
      return setCgpaTarget(student, args as { targetCgpa: number });
    case "get_profile":
      return getProfile(student);
    case "enroll_in_courses":
      return enrollInCourses(
        student,
        args as { semester: "first" | "second"; courseCodes: string[] },
      );
    case "record_grade":
      return recordGrade(
        student,
        args as {
          courseCode: string;
          semester: "first" | "second";
          creditUnits: number;
          grade: string;
        },
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
