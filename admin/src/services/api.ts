import axios from "axios";
import {
  AdminRole,
  AdminsResponse,
  AdminUser,
  DocumentsResponse,
  LoginResponse,
  PDFDoc,
  Student,
  StudentsResponse,
  StudentUpdatePayload,
  UploadPayload,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";
export const AUTH_TOKEN_KEY = "quant_admin_token";
export const AUTH_ADMIN_KEY = "quant_admin_user";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_ADMIN_KEY);
      window.dispatchEvent(new Event("quant-auth-expired"));
    }
    return Promise.reject(error);
  }
);

export const loginAdmin = async (email: string, password: string): Promise<LoginResponse> => {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
};

export const fetchCurrentAdmin = async (): Promise<AdminUser> => {
  const { data } = await api.get("/auth/me");
  return data.admin;
};

export const fetchDocuments = async (filters?: {
  courseCode?: string;
  level?: string;
  department?: string;
  semester?: string;
  search?: string;
}): Promise<DocumentsResponse> => {
  const { data } = await api.get("/documents", { params: filters });
  return data;
};

export const uploadDocument = async (
  file: File,
  payload: UploadPayload
): Promise<PDFDoc> => {
  const form = new FormData();
  form.append("pdf", file);
  Object.entries(payload).forEach(([k, v]) => form.append(k, v));
  const { data } = await api.post("/documents", form);
  return data.document;
};

export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}`);
};

export const updateDocument = async (
  id: string,
  updates: Partial<UploadPayload>
): Promise<PDFDoc> => {
  const { data } = await api.patch(`/documents/${id}`, updates);
  return data.document;
};

export const fetchStudents = async (filters?: {
  search?: string;
  school?: string;
  faculty?: string;
  department?: string;
  level?: string;
}): Promise<StudentsResponse> => {
  const { data } = await api.get("/students", { params: filters });
  return data;
};

export const updateStudent = async (
  id: string,
  updates: StudentUpdatePayload
): Promise<Student> => {
  const { data } = await api.patch(`/students/${id}`, updates);
  return data.student;
};

export const deleteStudent = async (id: string): Promise<void> => {
  await api.delete(`/students/${id}`);
};

export const fetchAdmins = async (): Promise<AdminsResponse> => {
  const { data } = await api.get("/admins");
  return data;
};

export const createAdmin = async (payload: {
  email: string;
  password: string;
  role: AdminRole;
}): Promise<AdminUser> => {
  const { data } = await api.post("/admins", payload);
  return data.admin;
};

export const updateAdmin = async (
  id: string,
  updates: Partial<{ role: AdminRole; isActive: boolean; password: string }>
): Promise<AdminUser> => {
  const { data } = await api.patch(`/admins/${id}`, updates);
  return data.admin;
};

export const deleteAdmin = async (id: string): Promise<void> => {
  await api.delete(`/admins/${id}`);
};
