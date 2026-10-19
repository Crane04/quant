import { StudentDoc } from "../models/Student";
import { SIGNUP_BONUS_QUANTS } from "./quantService";

// Quant is live for one school + faculty. Anyone can sign up; everyone else is
// waitlisted (bonus credited, but no bot access) until their school/faculty launches.
export const LIVE_UNIVERSITY = "LASU";
const LIVE_FACULTY = "Engineering";

export type AccessStatus = "full" | "waitlist_school" | "waitlist_faculty";

/** "Lagos State University", "lasu" -> "LASU"; anything else is kept as typed. */
export function normalizeUniversity(university: string): string {
  const value = university.trim();
  return /\blasu\b|lagos\s+state\s+univ/i.test(value) ? LIVE_UNIVERSITY : value;
}

/**
 * Faculty as stored on Student. Signup paths that don't ask for it (the API,
 * older clients) fall back to the department: "Mechanical Engineering" is
 * unambiguously Engineering.
 */
export function normalizeFaculty(
  faculty: string | undefined,
  department: string,
): string {
  const value = faculty?.trim();
  if (value) return /engineer/i.test(value) ? LIVE_FACULTY : value;
  return /engineer/i.test(department) ? LIVE_FACULTY : "Unknown";
}

export function getAccessStatus(
  student: Pick<StudentDoc, "university" | "faculty">,
): AccessStatus {
  // No faculty = signed up before signup was opened up, when only LASU
  // Engineering could register. Keep their access.
  if (!student.faculty) return "full";
  if (normalizeUniversity(student.university) !== LIVE_UNIVERSITY) {
    return "waitlist_school";
  }
  return student.faculty === LIVE_FACULTY ? "full" : "waitlist_faculty";
}

const bonus = SIGNUP_BONUS_QUANTS.toLocaleString("en-NG");

export function waitlistMessage(status: Exclude<AccessStatus, "full">): string {
  return status === "waitlist_school"
    ? `Quant is coming to your school soon! Before then, you have received a welcome bonus of ${bonus} Quant tokens to kickstart your journey. Happy learning!`
    : `Quant is currently live for Faculty of Engineering and coming to your faculty soon! We have credited your wallet with ${bonus} Quant tokens ahead of launch. Happy learning!`;
}
