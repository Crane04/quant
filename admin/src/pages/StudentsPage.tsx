import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  BadgeCheck,
  CheckCircle2,
  Coins,
  GraduationCap,
  Loader2,
  Lock,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import {
  deleteStudent,
  fetchStudentBadges,
  fetchStudentPoints,
  fetchStudentPointsHistory,
  fetchStudents,
  updateStudent,
} from "../services/api";
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

function StudentDetailModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { data: points, isLoading: loadingPoints } = useQuery({
    queryKey: ["points", student.id],
    queryFn: () => fetchStudentPoints(student.id),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["points-history", student.id],
    queryFn: () => fetchStudentPointsHistory(student.id, 20),
  });

  const { data: badges, isLoading: loadingBadges } = useQuery({
    queryKey: ["badges", student.id],
    queryFn: () => fetchStudentBadges(student.id),
  });

  const earnedBadges = (badges || []).filter((b) => b.earned);
  const lockedBadges = (badges || []).filter((b) => !b.earned);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{student.fullName}</h2>
            <p className="text-xs text-zinc-500">{student.email}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Points summary */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Points & Tokens</h3>
            {loadingPoints ? (
              <Loader2 size={18} className="animate-spin text-zinc-600" />
            ) : points ? (
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-lg font-semibold text-zinc-100">{points.points}</p>
                  <p className="text-xs text-zinc-500">Points</p>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-lg font-semibold text-zinc-100">{points.tokens}</p>
                  <p className="text-xs text-zinc-500">Tokens</p>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-lg font-semibold text-zinc-100">{points.lifetimePointsEarned}</p>
                  <p className="text-xs text-zinc-500">Lifetime</p>
                </div>
                <div className="rounded-lg border border-zinc-800 p-3">
                  <p className="text-lg font-semibold text-zinc-100">{points.uploadStreakDays}</p>
                  <p className="text-xs text-zinc-500">Streak (days)</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No data</p>
            )}
          </div>

          {/* Points history */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Recent Activity</h3>
            {loadingHistory ? (
              <Loader2 size={18} className="animate-spin text-zinc-600" />
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-zinc-500">No points activity yet</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry._id}
                    className="flex items-center justify-between text-sm border-b border-zinc-800/50 pb-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-200 truncate">{entry.description}</p>
                      <p className="text-xs text-zinc-600">{formatDate(entry.createdAt)}</p>
                    </div>
                    <span className={entry.amount >= 0 ? "text-green-400" : "text-red-400"}>
                      {entry.amount >= 0 ? "+" : ""}
                      {entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Badges */}
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Badges {badges ? `(${earnedBadges.length}/${badges.length})` : ""}
            </h3>
            {loadingBadges ? (
              <Loader2 size={18} className="animate-spin text-zinc-600" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[...earnedBadges, ...lockedBadges].map((badge) => (
                  <div
                    key={badge.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      badge.earned ? "border-brand-500/30 bg-brand-500/5" : "border-zinc-800 opacity-50"
                    }`}
                  >
                    {badge.earned ? (
                      <Trophy size={14} className="text-brand-400 flex-shrink-0" />
                    ) : (
                      <Lock size={14} className="text-zinc-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{badge.name}</p>
                      <p className="text-xs text-zinc-600 capitalize">{badge.tier}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReturnType<typeof getInitialForm> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

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

  const toggleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: StudentUpdatePayload }) =>
      updateStudent(id, updates),
    onSuccess: () => {
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

  const toggleAmbassador = (student: Student) => {
    toggleMutation.mutate({ id: student.id, updates: { isAmbassador: !student.isAmbassador } });
  };

  const toggleVerifiedContributor = (student: Student) => {
    toggleMutation.mutate({
      id: student.id,
      updates: { isVerifiedContributor: !student.isVerifiedContributor },
    });
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
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Roles</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase">Points</th>
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
                      <td colSpan={7} className="px-4 py-4">
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
                      <button
                        type="button"
                        onClick={() => setDetailStudent(student)}
                        className="flex items-center gap-3 text-left"
                        title="View points & badges"
                      >
                        <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                          <UserRound size={15} className="text-brand-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-100 truncate max-w-[180px] hover:underline">
                            {student.fullName}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono">{student.phone}</p>
                        </div>
                      </button>
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

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleAmbassador(student)}
                          disabled={toggleMutation.isPending}
                          className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 w-fit transition ${
                            student.isAmbassador
                              ? "bg-brand-500/15 text-brand-400"
                              : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                          title="Toggle ambassador status (web portal + uploads)"
                        >
                          <ShieldCheck size={12} /> Ambassador
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVerifiedContributor(student)}
                          disabled={toggleMutation.isPending}
                          className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1 w-fit transition ${
                            student.isVerifiedContributor
                              ? "bg-purple-500/15 text-purple-400"
                              : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                          title="Toggle verified contributor badge"
                        >
                          <BadgeCheck size={12} /> Verified
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-zinc-300">
                        <Star size={13} className="text-amber-400" />
                        {student.points}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-0.5">
                        <Coins size={11} />
                        {student.tokens} tokens
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(student.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(student)}
                          className="btn-ghost p-2"
                          title="View points & badges"
                        >
                          <Sparkles size={15} />
                        </button>

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

      {detailStudent && (
        <StudentDetailModal student={detailStudent} onClose={() => setDetailStudent(null)} />
      )}
    </div>
  );
}
