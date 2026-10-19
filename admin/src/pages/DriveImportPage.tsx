import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { ChevronRight, FolderDown, Loader2 } from "lucide-react";
import {
  fetchDriveImport,
  fetchDriveImports,
  startDriveImport,
} from "../services/api";
import {
  DriveImport,
  DriveImportCategory,
  DriveImportItem,
  DriveImportItemStatus,
} from "../types";

const CATEGORIES: { value: DriveImportCategory; label: string }[] = [
  { value: "auto", label: "Detect from file name" },
  { value: "lecture_note", label: "Lecture Note" },
  { value: "exam_summary", label: "Exam Summary" },
  { value: "past_question", label: "Past Question" },
  { value: "other", label: "Other" },
];

const STATUS_META: Record<
  DriveImportItemStatus,
  { label: string; className: string }
> = {
  pending: { label: "Waiting", className: "bg-zinc-700/40 text-zinc-400" },
  imported: { label: "Imported", className: "bg-green-500/10 text-green-400" },
  unassigned: {
    label: "Saved, needs course",
    className: "bg-amber-500/10 text-amber-400",
  },
  duplicate: {
    label: "Already have it",
    className: "bg-zinc-700/40 text-zinc-300",
  },
  no_course: {
    label: "No course match",
    className: "bg-amber-500/10 text-amber-400",
  },
  unsupported: {
    label: "Unsupported",
    className: "bg-zinc-700/40 text-zinc-500",
  },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-400" },
};

const FILTERS: { label: string; statuses: DriveImportItemStatus[] }[] = [
  { label: "All", statuses: [] },
  { label: "Imported", statuses: ["imported", "unassigned"] },
  { label: "Skipped", statuses: ["duplicate", "unsupported"] },
  { label: "Needs attention", statuses: ["unassigned", "no_course", "failed"] },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

function StatusBadge({ status }: { status: DriveImportItemStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

const progressOf = (job: DriveImport) => {
  const done = job.summary.total - (job.summary.pending ?? 0);
  const percent = job.summary.total
    ? Math.round((done / job.summary.total) * 100)
    : 0;
  return { done, percent };
};

function ImportStatus({ job }: { job: DriveImport }) {
  const { done } = progressOf(job);
  if (job.status === "running") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-brand-400 flex-shrink-0">
        <Loader2 size={13} className="animate-spin" />
        Importing {done}/{job.summary.total}
      </span>
    );
  }
  if (job.status === "failed") {
    return <span className="text-xs text-red-400 flex-shrink-0">Stopped</span>;
  }
  return <span className="text-xs text-green-400 flex-shrink-0">Done</span>;
}

function SummaryChips({ job }: { job: DriveImport }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(STATUS_META) as DriveImportItemStatus[])
        .filter((status) => status !== "pending" && job.summary[status])
        .map((status) => (
          <span
            key={status}
            className={`px-2 py-0.5 rounded-md text-xs ${STATUS_META[status].className}`}
          >
            {job.summary[status]} {STATUS_META[status].label.toLowerCase()}
          </span>
        ))}
    </div>
  );
}

/** Notices, filters and the per-file table: only rendered once a row is opened. */
function ImportBody({ job }: { job: DriveImport }) {
  const [filter, setFilter] = useState(0);
  const items = job.items ?? [];
  const statuses = FILTERS[filter].statuses;
  const visible = statuses.length
    ? items.filter((item) => statuses.includes(item.status))
    : items;

  return (
    <div className="space-y-4 pt-4">
      <a
        href={job.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-zinc-500 hover:text-zinc-300 truncate block"
      >
        {job.url}
      </a>
      {job.error && <p className="text-xs text-red-400">{job.error}</p>}

      {(job.summary.unassigned ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-300">
            {job.summary.unassigned} file
            {job.summary.unassigned === 1 ? " has" : "s have"} no course code,
            so {job.summary.unassigned === 1 ? "it was" : "they were"} saved as
            pending without a course. Set one for each in{" "}
            <Link to="/documents" className="underline hover:text-amber-200">
              Documents
            </Link>{" "}
            (Pending Review), then approve.
          </p>
        </div>
      )}

      {job.createdCourses && job.createdCourses.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-300">
            Created {job.createdCourses.length} new course
            {job.createdCourses.length === 1 ? "" : "s"} for codes we didn't
            have. They're titled with just the code, so update their titles
            and details in{" "}
            <Link to="/courses" className="underline hover:text-amber-200">
              Courses
            </Link>
            .
          </p>
          <p className="text-xs font-mono text-amber-400/80 mt-1.5">
            {job.createdCourses.map((c) => c.code).join(", ")}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setFilter(i)}
            className={`px-2.5 py-1 rounded-lg transition ${
              filter === i
                ? "bg-brand-600/20 text-brand-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-auto max-h-[28rem]">
        <table className="w-full">
          <thead className="sticky top-0 bg-zinc-900">
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                File
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Course
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {visible.map((item: DriveImportItem) => (
              <tr key={item.driveFileId} className="align-top">
                <td className="px-4 py-2.5">
                  <p className="text-sm text-zinc-200 break-all">{item.name}</p>
                  {item.path && (
                    <p className="text-xs text-zinc-600 break-all">
                      {item.path}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-sm font-mono text-brand-400">
                  {item.courseCode ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={item.status} />
                  {item.reason && item.status !== "duplicate" && (
                    <p className="text-xs text-zinc-500 mt-1">{item.reason}</p>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-sm text-zinc-600"
                >
                  Nothing here
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function ImportRow({
  summary,
  open,
  onToggle,
}: {
  summary: DriveImport;
  open: boolean;
  onToggle: () => void;
}) {
  // Per-file items are only fetched for an open row; polled while it runs.
  const { data: detail } = useQuery({
    queryKey: ["drive-import", summary._id],
    queryFn: () => fetchDriveImport(summary._id),
    enabled: open,
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? 2000 : false,
  });
  const job = detail ?? summary;
  const { percent } = progressOf(job);

  return (
    <div className="card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 space-y-2.5"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <ChevronRight
            size={15}
            className={`text-zinc-500 flex-shrink-0 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100 truncate">
              {job.folderName || "Drive import"}
            </p>
            <p className="text-xs text-zinc-500">
              {job.summary.total} files · {formatDate(job.createdAt)}
            </p>
          </div>
          <ImportStatus job={job} />
        </div>
        {job.status === "running" && (
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden ml-7">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        <div className="ml-7">
          <SummaryChips job={job} />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-zinc-800">
          {detail ? (
            <ImportBody job={detail} />
          ) : (
            <div className="py-6 flex justify-center">
              <Loader2 size={16} className="animate-spin text-zinc-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DriveImportPage() {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<DriveImportCategory>("auto");
  // Collapsed by default; the import just started opens so its progress shows.
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { data: imports } = useQuery({
    queryKey: ["drive-imports"],
    queryFn: fetchDriveImports,
    // Keeps collapsed rows' counts moving while anything is running.
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.status === "running") ? 3000 : false,
  });

  const start = useMutation({
    mutationFn: () => startDriveImport(url.trim(), category),
    onSuccess: (job) => {
      setUrl("");
      setOpenIds((prev) => new Set(prev).add(job._id));
      toast.success(`Found ${job.summary.total} files, importing…`);
      qc.invalidateQueries({ queryKey: ["drive-imports"] });
    },
    onError: (err: unknown) => {
      const apiMessage = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(apiMessage || "Could not start the import");
    },
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Drive Import</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Paste a Google Drive folder or file link. Files we already have are
          skipped; new ones are uploaded to the library.
        </p>
      </div>

      <div className="space-y-6">
        <form
          className="card p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return toast.error("Paste a Drive link first");
            start.mutate();
          }}
        >
          <div>
            <label className="label">Google Drive link *</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/…"
            />
            <p className="text-xs text-zinc-600 mt-1">
              The link must be shared as "Anyone with the link". Each file's
              course comes from the course code in its name (e.g. "MEE301
              Week 2.pdf") or its folder. Files with no code are saved for
              review in Documents, where you can set their course.
            </p>
          </div>
          <div className="max-w-xs">
            <label className="label">Category</label>
            <select
              className="select"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as DriveImportCategory)
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={start.isPending}
          >
            {start.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FolderDown size={15} />
            )}
            {start.isPending ? "Reading folder…" : "Import"}
          </button>
        </form>

        {imports && imports.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-300">Imports</h2>
            {imports.map((job) => (
              <ImportRow
                key={job._id}
                summary={job}
                open={openIds.has(job._id)}
                onToggle={() => toggle(job._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
