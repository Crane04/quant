import { Course, CourseDoc } from "../models/Course";

export type CourseInput = {
  code: string;
  title: string;
  university: string;
  department: string;
  level: string;
  creditUnits: number;
  session: string;
  semester: "first" | "second";
};

/**
 * Course identity is code+university+session+semester (the model's unique
 * index). Re-uploading a document for a course that already has a catalogue
 * entry should reuse it rather than erroring or duplicating it.
 */
export async function findOrCreateCourse(
  input: CourseInput,
): Promise<CourseDoc> {
  const code = input.code.trim().toUpperCase();

  const existing = await Course.findOne({
    code,
    university: input.university,
    session: input.session,
    semester: input.semester,
  });
  if (existing) return existing as CourseDoc;

  const course = await Course.create({ ...input, code });
  return course as CourseDoc;
}
