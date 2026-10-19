import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Search } from "lucide-react";
import { fetchCourses, updateDocument } from "../services/api";

// For documents saved without a course (Drive imports whose names had no
// course code): search the catalogue and attach one, so the document can be approved.
export default function CourseAssigner({ documentId }: { documentId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["courses", "search", search],
    queryFn: () => fetchCourses({ search }),
    enabled: open && search.trim().length > 1,
  });

  const assign = useMutation({
    mutationFn: (courseId: string) => updateDocument(documentId, { courseId }),
    onSuccess: (doc) => {
      toast.success(`Moved to ${doc.course?.code ?? "course"}`);
      qc.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
    },
    onError: () => toast.error("Could not set the course"),
  });

  if (!open) {
    return (
      <>
        <p className="text-sm text-amber-400">No course</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-brand-400 hover:text-brand-300 underline mt-0.5"
        >
          Set course
        </button>
      </>
    );
  }

  return (
    <div className="w-56">
      <div className="relative">
        <Search
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Course code or title"
          className="input h-8 pl-8 text-xs"
          autoFocus
        />
        {(isFetching || assign.isPending) && (
          <Loader2
            size={13}
            className="animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        )}
      </div>
      {data?.data && data.data.length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto border border-zinc-800 rounded-lg divide-y divide-zinc-800/50">
          {data.data.slice(0, 8).map((course) => (
            <button
              key={course._id}
              type="button"
              disabled={assign.isPending}
              onClick={() => assign.mutate(course._id)}
              className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-800/50 transition"
            >
              <p className="text-xs font-mono text-brand-400">{course.code}</p>
              <p className="text-xs text-zinc-500 truncate">
                {course.title} · {course.level}L · {course.session}
              </p>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-zinc-500 hover:text-zinc-300 mt-1"
      >
        Cancel
      </button>
    </div>
  );
}
