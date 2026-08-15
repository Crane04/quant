export interface CourseRef {
  _id: string;
  code: string;
  title: string;
  university: string;
  department: string;
  level: string;
  session: string;
  semester: "first" | "second";
  creditUnits: number;
}

export interface PDFDoc {
  _id: string;
  title: string;
  course: CourseRef;
  fileUrl: string;
  fileType: string;
  sizeBytes: number;
  tags: string[];
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export type UploadPayload = {
  title: string;
  tags: string;
} & (
  | { courseId: string }
  | {
      courseCode: string;
      courseTitle: string;
      university: string;
      department: string;
      level: string;
      session: string;
      semester: "first" | "second";
      creditUnits: number;
    }
);

export interface DocumentsResponse {
  success: boolean;
  data: PDFDoc[];
}

export interface Student {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  matricNumber: string;
  university: string;
  department: string;
  level: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface StudentsResponse {
  success: boolean;
  data: Student[];
}

export type StudentUpdatePayload = Partial<{
  fullName: string;
  university: string;
  department: string;
  level: string;
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
  token: string;
  admin: AdminUser;
}

export interface AdminsResponse {
  success: boolean;
  data: AdminUser[];
}

export interface CoursesResponse {
  success: boolean;
  data: CourseRef[];
}
