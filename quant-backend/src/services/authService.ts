import { Student, StudentDoc } from "../models/Student";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { parseDuration } from "../utils/duration";
import {
  createSession,
  revokeAllSessions as revokeActorSessions,
} from "../utils/session";
import { issueOtp, verifyOtp } from "./otpService";
import { hashPassword, verifyPassword } from "../utils/password";
import { logger } from "../utils/logger";

export interface StudentSessionPayload {
  sub: string;
  phone: string;
}

interface RegisterInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  matricNumber: string;
  university: string;
  department: string;
  level: string;
  referredByCode?: string;
}

export async function registerStudent(
  input: RegisterInput,
  isBotOrigin = false,
): Promise<StudentDoc> {
  const existing = await Student.findOne({
    $or: [
      { phone: input.phone },
      { email: input.email },
      { matricNumber: input.matricNumber },
    ],
  });
  if (existing) {
    throw ApiError.conflict(
      "An account with this phone, email, or matric number already exists",
    );
  }

  const { password, ...rest } = input;
  const passwordHash = await hashPassword(password);

  // The bot already knows this phone is real — it's the WhatsApp number the student is
  // chatting from — so it's marked verified without an OTP round-trip. The web onboarding
  // flow doesn't verify phone at all: create account -> verify email -> login.
  const student = await Student.create({
    ...rest,
    passwordHash,
    isPhoneVerified: isBotOrigin,
  });

  await issueOtp(student.email, "email", "email_verification");

  return student;
}

export async function verifyPhone(
  phone: string,
  code: string,
): Promise<StudentDoc> {
  await verifyOtp(phone, "registration", code);
  const student = await Student.findOneAndUpdate(
    { phone },
    { isPhoneVerified: true },
    { new: true },
  );
  if (!student) throw ApiError.notFound("Student not found");
  return student;
}

export async function verifyEmail(
  email: string,
  code: string,
): Promise<StudentDoc> {
  await verifyOtp(email, "email_verification", code);
  const student = await Student.findOneAndUpdate(
    { email },
    { isEmailVerified: true },
    { new: true },
  );
  if (!student) throw ApiError.notFound("Student not found");
  return student;
}

export async function login(email: string, password: string) {
  const student = await Student.findOne({ email: email.toLowerCase().trim() });
  if (!student) throw ApiError.unauthorized("Invalid email or password");

  const isValidPassword = await verifyPassword(password, student.passwordHash);
  if (!isValidPassword)
    throw ApiError.unauthorized("Invalid email or password");

  if (!student.isEmailVerified) {
    throw ApiError.forbidden("Complete email verification before logging in");
  }
  if (!student.isAmbassador) {
    throw ApiError.forbidden("The web portal is available to ambassadors only");
  }

  student.lastSeenAt = new Date();
  await student.save();

  return issueSessionToken(student);
}

// Doesn't reveal whether the email is registered — always resolves the same
// way, so a caller can't use this to enumerate accounts.
export async function requestPasswordReset(email: string): Promise<void> {
  const student = await Student.findOne({ email: email.toLowerCase().trim() });
  if (!student) return;

  // Swallow send failures here — letting one propagate would 500 the endpoint
  // only when the email genuinely exists, which defeats the point of always
  // responding identically regardless of whether the account is real.
  try {
    await issueOtp(student.email, "email", "password_reset");
  } catch (err) {
    logger.error("Failed to send password-reset email", {
      email: student.email,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await verifyOtp(email, "password_reset", code);

  const student = await Student.findOne({ email: email.toLowerCase().trim() });
  if (!student) throw ApiError.notFound("Student not found");

  student.passwordHash = await hashPassword(newPassword);
  await student.save();

  // A password reset is a good moment to force re-login everywhere, in case the
  // reset was prompted by a compromised account.
  await revokeActorSessions("Student", student._id.toString());
}

export async function issueSessionToken(student: StudentDoc) {
  const token = await createSession(
    "Student",
    student._id.toString(),
    parseDuration(env.STUDENT_SESSION_EXPIRES_IN),
  );
  return { token, student };
}

export async function revokeAllSessions(studentId: string): Promise<void> {
  await revokeActorSessions("Student", studentId);
}
