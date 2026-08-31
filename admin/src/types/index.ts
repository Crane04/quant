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

export type DocumentCategory = "lecture_note" | "exam_summary" | "past_question" | "other";
export type DocumentStatus = "pending" | "approved" | "rejected";

export interface UploaderRef {
  _id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  matricNumber?: string;
}

export interface PDFDoc {
  _id: string;
  title: string;
  course: CourseRef | null;
  fileUrl: string;
  fileType: string;
  sizeBytes: number;
  tags: string[];
  downloadCount: number;
  category: DocumentCategory;
  uploadedByType: "Admin" | "Student";
  uploadedBy: UploaderRef | string | null;
  status: DocumentStatus;
  pointsAwarded: number;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type UploadPayload = {
  title: string;
  category: DocumentCategory;
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
  isAmbassador: boolean;
  isVerifiedContributor: boolean;
  points: number;
  tokens: number;
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
  isAmbassador: boolean;
  isVerifiedContributor: boolean;
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

export interface PointsBalance {
  points: number;
  tokens: number;
  lifetimePointsEarned: number;
  uploadStreakDays: number;
}

export interface PointsTransactionEntry {
  _id: string;
  type: "document_approved" | "badge_bonus" | "reward_redeemed" | "admin_adjustment";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface BadgeEntry {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond" | "obsidian";
  points: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface Reward {
  _id: string;
  key: string;
  name: string;
  description: string;
  type: "token_conversion" | "voucher" | "merchandise";
  pointsCost: number;
  tokensGranted?: number;
  requiresSize: boolean;
  sizes: string[];
  active: boolean;
}

export interface RewardRedemption {
  _id: string;
  student: UploaderRef | string | null;
  reward: Reward | string | null;
  pointsCost: number;
  status: "success" | "failed";
  selectedSize?: string;
  voucherCode?: string;
  expiresAt?: string;
  failureReason?: string;
  createdAt: string;
}

export interface Announcement {
  _id: string;
  type: "lecture_alert" | "announcement";
  title: string;
  message: string;
  course?: CourseRef;
  university: string;
  department: string;
  level: string;
  createdByType: "Student" | "Admin";
  createdBy: UploaderRef | string | null;
  sentAt?: string | null;
  createdAt: string;
}
