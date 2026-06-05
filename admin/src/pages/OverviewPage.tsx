import { useQuery } from "@tanstack/react-query";
import { FileText, Download, BookOpen, ArrowRight } from "lucide-react";
import { fetchDocuments } from "../services/api";
import { Link } from "react-router-dom";
import { PDFDoc } from "../types";

export default function OverviewPage() {
  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: () => fetchDocuments(),
  });

  const docs = data?.documents || [];
  const totalDownloads = docs.reduce((sum: number, d: PDFDoc) => sum + d.downloadCount, 0);
  const uniqueCourses = new Set(docs.map((d: PDFDoc) => d.courseCode)).size;

  const recent = [...docs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const topDownloaded = [...docs]
    .sort((a, b) => b.downloadCount - a.downloadCount)
    .slice(0, 5);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Global material library
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total PDFs", value: data?.count ?? 0, icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Total Downloads", value: totalDownloads, icon: Download, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Courses Covered", value: uniqueCourses, icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-100">{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent uploads */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-300">Recent Uploads</h2>
            <Link to="/documents" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-zinc-600">No documents yet</p>
            ) : (
              recent.map((doc: PDFDoc) => (
                <div key={doc._id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={13} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{doc.title}</p>
                    <p className="text-xs text-zinc-500 font-mono">{doc.courseCode}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top downloaded */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Most Downloaded</h2>
          <div className="space-y-3">
            {topDownloaded.length === 0 ? (
              <p className="text-sm text-zinc-600">No downloads yet</p>
            ) : (
              topDownloaded.map((doc: PDFDoc, i: number) => (
                <div key={doc._id} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{doc.title}</p>
                    <p className="text-xs text-zinc-500 font-mono">{doc.courseCode}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Download size={11} />
                    {doc.downloadCount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
