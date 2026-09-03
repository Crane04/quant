import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Coins,
  Crown,
  Loader2,
  Medal,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import { fetchStudents } from "../services/api";

const RANK_ICON = [Crown, Trophy, Medal];
const RANK_COLOR = ["text-amber-400", "text-zinc-300", "text-orange-400"];

export default function LeaderboardPage() {
  const [ambassadorsOnly, setAmbassadorsOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["students", "leaderboard"],
    queryFn: () => fetchStudents(),
  });

  const ranked = useMemo(() => {
    const students = data?.data || [];
    const filtered = ambassadorsOnly
      ? students.filter((s) => s.isAmbassador)
      : students;
    return [...filtered].sort((a, b) => b.points - a.points);
  }, [data, ambassadorsOnly]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Leaderboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Top contributors by points
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={ambassadorsOnly}
            onChange={(e) => setAmbassadorsOnly(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 accent-brand-600"
          />
          Ambassadors only
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : ranked.length === 0 ? (
        <div className="card p-12 text-center">
          <Trophy size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No students to rank yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-16">
                  Rank
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Tokens
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {ranked.map((student, index) => {
                const RankIcon = RANK_ICON[index];
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {RankIcon ? (
                        <RankIcon size={18} className={RANK_COLOR[index]} />
                      ) : (
                        <span className="text-sm text-zinc-500 pl-1">
                          #{index + 1}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-100">
                          {student.fullName}
                        </p>
                        {student.isAmbassador && (
                          <ShieldCheck size={13} className="text-brand-400" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        {student.level ? `${student.level}L` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {student.department || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-zinc-200">
                        <Star size={13} className="text-amber-400" />
                        {student.points}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                        <Coins size={13} />
                        {student.tokens}
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
