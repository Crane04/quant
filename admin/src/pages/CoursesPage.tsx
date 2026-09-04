import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BookOpen, Loader2, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import {
  CoursePayload,
  createCourse,
  deleteCourse,
  fetchCourses,
  updateCourse,
} from "../services/api";
import { CourseRef } from "../types";

const LEVELS = ["100", "200", "300", "400", "500"];

const emptyForm: CoursePayload = {
  code: "",
  title: "",
  university: "",
  department: "",
  level: "",
  session: "",
  semester: "first",
  creditUnits: 3,
};

function CourseForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
  submitting,
}: {
  initial: CoursePayload;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (payload: CoursePayload) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState(initial);

  const set = (key: keyof CoursePayload, value: string) =>
    setForm((f) => ({
      ...f,
      [key]: key === "creditUnits" ? Number(value) : value,
    }));

  const handleSubmit = () => {
    const required: (keyof CoursePayload)[] = [
      "code",
      "title",
      "university",
      "department",
      "level",
      "session",
      "semester",
    ];
    for (const key of required) {
      if (!form[key]) return toast.error(`${key} is required`);
    }
    if (!form.creditUnits || form.creditUnits < 1)
      return toast.error("Credit units must be at least 1");

    onSubmit(form);
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Course Code *</label>
          <input
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="e.g. CVE 301"
            className="input uppercase"
          />
        </div>
        <div>
          <label className="label">Course Title *</label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Fluid Mechanics"
            className="input"
          />
        </div>
        <div>
          <label className="label">University *</label>
          <input
            value={form.university}
            onChange={(e) => set("university", e.target.value)}
            placeholder="e.g. LASU"
            className="input"
          />
        </div>
        <div>
          <label className="label">Department *</label>
          <input
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
            placeholder="e.g. Mechanical Engineering"
            className="input"
          />
        </div>
        <div>
          <label className="label">Level *</label>
          <select
            value={form.level}
            onChange={(e) => set("level", e.target.value)}
            className="select"
          >
            <option value="">Select level</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l} Level
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Semester *</label>
          <select
            value={form.semester}
            onChange={(e) => set("semester", e.target.value)}
            className="select"
          >
            <option value="first">First Semester</option>
            <option value="second">Second Semester</option>
          </select>
        </div>
        <div>
          <label className="label">Session *</label>
          <input
            value={form.session}
            onChange={(e) => set("session", e.target.value)}
            placeholder="e.g. 2025/2026"
            className="input"
          />
        </div>
        <div>
          <label className="label">Credit Units *</label>
          <input
            type="number"
            min="1"
            value={form.creditUnits}
            onChange={(e) => set("creditUnits", e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
          {submitLabel}
        </button>
        <button onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["courses", search, levelFilter, semesterFilter],
    queryFn: () =>
      fetchCourses({
        search: search || undefined,
        level: levelFilter || undefined,
        semester: semesterFilter || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      toast.success("Course created");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setCreating(false);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Could not create course";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CoursePayload }) =>
      updateCourse(id, payload),
    onSuccess: () => {
      toast.success("Course updated");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setEditingId(null);
    },
    onError: () => toast.error("Could not update course"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      toast.success("Course removed");
      qc.invalidateQueries({ queryKey: ["courses"] });
      setConfirmDelete(null);
    },
    onError: () => toast.error("Could not remove course"),
  });

  const courses = data?.data || [];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Courses</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {courses.length} course{courses.length !== 1 ? "s" : ""} in the
            catalogue
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => {
              setEditingId(null);
              setCreating(true);
            }}
            className="btn-primary"
          >
            <PlusCircle size={15} />
            New Course
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-6">
          <CourseForm
            initial={emptyForm}
            submitLabel="Create Course"
            submitting={createMutation.isPending}
            onCancel={() => setCreating(false)}
            onSubmit={(payload) => createMutation.mutate(payload)}
          />
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code or title..."
          className="input w-64"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="select w-36"
        >
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l} Level
            </option>
          ))}
        </select>
        <select
          value={semesterFilter}
          onChange={(e) => setSemesterFilter(e.target.value)}
          className="select w-40"
        >
          <option value="">All Semesters</option>
          <option value="first">First Semester</option>
          <option value="second">Second Semester</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : courses.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No courses found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course: CourseRef) =>
            editingId === course._id ? (
              <CourseForm
                key={course._id}
                initial={{
                  code: course.code,
                  title: course.title,
                  university: course.university,
                  department: course.department,
                  level: course.level,
                  session: course.session,
                  semester: course.semester,
                  creditUnits: course.creditUnits,
                }}
                submitLabel="Save Changes"
                submitting={updateMutation.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={(payload) =>
                  updateMutation.mutate({ id: course._id, payload })
                }
              />
            ) : (
              <div
                key={course._id}
                className="card p-4 flex items-center gap-4"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={16} className="text-brand-400" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-brand-400">
                      {course.code}
                    </p>
                    <p className="text-sm text-zinc-200 truncate">
                      {course.title}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {course.university} · {course.department} ·{" "}
                    {course.level}L · {course.session} · {course.semester} ·{" "}
                    {course.creditUnits} unit
                    {course.creditUnits !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditingId(course._id);
                    }}
                    className="btn-ghost p-2"
                    title="Edit course"
                  >
                    <Pencil size={15} />
                  </button>

                  {confirmDelete === course._id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteMutation.mutate(course._id)}
                        disabled={deleteMutation.isPending}
                        className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg px-2 py-1 transition"
                      >
                        {deleteMutation.isPending ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 rounded-lg px-2 py-1 transition"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(course._id)}
                      className="btn-danger p-2"
                      title="Delete course"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
