import { StudentSessionPayload } from "../services/authService";
import { SafeAdmin } from "../services/adminAuthService";

declare global {
  namespace Express {
    interface Request {
      student?: StudentSessionPayload;
      isBotService?: boolean;
      studentId?: string;
      admin?: SafeAdmin;
    }
  }
}

export {};
