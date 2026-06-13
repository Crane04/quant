import { IStudent, Student } from "../models/Student";

export type StudentProfileInput = {
  name: string;
  school: string;
  faculty: string;
  department: string;
  level: string;
  currentCgpa: number;
};

export type AssignmentInput = {
  courseCode: string;
  description: string;
  dueDate: Date;
};

const requiredProfileFields = [
  "name",
  "school",
  "faculty",
  "department",
  "level",
  "currentCgpa",
] as const;

export const touchStudentActivity = async (phoneNumber: string): Promise<void> => {
  await Student.findOneAndUpdate(
    { phoneNumber },
    { lastActive: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export const getStudentByPhone = async (phoneNumber: string): Promise<IStudent | null> => {
  return Student.findOne({ phoneNumber });
};

export const isProfileComplete = (student: IStudent | null): boolean => {
  if (!student) return false;

  return requiredProfileFields.every((field) => {
    const value = student[field];
    return value !== undefined && value !== null && `${value}`.trim().length > 0;
  });
};

export const upsertStudentProfile = async (
  phoneNumber: string,
  profile: StudentProfileInput
) => {
  return Student.findOneAndUpdate(
    { phoneNumber },
    {
      ...profile,
      lastActive: new Date(),
      registeredAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export const updateStudentProfileField = async (
  phoneNumber: string,
  field: keyof StudentProfileInput,
  value: string | number
) => {
  return Student.findOneAndUpdate(
    { phoneNumber },
    { [field]: value, lastActive: new Date() },
    { new: true }
  );
};

export const addStudentAssignment = async (
  phoneNumber: string,
  assignment: AssignmentInput
) => {
  return Student.findOneAndUpdate(
    { phoneNumber },
    {
      $push: {
        assignments: {
          ...assignment,
          reminderSent: false,
          createdAt: new Date(),
        },
      },
      lastActive: new Date(),
    },
    { new: true }
  );
};

export const setStudentCgpaTarget = async (phoneNumber: string, targetCgpa: number) => {
  return Student.findOneAndUpdate(
    { phoneNumber },
    { targetCgpa, lastActive: new Date() },
    { new: true }
  );
};
