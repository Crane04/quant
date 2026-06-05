import { Student } from "../models/Student";

export const touchStudentActivity = async (phoneNumber: string): Promise<void> => {
  await Student.findOneAndUpdate(
    { phoneNumber },
    { lastActive: new Date() },
    { upsert: true, setDefaultsOnInsert: true }
  );
};
