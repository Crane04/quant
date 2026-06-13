export interface PDFDoc {
  _id: string;
  title: string;
  courseCode: string;
  courseName: string;
  faculty: string;
  department: string;
  level: "100" | "200" | "300" | "400" | "500";
  semester: "first" | "second";
  tags: string[];
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadPayload {
  title: string;
  courseCode: string;
  courseName: string;
  faculty: string;
  department: string;
  level: string;
  semester: string;
  tags: string;
}

export interface DocumentsResponse {
  success: boolean;
  count: number;
  documents: PDFDoc[];
}

export interface StudentAssignment {
  _id?: string;
  courseCode: string;
  description: string;
  dueDate: string;
  reminderSent: boolean;
  createdAt: string;
}

export interface Student {
  _id: string;
  phoneNumber: string;
  name: string;
  school?: string;
  campus?: string;
  faculty?: string;
  matricNumber?: string;
  department?: string;
  level?: "100" | "200" | "300" | "400" | "500";
  semester?: "first" | "second";
  currentCgpa?: number;
  targetCgpa?: number;
  assignments?: StudentAssignment[];
  registeredAt: string;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentsResponse {
  success: boolean;
  count: number;
  students: Student[];
}

export type StudentUpdatePayload = Partial<{
  name: string;
  school: string;
  campus: string;
  faculty: string;
  department: string;
  level: string;
  currentCgpa: number | string;
  targetCgpa: number | string;
}>;

export type AdminRole = "super_admin" | "admin";

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  admin: AdminUser;
}

export interface AdminsResponse {
  success: boolean;
  admins: AdminUser[];
}
