import { Student, StudentDoc } from "../models/Student";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { parseDuration } from "../utils/duration";
import { createSession, revokeAllSessions as revokeActorSessions } from "../utils/session";
import { issueOtp, verifyOtp } from "./otpService";

export interface StudentSessionPayload {
  sub: string;
  phone: string;
}

interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  matricNumber: string;
  university: string;
  department: string;
  level: string;
}

export async function registerStudent(input: RegisterInput, isBotOrigin = false): Promise<StudentDoc> {
  const existing = await Student.findOne({
    $or: [{ phone: input.phone }, { email: input.email }, { matricNumber: input.matricNumber }],
  });
  if (existing) {
    throw ApiError.conflict("An account with this phone, email, or matric number already exists");
  }

  // The bot already knows this phone is real — it's the WhatsApp number the student is
  // chatting from — so it's marked verified without an OTP round-trip. The web onboarding
  // flow doesn't verify phone at all: create account -> verify email -> login.
  const student = await Student.create({ ...input, isPhoneVerified: isBotOrigin });

  await issueOtp(student.email, "email", "email_verification");

  return student;
}

export async function verifyPhone(phone: string, code: string): Promise<StudentDoc> {
  await verifyOtp(phone, "registration", code);
  const student = await Student.findOneAndUpdate(
    { phone },
    { isPhoneVerified: true },
    { new: true }
  );
  if (!student) throw ApiError.notFound("Student not found");
  return student;
}

export async function verifyEmail(email: string, code: string): Promise<StudentDoc> {
  await verifyOtp(email, "email_verification", code);
  const student = await Student.findOneAndUpdate(
    { email },
    { isEmailVerified: true },
    { new: true }
  );
  if (!student) throw ApiError.notFound("Student not found");
  return student;
}

export async function requestLoginOtp(phone: string): Promise<void> {
  const student = await Student.findOne({ phone });
  if (!student) throw ApiError.notFound("No account found for this phone number");
  if (!student.isEmailVerified) {
    throw ApiError.forbidden("Complete email verification before logging in");
  }
  if (!student.isAmbassador) {
    throw ApiError.forbidden("The web portal is available to ambassadors only");
  }
  await issueOtp(phone, "phone", "login");
}

export async function verifyLoginOtp(phone: string, code: string) {
  await verifyOtp(phone, "login", code);
  const student = await Student.findOne({ phone });
  if (!student) throw ApiError.notFound("Student not found");
  if (!student.isAmbassador) {
    throw ApiError.forbidden("The web portal is available to ambassadors only");
  }

  student.lastSeenAt = new Date();
  await student.save();

  return issueSessionToken(student);
}

export async function issueSessionToken(student: StudentDoc) {
  const token = await createSession(
    "Student",
    student._id.toString(),
    parseDuration(env.STUDENT_SESSION_EXPIRES_IN)
  );
  return { token, student };
}

export async function revokeAllSessions(studentId: string): Promise<void> {
  await revokeActorSessions("Student", studentId);
}
