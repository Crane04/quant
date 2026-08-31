import { Types } from "mongoose";
import { StudentDoc } from "../models/Student";
import { Course } from "../models/Course";
import { StudentCourse } from "../models/StudentCourse";
import { DocumentFile } from "../models/DocumentFile";
import { TimetableSlot } from "../models/TimetableSlot";
import { Assignment } from "../models/Assignment";
import { StudentAssignmentStatus } from "../models/StudentAssignmentStatus";
import { GradeRecord, GRADE_POINTS } from "../models/GradeRecord";

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
          courseCode: { type: "string", description: "e.g. 'MEE 305' — normalize spacing/case" },
          topic: { type: "string", description: "A keyword/topic to search by, if no course code was given" },
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
      description: "Get the student's weekly class timetable, based on their most recent course enrollment.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assignments",
      description:
        "Get the student's assignments for their enrolled courses, with due dates and completion status.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_assignment_done",
      description: "Mark one of the student's assignments as completed, by its id.",
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
      description: "Get the student's cumulative GPA and a per-semester breakdown, from their recorded grades.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_profile",
      description: "Get the student's own profile details (name, email, matric number, department, etc).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "enroll_in_courses",
      description:
        "Enroll the student in one or more courses for a given session and semester. Ask for any " +
        "of these that are missing before calling — don't guess a session/semester.",
      parameters: {
        type: "object",
        properties: {
          session: { type: "string", description: "e.g. '2024/2025'" },
          semester: { type: "string", enum: ["first", "second"] },
          courseCodes: { type: "array", items: { type: "string" }, description: "e.g. ['MEE 305', 'GST 201']" },
        },
        required: ["session", "semester", "courseCodes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_grade",
      description: "Record/update the student's grade for one course in a given session and semester.",
      parameters: {
        type: "object",
        properties: {
          courseCode: { type: "string" },
          session: { type: "string", description: "e.g. '2024/2025'" },
          semester: { type: "string", enum: ["first", "second"] },
          creditUnits: { type: "integer", minimum: 1, maximum: 10 },
          grade: { type: "string", enum: Object.keys(GRADE_POINTS) },
        },
        required: ["courseCode", "session", "semester", "creditUnits", "grade"],
      },
    },
  },
] as const;

async function latestEnrollmentPeriod(
  studentId: Types.ObjectId
): Promise<{ session: string; semester: "first" | "second" } | null> {
  const latest = await StudentCourse.findOne({ student: studentId }).sort({ createdAt: -1 });
  if (!latest) return null;
  return { session: latest.session, semester: latest.semester as "first" | "second" };
}

export async function searchCourseMaterials(args: { courseCode?: string; topic?: string }) {
  let courseIds: Types.ObjectId[] | undefined;

  if (args.courseCode) {
    const courses = await Course.find({
      code: new RegExp(args.courseCode.replace(/\s+/g, "\\s*"), "i"),
    });
    if (courses.length === 0) return { found: false, message: "No matching course found." };
    courseIds = courses.map((c) => c._id);
  }

  const filter: Record<string, unknown> = { status: "approved" };
  if (courseIds) filter.course = { $in: courseIds };
  if (args.topic) filter.$text = { $search: args.topic };

  const docs = await DocumentFile.find(filter).populate("course").sort({ createdAt: -1 }).limit(10);

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
  const base = title.trim().replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_") || "document";
  return `${base}.${fileType}`;
}

export async function getDocumentLink(args: { documentId: string }) {
  const doc = await DocumentFile.findById(args.documentId).populate("course");
  if (!doc || doc.status !== "approved") return { found: false, message: "Document not found." };

  await DocumentFile.updateOne({ _id: doc._id }, { $inc: { downloadCount: 1 } });

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
  if (!period) return { enrolled: false, message: "Student isn't enrolled in any courses yet." };

  const enrollments = await StudentCourse.find({
    student: student._id,
    session: period.session,
    semester: period.semester,
  }).select("course");
  const courseIds = enrollments.map((e) => e.course);

  const slots = await TimetableSlot.find({ course: { $in: courseIds } }).populate("course");

  return {
    enrolled: true,
    session: period.session,
    semester: period.semester,
    slots: slots.map((s) => ({
      courseCode: (s.course as unknown as { code: string }).code,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      venue: s.venue,
    })),
  };
}

export async function getAssignments(student: StudentDoc) {
  const period = await latestEnrollmentPeriod(student._id);
  if (!period) return { enrolled: false, message: "Student isn't enrolled in any courses yet." };

  const enrollments = await StudentCourse.find({
    student: student._id,
    session: period.session,
    semester: period.semester,
  }).select("course");
  const courseIds = enrollments.map((e) => e.course);

  const assignments = await Assignment.find({ course: { $in: courseIds } })
    .populate("course")
    .sort({ dueDate: 1 })
    .limit(20);

  const statuses = await StudentAssignmentStatus.find({
    student: student._id,
    assignment: { $in: assignments.map((a) => a._id) },
  });
  const statusByAssignment = new Map(statuses.map((s) => [s.assignment.toString(), s.completed]));

  return {
    enrolled: true,
    assignments: assignments.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      courseCode: (a.course as unknown as { code: string }).code,
      dueDate: a.dueDate.toISOString().slice(0, 10),
      completed: statusByAssignment.get(a._id.toString()) ?? false,
    })),
  };
}

export async function markAssignmentDone(student: StudentDoc, args: { assignmentId: string }) {
  const assignment = await Assignment.findById(args.assignmentId);
  if (!assignment) return { success: false, message: "Assignment not found." };

  await StudentAssignmentStatus.findOneAndUpdate(
    { student: student._id, assignment: args.assignmentId },
    { completed: true, completedAt: new Date() },
    { upsert: true }
  );

  return { success: true };
}

export async function getCgpa(student: StudentDoc) {
  const records = await GradeRecord.find({ student: student._id }).populate("course");

  const bySemester = new Map<string, { totalPoints: number; totalUnits: number }>();
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

  return {
    hasGrades: records.length > 0,
    cgpa: cumulativeUnits ? Number((cumulativePoints / cumulativeUnits).toFixed(2)) : 0,
    totalCreditUnits: cumulativeUnits,
    semesterBreakdown: Array.from(bySemester.entries()).map(([key, v]) => ({
      session: key.split(" - ")[0],
      semester: key.split(" - ")[1],
      gpa: v.totalUnits ? Number((v.totalPoints / v.totalUnits).toFixed(2)) : 0,
      totalUnits: v.totalUnits,
    })),
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
  args: { session: string; semester: "first" | "second"; courseCodes: string[] }
) {
  const codes = args.courseCodes.map((c) => c.trim().toUpperCase());
  const courses = await Course.find({ code: { $in: codes }, university: student.university });

  if (courses.length === 0) {
    return { success: false, message: "None of those course codes were found for the student's university." };
  }

  await StudentCourse.bulkWrite(
    courses.map((course) => ({
      updateOne: {
        filter: { student: student._id, course: course._id },
        update: {
          $setOnInsert: {
            student: student._id,
            course: course._id,
            session: args.session,
            semester: args.semester,
          },
        },
        upsert: true,
      },
    }))
  );

  const foundCodes = courses.map((c) => c.code);
  const notFound = codes.filter((c) => !foundCodes.includes(c));

  return { success: true, enrolled: foundCodes, notFound };
}

export async function recordGrade(
  student: StudentDoc,
  args: { courseCode: string; session: string; semester: "first" | "second"; creditUnits: number; grade: string }
) {
  const course = await Course.findOne({
    code: new RegExp(`^${args.courseCode.trim().replace(/\s+/g, "\\s*")}$`, "i"),
    university: student.university,
  });
  if (!course) return { success: false, message: "That course wasn't found for the student's university." };

  if (!Object.keys(GRADE_POINTS).includes(args.grade.toUpperCase())) {
    return { success: false, message: "Invalid grade letter — must be one of A, B, C, D, E, F." };
  }

  await GradeRecord.findOneAndUpdate(
    { student: student._id, course: course._id, session: args.session, semester: args.semester },
    { creditUnits: args.creditUnits, grade: args.grade.toUpperCase() },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  return { success: true };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  student: StudentDoc
): Promise<unknown> {
  switch (name) {
    case "search_course_materials":
      return searchCourseMaterials(args as { courseCode?: string; topic?: string });
    case "get_document_link":
      return getDocumentLink(args as { documentId: string });
    case "get_timetable":
      return getTimetable(student);
    case "get_assignments":
      return getAssignments(student);
    case "mark_assignment_done":
      return markAssignmentDone(student, args as { assignmentId: string });
    case "get_cgpa":
      return getCgpa(student);
    case "get_profile":
      return getProfile(student);
    case "enroll_in_courses":
      return enrollInCourses(
        student,
        args as { session: string; semester: "first" | "second"; courseCodes: string[] }
      );
    case "record_grade":
      return recordGrade(
        student,
        args as {
          courseCode: string;
          session: string;
          semester: "first" | "second";
          creditUnits: number;
          grade: string;
        }
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
