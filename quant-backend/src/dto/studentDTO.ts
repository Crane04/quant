import { StudentDoc } from "../models/Student";
import { getAccessStatus } from "../services/accessService";

export function toStudentDTO(student: StudentDoc) {
  return {
    id: student._id.toString(),
    fullName: student.fullName,
    phone: student.phone,
    email: student.email,
    matricNumber: student.matricNumber,
    university: student.university,
    faculty: student.faculty,
    // "full", or which waitlist the student is on until their school/faculty launches.
    accessStatus: getAccessStatus(student),
    department: student.department,
    level: student.level,
    isPhoneVerified: student.isPhoneVerified,
    isEmailVerified: student.isEmailVerified,
    isAmbassador: student.isAmbassador,
    isVerifiedContributor: student.isVerifiedContributor,
    isHOC: student.isHOC,
    photoUrl: student.photoUrl,
    points: student.points,
    quants: student.quants,
    referredByCode: student.referredByCode,
    createdAt: student.createdAt,
  };
}
