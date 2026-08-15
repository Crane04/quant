import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  Pencil,
  Save,
  Search,
  Trash2,
  UserRound,
  XCircle,
  X,
} from "lucide-react";
import { deleteStudent, fetchStudents, updateStudent } from "../services/api";
import { Student, StudentUpdatePayload } from "../types";

const LEVELS = ["", "100", "200", "300", "400", "500"];

const editableFields = ["fullName", "university", "department", "level"] as const;

const getInitialForm = (student: Student): Record<(typeof editableFields)[number], string> => ({
  fullName: student.fullName || "",
  university: student.university || "",
  department: student.department || "",
  level: student.level || "",
});

const formatDate = (value?: string) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const buildUpdatePayload = (form: ReturnType<typeof getInitialForm>): StudentUpdatePayload => ({
  fullName: form.fullName.trim(),
  university: form.university.trim(),
  department: form.department.trim(),
  level: form.level,
});

export default function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof getInitialForm> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["students", search, levelFilter, departmentFilter],
    queryFn: () =>
      fetchStudents({
        search: search || undefined,
        level: levelFilter || undefined,
        department: departmentFilter || undefined,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StudentUpdatePayload }) =>
      updateStudent(id, updates),
    onSuccess: () => {
      toast.success("Student updated");
      setEditingId(null);
      setForm(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("Could not update student"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      toast.success("Student deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: () => toast.error("Could not delete student"),
  });

  const students = data?.data || [];

  const startEditing = (student: Student) => {
    setConfirmDelete(null);
    setEditingId(student.id);
    setForm(getInitialForm(student));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(null);
  };

  const saveStudent = (event: FormEvent, student: Student) => {
    event.preventDefault();

    if (!form) return;
    if (!form.fullName.trim()) {
      toast.error("Name is required");
      return;
    }

    updateMutation.mutate({ id: student.id, updates: buildUpdatePayload(form) });
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Students</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {students.length} registered student{students.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, email, matric no..."
            className="input pl-9"
          />
        </div>

        <input
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          placeholder="Department"
          className="input w-44"
        />

        <select
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
          className="select w-36"
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level ? `${level} Level` : "All Levels"}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="card p-12 text-center">
          <UserRound size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No students found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Student</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Academic Profile</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Verification</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Registered</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {students.map((student) => {
                const isEditing = editingId === student.id;

                if (isEditing && form) {
                  return (
                    <tr key={student.id} className="bg-zinc-800/20">
                      <td colSpan={5} className="px-4 py-4">
                        <form onSubmit={(event) => saveStudent(event, student)} className="grid grid-cols-6 gap-3 items-end">
                          <div className="col-span-2">
                            <label className="label">Name</label>
                            <input
                              value={form.fullName}
                              onChange={(event) => setForm((current) => current && { ...current, fullName: event.target.value })}
                              className="input"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="label">University</label>
                            <input
                              value={form.university}
                              onChange={(event) => setForm((current) => current && { ...current, university: event.target.value })}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label">Department</label>
                            <input
                              value={form.department}
                              onChange={(event) => setForm((current) => current && { ...current, department: event.target.value })}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label">Level</label>
                            <select
                              value={form.level}
                              onChange={(event) => setForm((current) => current && { ...current, level: event.target.value })}
                              className="select"
                            >
                              {LEVELS.map((level) => (
                                <option key={level} value={level}>
                                  {level || "Unset"}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={updateMutation.isPending}
                              className="btn-primary h-10 px-3"
                              title="Save student"
                            >
                              {updateMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={updateMutation.isPending}
                              className="btn-ghost h-10 px-3"
                              title="Cancel"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={student.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center">
                          <UserRound size={15} className="text-brand-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate max-w-[180px]">{student.fullName}</p>
                          <p className="text-xs text-zinc-500 font-mono">{student.phone}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <GraduationCap size={14} className="text-zinc-500" />
                        <span>{student.level ? `${student.level}L` : "Unset"}</span>
                        <span className="text-zinc-600">/</span>
                        <span>{student.department || "No department"}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {student.university || "No university set"} · {student.matricNumber}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`flex items-center gap-1 ${student.isPhoneVerified ? "text-green-400" : "text-zinc-500"}`}>
                          {student.isPhoneVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Phone
                        </span>
                        <span className={`flex items-center gap-1 ${student.isEmailVerified ? "text-green-400" : "text-zinc-500"}`}>
                          {student.isEmailVerified ? <CheckCircle2 size={13} /> : <XCircle size={13} />} Email
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(student.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(student)}
                          className="btn-ghost p-2"
                          title="Edit student"
                        >
                          <Pencil size={15} />
                        </button>

                        {confirmDelete === student.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => deleteMutation.mutate(student.id)}
                              disabled={deleteMutation.isPending}
                              className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg px-2 py-1 transition"
                            >
                              {deleteMutation.isPending ? "..." : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-zinc-500 hover:text-zinc-300 rounded-lg px-2 py-1 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(student.id)}
                            className="btn-danger p-2"
                            title="Delete student"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
