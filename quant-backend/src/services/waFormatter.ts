import { StudentDoc } from "../models/Student";

export function formatWelcome(): string {
  return (
    "👋 Welcome to *Quant* — your course material assistant.\n\n" +
    "Let's get you registered — just send your *full name, email, matric number, " +
    "university, department, and level* all in one message, any order you like. " +
    "I'll sort it out."
  );
}

export function formatRegistrationComplete(): string {
  return (
    "✅ Almost done! I've sent a 6-digit code to your email — reply with it here to finish " +
    "verifying your account."
  );
}

export function formatEmailVerified(student: StudentDoc): string {
  return (
    `🎉 You're all set, *${student.fullName.split(" ")[0]}*!\n\n` +
    'Ask me anything — "send me MEE 305 pdfs", "what\'s my timetable", "what assignments do I have", ' +
    '"what\'s my CGPA", or "enroll me in MEE 305 for 2024/2025 first semester". No menus, just ask.'
  );
}
