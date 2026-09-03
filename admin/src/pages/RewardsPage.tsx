import { useQuery } from "@tanstack/react-query";
import { Gift, Loader2, Ticket, Coins, Shirt } from "lucide-react";
import { fetchAllRedemptions } from "../services/api";
import { Reward, RewardRedemption } from "../types";

const TYPE_ICON: Record<Reward["type"], typeof Ticket> = {
  token_conversion: Coins,
  voucher: Ticket,
  merchandise: Shirt,
};

const formatDate = (value?: string) => {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function RewardsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["redemptions"],
    queryFn: fetchAllRedemptions,
  });

  const redemptions = data || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">
          Reward Redemptions
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {redemptions.length} redemption{redemptions.length !== 1 ? "s" : ""} —
          vouchers & merchandise fulfillment queue
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : redemptions.length === 0 ? (
        <div className="card p-12 text-center">
          <Gift size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No redemptions yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Reward
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {redemptions.map((r: RewardRedemption) => {
                const reward = typeof r.reward === "object" ? r.reward : null;
                const student =
                  typeof r.student === "object" ? r.student : null;
                const Icon = reward ? TYPE_ICON[reward.type] : Gift;

                return (
                  <tr
                    key={r._id}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-zinc-100">
                        {student?.fullName || "Unknown"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {student?.email || student?.phone}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                          <Icon size={13} className="text-brand-400" />
                        </div>
                        <span className="text-sm text-zinc-200">
                          {reward?.name || "Unknown reward"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {r.selectedSize && <p>Size: {r.selectedSize}</p>}
                      {r.voucherCode && (
                        <p className="font-mono text-xs">{r.voucherCode}</p>
                      )}
                      {r.expiresAt && (
                        <p className="text-xs text-zinc-600">
                          Expires {formatDate(r.expiresAt)}
                        </p>
                      )}
                      {r.failureReason && (
                        <p className="text-xs text-red-400">
                          {r.failureReason}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-300">
                      {r.pointsCost}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`text-xs rounded px-2 py-1 capitalize ${
                          r.status === "success"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatDate(r.createdAt)}
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
