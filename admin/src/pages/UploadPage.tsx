import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Upload, FileText, X, CheckCircle2, Loader2, Search, PlusCircle } from "lucide-react";
import { fetchCourses, uploadDocument } from "../services/api";
import { CourseRef, UploadPayload } from "../types";

const LEVELS = ["100", "200", "300", "400", "500"];

const initialDocForm = { title: "", tags: "" };

const initialNewCourseForm = {
  courseCode: "",
  courseTitle: "",
  university: "",
  department: "",
  level: "",
  session: "",
  semester: "",
  creditUnits: "",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [docForm, setDocForm] = useState(initialDocForm);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CourseRef | null>(null);
  const [newCourseForm, setNewCourseForm] = useState(initialNewCourseForm);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const { data: courseResults, isFetching: searchingCourses } = useQuery({
    queryKey: ["courses", "search", courseSearch],
    queryFn: () => fetchCourses({ search: courseSearch }),
    enabled: mode === "existing" && courseSearch.trim().length > 1,
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setUploaded(false);
      const name = accepted[0].name.replace(/\.pdf$/i, "").replace(/_/g, " ");
      setDocForm((f) => ({ ...f, title: f.title || name }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleNewCourseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewCourseForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const resetForm = () => {
    setDocForm(initialDocForm);
    setNewCourseForm(initialNewCourseForm);
    setSelectedCourse(null);
    setCourseSearch("");
    setMode("existing");
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Please select a PDF");
    if (!docForm.title) return toast.error("title is required");

    let payload: UploadPayload;

    if (mode === "existing") {
      if (!selectedCourse) return toast.error("Select a course, or switch to \"New course\"");
      payload = { title: docForm.title, tags: docForm.tags, courseId: selectedCourse._id };
    } else {
      const required = [
        "courseCode",
        "courseTitle",
        "university",
        "department",
        "level",
        "session",
        "semester",
        "creditUnits",
      ] as const;
      for (const key of required) {
        if (!newCourseForm[key]) return toast.error(`${key} is required`);
      }
      payload = {
        title: docForm.title,
        tags: docForm.tags,
        courseCode: newCourseForm.courseCode,
        courseTitle: newCourseForm.courseTitle,
        university: newCourseForm.university,
        department: newCourseForm.department,
        level: newCourseForm.level,
        session: newCourseForm.session,
        semester: newCourseForm.semester as "first" | "second",
        creditUnits: Number(newCourseForm.creditUnits),
      };
    }

    setLoading(true);
    try {
      await uploadDocument(file, payload);
      toast.success("PDF uploaded successfully!");
      setFile(null);
      resetForm();
      setUploaded(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(2) : null;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Upload PDF</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Add course material to the student library
        </p>
      </div>

      <div className="space-y-6">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-brand-500 bg-brand-500/5"
              : file
              ? "border-zinc-700 bg-zinc-900"
              : "border-zinc-700 hover:border-zinc-600 bg-zinc-900"
          }`}
        >
          <input {...getInputProps()} />

          {file ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <FileText size={20} className="text-red-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-100">{file.name}</p>
                  <p className="text-xs text-zinc-500">{fileSizeMB} MB</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={32} className="mx-auto text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-400">
                {isDragActive ? "Drop the PDF here" : "Drag & drop a PDF, or click to browse"}
              </p>
              <p className="text-xs text-zinc-600 mt-1">Max 50 MB</p>
            </div>
          )}
        </div>

        {/* Document details */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Document Details</h2>

          <div>
            <label className="label">Title *</label>
            <input
              value={docForm.title}
              onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Fluid Mechanics Week 3 Lecture Notes"
              className="input"
            />
          </div>

          <div>
            <label className="label">Tags</label>
            <input
              value={docForm.tags}
              onChange={(e) => setDocForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="week1, lecture, thermodynamics"
              className="input"
            />
            <p className="text-xs text-zinc-600 mt-1">Comma-separated</p>
          </div>
        </div>

        {/* Course */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Course</h2>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`px-2.5 py-1 rounded-lg transition ${
                  mode === "existing" ? "bg-brand-500/15 text-brand-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Existing course
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                  mode === "new" ? "bg-brand-500/15 text-brand-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <PlusCircle size={13} /> New course
              </button>
            </div>
          </div>

          {mode === "existing" ? (
            <div>
              <label className="label">Search by code or title *</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={selectedCourse ? `${selectedCourse.code} — ${selectedCourse.title}` : courseSearch}
                  onChange={(e) => {
                    setSelectedCourse(null);
                    setCourseSearch(e.target.value);
                  }}
                  placeholder="e.g. CVE 301"
                  className="input pl-9"
                />
                {searchingCourses && (
                  <Loader2 size={15} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                )}
              </div>

              {!selectedCourse && (courseResults?.data.length ?? 0) > 0 && (
                <div className="mt-2 border border-zinc-800 rounded-lg divide-y divide-zinc-800/50 overflow-hidden">
                  {courseResults!.data.map((course) => (
                    <button
                      type="button"
                      key={course._id}
                      onClick={() => {
                        setSelectedCourse(course);
                        setCourseSearch("");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-800/50 transition"
                    >
                      <p className="text-sm text-zinc-200">
                        {course.code} — {course.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {course.university} · {course.department} · {course.level}L · {course.session} ·{" "}
                        {course.semester}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Course Code *</label>
                <input
                  name="courseCode"
                  value={newCourseForm.courseCode}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. CVE 301"
                  className="input uppercase"
                />
              </div>

              <div>
                <label className="label">Course Title *</label>
                <input
                  name="courseTitle"
                  value={newCourseForm.courseTitle}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. Fluid Mechanics"
                  className="input"
                />
              </div>

              <div>
                <label className="label">University *</label>
                <input
                  name="university"
                  value={newCourseForm.university}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. University of Lagos"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Department *</label>
                <input
                  name="department"
                  value={newCourseForm.department}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. Computer Science"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Level *</label>
                <select name="level" value={newCourseForm.level} onChange={handleNewCourseChange} className="select">
                  <option value="">Select level</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l} Level</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Semester *</label>
                <select name="semester" value={newCourseForm.semester} onChange={handleNewCourseChange} className="select">
                  <option value="">Select semester</option>
                  <option value="first">First Semester</option>
                  <option value="second">Second Semester</option>
                </select>
              </div>

              <div>
                <label className="label">Session *</label>
                <input
                  name="session"
                  value={newCourseForm.session}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. 2025/2026"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Credit Units *</label>
                <input
                  name="creditUnits"
                  type="number"
                  min="1"
                  value={newCourseForm.creditUnits}
                  onChange={handleNewCourseChange}
                  placeholder="e.g. 3"
                  className="input"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button onClick={handleSubmit} disabled={loading || !file} className="btn-primary">
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload PDF
              </>
            )}
          </button>

          {uploaded && (
            <div className="flex items-center gap-2 text-brand-400 text-sm">
              <CheckCircle2 size={16} />
              Uploaded successfully
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
