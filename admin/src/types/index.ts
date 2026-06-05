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
