import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Bell,
  CalendarClock,
  Loader2,
  Megaphone,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { deleteAnnouncement, fetchAnnouncements } from "../services/api";
import { Announcement } from "../types";

const TYPE_TABS: { value: Announcement["type"] | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "lecture_alert", label: "Lecture Alerts" },
  { value: "announcement", label: "Announcements" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const creatorName = (announcement: Announcement) => {
  if (!announcement.createdBy || typeof announcement.createdBy === "string")
    return announcement.createdByType;
  return (
    announcement.createdBy.fullName ||
    announcement.createdBy.email ||
    announcement.createdByType
  );
};

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<Announcement["type"] | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["announcements", typeFilter, departmentFilter],
    queryFn: () =>
      fetchAnnouncements({
        type: typeFilter || undefined,
        department: departmentFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      toast.success("Announcement removed");
      qc.invalidateQueries({ queryKey: ["announcements"] });
      setConfirmDelete(null);
    },
    onError: () => toast.error("Could not remove announcement"),
  });

  const announcements = data || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Announcements</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {announcements.length} post{announcements.length !== 1 ? "s" : ""}{" "}
          from ambassadors, across every class
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1 border-b border-zinc-800">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                typeFilter === tab.value
                  ? "border-brand-500 text-brand-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          placeholder="Filter by department"
          className="input w-52 ml-auto"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card p-12 text-center">
          <Megaphone size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No announcements found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a._id} className="card p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                {a.type === "lecture_alert" ? (
                  <Bell size={16} className="text-brand-400" />
                ) : (
                  <Megaphone size={16} className="text-brand-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">{a.title}</p>
                  <span
                    className={`text-xs rounded px-2 py-0.5 flex-shrink-0 ${
                      a.sentAt
                        ? "bg-green-500/10 text-green-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {a.sentAt ? "Sent" : "Pending send"}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">{a.message}</p>
                {a.course && (
                  <p className="text-xs font-mono text-zinc-500 mt-1">
                    {a.course.code}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={12} /> {creatorName(a)}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserRound size={12} /> {a.university} · {a.department} ·{" "}
                    {a.level}L
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarClock size={12} /> {formatDate(a.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0">
                {confirmDelete === a._id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => deleteMutation.mutate(a._id)}
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
                    onClick={() => setConfirmDelete(a._id)}
                    className="btn-danger p-2"
                    title="Remove announcement"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
