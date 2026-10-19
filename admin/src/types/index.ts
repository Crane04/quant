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

export type DocumentCategory =
  "lecture_note" | "exam_summary" | "past_question" | "other";
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
  faculty?: string;
  department: string;
  level: string;
  accessStatus: "full" | "waitlist_school" | "waitlist_faculty";
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isAmbassador: boolean;
  isVerifiedContributor: boolean;
  isHOC: boolean;
  points: number;
  quants: number;
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
  isHOC: boolean;
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
  quants: number;
  lifetimePointsEarned: number;
  uploadStreakDays: number;
}

export interface PointsTransactionEntry {
  _id: string;
  type:
    | "document_approved"
    | "badge_bonus"
    | "reward_redeemed"
    | "admin_adjustment";
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
  quantsGranted?: number;
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

export interface QuantPricing {
  billingEnabled: boolean;
  perMessage: number;
  per100Chars: number;
  per1kInputTokens: number;
  per1kOutputTokens: number;
  maxPerMessage: number; // 0 = no cap
  updatedAt?: string;
}

export interface QuantUsageStats {
  days: number;
  messages: number;
  avgCharged: number;
  avgInputChars: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
}

export type QuantTransactionType =
  | "topup"
  | "chat_message"
  | "reward_conversion"
  | "admin_adjustment"
  | "signup_bonus";

export interface QuantTransactionEntry {
  _id: string;
  type: QuantTransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  adjustedBy?: { _id: string; email: string } | null;
  createdAt: string;
}

export interface QuantTransactionRow extends QuantTransactionEntry {
  student: { _id: string; fullName: string; phone: string; email: string } | null;
  // Populated Payment for top-ups (other ref types aren't shown)
  refId?: { _id: string; amount?: number; txRef?: string } | null;
  refType?: "Payment" | "RewardRedemption";
}

export interface QuantTransactionsResponse {
  items: QuantTransactionRow[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  totals: Partial<Record<QuantTransactionType, { count: number; quants: number }>>;
}

export type DriveImportCategory = DocumentCategory | "auto";

export type DriveImportItemStatus =
  | "pending"
  | "imported"
  | "unassigned"
  | "duplicate"
  | "no_course"
  | "unsupported"
  | "failed";

export interface DriveImportItem {
  driveFileId: string;
  name: string;
  path: string;
  mimeType: string;
  status: DriveImportItemStatus;
  reason?: string;
  courseCode?: string;
  document?: string;
}

export interface DriveImport {
  _id: string;
  url: string;
  folderName?: string;
  category: DriveImportCategory;
  status: "running" | "completed" | "failed";
  error?: string;
  createdCourses?: { code: string; course: string }[];
  summary: { total: number } & Partial<Record<DriveImportItemStatus, number>>;
  items?: DriveImportItem[];
  createdBy?: { _id: string; email: string } | null;
  createdAt: string;
  finishedAt?: string;
}
