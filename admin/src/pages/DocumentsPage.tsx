import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search,
  Trash2,
  ExternalLink,
  Download,
  FileText,
  Loader2,
  Filter,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { fetchDocuments, deleteDocument, updateDocument } from "../services/api";
import { PDFDoc } from "../types";

const LEVELS = ["", "100", "200", "300", "400", "500"];
const SEMESTERS = ["", "first", "second"];

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["documents", search, levelFilter, semesterFilter],
    queryFn: () =>
      fetchDocuments({
        search: search || undefined,
        level: levelFilter || undefined,
        semester: semesterFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setConfirmDelete(null);
    },
    onError: () => toast.error("Delete failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateDocument(id, { title }),
    onSuccess: () => {
      toast.success("Document updated");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setEditingDocId(null);
      setEditingTitle("");
    },
    onError: () => toast.error("Update failed"),
  });

  const docs = data?.documents || [];

  const startEditing = (doc: PDFDoc) => {
    setConfirmDelete(null);
    setEditingDocId(doc._id);
    setEditingTitle(doc.title);
  };

  const cancelEditing = () => {
    setEditingDocId(null);
    setEditingTitle("");
  };

  const saveTitle = (doc: PDFDoc) => {
    const title = editingTitle.trim();

    if (!title) {
      toast.error("Document name is required");
      return;
    }

    if (title === doc.title) {
      cancelEditing();
      return;
    }

    updateMutation.mutate({ id: doc._id, title });
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Documents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {data?.count ?? 0} PDF{data?.count !== 1 ? "s" : ""} in the library
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, course code, topic..."
            className="input pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={15} className="text-zinc-500" />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="select w-36"
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l ? `${l} Level` : "All Levels"}</option>
            ))}
          </select>

          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="select w-40"
          >
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>{s ? `${s.charAt(0).toUpperCase() + s.slice(1)} Semester` : "All Semesters"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : docs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No documents found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Document
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Course
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Level / Sem
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Downloads
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {docs.map((doc: PDFDoc) => {
                const isEditing = editingDocId === doc._id;

                return (
                <tr key={doc._id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={15} className="text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2 max-w-md">
                            <input
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveTitle(doc);
                                if (event.key === "Escape") cancelEditing();
                              }}
                              className="input h-9"
                              autoFocus
                              aria-label="Document name"
                            />
                            <button
                              type="button"
                              onClick={() => saveTitle(doc)}
                              disabled={updateMutation.isPending}
                              className="btn-primary h-9 px-3"
                              title="Save name"
                            >
                              {updateMutation.isPending ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Save size={15} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={updateMutation.isPending}
                              className="btn-ghost h-9 px-3"
                              title="Cancel"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-zinc-100 max-w-xs truncate">
                            {doc.title}
                          </p>
                        )}
                        {doc.tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {doc.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-xs bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-sm font-mono text-brand-400">{doc.courseCode}</p>
                    <p className="text-xs text-zinc-500">{doc.courseName}</p>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-1">
                      {doc.level}L
                    </span>
                    <span className="ml-1.5 text-xs text-zinc-600 capitalize">{doc.semester}</span>
                  </td>

                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatBytes(doc.fileSize)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                      <Download size={13} />
                      {doc.downloadCount}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={doc.cloudinaryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost p-2"
                        title="Open PDF"
                      >
                        <ExternalLink size={15} />
                      </a>

                      <button
                        type="button"
                        onClick={() => startEditing(doc)}
                        disabled={isEditing || updateMutation.isPending}
                        className="btn-ghost p-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Rename document"
                      >
                        <Pencil size={15} />
                      </button>

                      {confirmDelete === doc._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(doc._id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg px-2 py-1 transition"
                          >
                            {deleteMutation.isPending ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 rounded-lg px-2 py-1 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(doc._id)}
                          className="btn-danger p-2"
                          title="Delete"
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
