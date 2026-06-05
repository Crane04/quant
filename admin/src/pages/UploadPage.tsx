import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { Upload, FileText, X, CheckCircle2, Loader2 } from "lucide-react";
import { uploadDocument } from "../services/api";

const LEVELS = ["100", "200", "300", "400", "500"];

const initialForm = {
  title: "",
  courseCode: "",
  courseName: "",
  faculty: "General",
  department: "",
  level: "",
  semester: "",
  tags: "",
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(typeof initialForm === "object" ? { ...initialForm } : initialForm);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setUploaded(false);
      // Auto-fill title from filename
      const name = accepted[0].name.replace(/\.pdf$/i, "").replace(/_/g, " ");
      setForm((f) => ({ ...f, title: f.title || name }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Please select a PDF");

    const required = ["title", "courseCode", "courseName", "department", "level", "semester"] as const;
    for (const key of required) {
      if (!form[key]) return toast.error(`${key} is required`);
    }

    setLoading(true);
    try {
      await uploadDocument(file, form);
      toast.success("PDF uploaded successfully!");
      setFile(null);
      setForm({ ...initialForm });
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

        {/* Form */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Document Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Fluid Mechanics Week 3 Lecture Notes"
                className="input"
              />
            </div>

            <div>
              <label className="label">Course Code *</label>
              <input
                name="courseCode"
                value={form.courseCode}
                onChange={handleChange}
                placeholder="e.g. CVE 301"
                className="input uppercase"
              />
            </div>

            <div>
              <label className="label">Course Name *</label>
              <input
                name="courseName"
                value={form.courseName}
                onChange={handleChange}
                placeholder="e.g. Fluid Mechanics"
                className="input"
              />
            </div>

            <div>
              <label className="label">Department *</label>
              <input
                name="department"
                value={form.department}
                onChange={handleChange}
                placeholder="e.g. Computer Science"
                className="input"
              />
            </div>

            <div>
              <label className="label">Level *</label>
              <select name="level" value={form.level} onChange={handleChange} className="select">
                <option value="">Select level</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l} Level</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Semester *</label>
              <select name="semester" value={form.semester} onChange={handleChange} className="select">
                <option value="">Select semester</option>
                <option value="first">First Semester</option>
                <option value="second">Second Semester</option>
              </select>
            </div>

            <div>
              <label className="label">Tags</label>
              <input
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="week1, lecture, thermodynamics"
                className="input"
              />
              <p className="text-xs text-zinc-600 mt-1">Comma-separated</p>
            </div>
          </div>
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
