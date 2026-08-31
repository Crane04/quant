import { StudentDoc } from "../models/Student";

export function toStudentDTO(student: StudentDoc) {
  return {
    id: student._id.toString(),
    fullName: student.fullName,
    phone: student.phone,
    email: student.email,
    matricNumber: student.matricNumber,
    university: student.university,
    department: student.department,
    level: student.level,
    isPhoneVerified: student.isPhoneVerified,
    isEmailVerified: student.isEmailVerified,
    isAmbassador: student.isAmbassador,
    isVerifiedContributor: student.isVerifiedContributor,
    points: student.points,
    tokens: student.tokens,
    referredByCode: student.referredByCode,
    createdAt: student.createdAt,
  };
}
