import { StudentDoc } from "../models/Student";

export function formatWelcome(): string {
  return (
    "👋 Welcome to *Quant* — your course material assistant.\n\n" +
    "Let's get you registered. What's your full name?"
  );
}

export function formatRegistrationPrompt(
  field: "email" | "matric" | "university" | "department" | "level"
): string {
  switch (field) {
    case "email":
      return "What's your email address?";
    case "matric":
      return "What's your matric number?";
    case "university":
      return "Which university/institution are you in?";
    case "department":
      return "What department?";
    case "level":
      return "What level are you? (e.g. 100, 200, 300)";
  }
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
    "Ask me anything — \"send me MEE 305 pdfs\", \"what's my timetable\", \"what assignments do I have\", " +
    "\"what's my CGPA\", or \"enroll me in MEE 305 for 2024/2025 first semester\". No menus, just ask."
  );
}
