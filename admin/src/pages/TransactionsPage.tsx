import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  MessageSquare,
  PartyPopper,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { fetchQuantTransactions } from "../services/api";
import { QuantTransactionRow, QuantTransactionType } from "../types";

const TABS: { label: string; types: QuantTransactionType[] }[] = [
  {
    label: "Credits",
    types: ["topup", "admin_adjustment", "reward_conversion", "signup_bonus"],
  },
  { label: "Top-ups", types: ["topup"] },
  { label: "Admin", types: ["admin_adjustment"] },
  { label: "Rewards", types: ["reward_conversion"] },
  { label: "Signup bonus", types: ["signup_bonus"] },
  { label: "Chat charges", types: ["chat_message"] },
  { label: "All", types: [] },
];

const TYPE_META: Record<
  QuantTransactionType,
  { label: string; icon: typeof Receipt; className: string }
> = {
  topup: {
    label: "Top-up",
    icon: CreditCard,
    className: "bg-green-500/10 text-green-400",
  },
  admin_adjustment: {
    label: "Admin",
    icon: ShieldCheck,
    className: "bg-brand-500/10 text-brand-400",
  },
  reward_conversion: {
    label: "Reward",
    icon: Gift,
    className: "bg-amber-500/10 text-amber-400",
  },
  signup_bonus: {
    label: "Signup bonus",
    icon: PartyPopper,
    className: "bg-pink-500/10 text-pink-400",
  },
  chat_message: {
    label: "Chat",
    icon: MessageSquare,
    className: "bg-zinc-700/40 text-zinc-400",
  },
};

const PAGE_SIZE = 25;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatNumber = (n: number) => n.toLocaleString("en-NG");

function details(t: QuantTransactionRow): string {
  if (t.type === "topup" && t.refId) {
    const paid = t.refId.amount !== undefined ? `₦${formatNumber(t.refId.amount)} paid` : "";
    return [paid, t.refId.txRef].filter(Boolean).join(" · ");
  }
  if (t.type === "admin_adjustment") {
    return t.adjustedBy?.email
      ? `${t.description} · by ${t.adjustedBy.email}`
      : t.description;
  }
  return t.description;
}

export default function TransactionsPage() {
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const types = TABS[tab].types;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["quant-transactions", types, page],
    queryFn: () => fetchQuantTransactions({ type: types, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const totals = data?.totals ?? {};
  const topups = totals.topup;
  const admin = totals.admin_adjustment;
  const rewards = totals.reward_conversion;
  const chat = totals.chat_message;

  const summaryCards = [
    topups && {
      label: "Topped up",
      value: `₦${formatNumber(topups.quants)}`,
      sub: `${topups.count} payment${topups.count === 1 ? "" : "s"}`,
    },
    admin && {
      label: "Admin credits (net)",
      value: `${admin.quants >= 0 ? "+" : ""}${formatNumber(admin.quants)} quants`,
      sub: `${admin.count} adjustment${admin.count === 1 ? "" : "s"}`,
    },
    rewards && {
      label: "From rewards",
      value: `${formatNumber(rewards.quants)} quants`,
      sub: `${rewards.count} conversion${rewards.count === 1 ? "" : "s"}`,
    },
    chat && {
      label: "Spent on chat",
      value: `${formatNumber(Math.abs(chat.quants))} quants`,
      sub: `${chat.count} message${chat.count === 1 ? "" : "s"}`,
    },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  const rows = data?.items ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Transactions</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Every quant movement — Flutterwave top-ups, admin credits, reward
          conversions and chat charges (₦1 = 1 quant).
        </p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => {
              setTab(i);
              setPage(1);
            }}
            className={
              i === tab
                ? "rounded-lg px-3 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-100"
                : "btn-ghost py-1.5"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {summaryCards.length > 0 && (
        <div className="grid gap-3 mb-6 grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((c) => (
            <div key={c.label} className="card p-4">
              <p className="text-xs text-zinc-500">{c.label}</p>
              <p className="text-lg font-semibold text-zinc-100 mt-1">{c.value}</p>
              <p className="text-xs text-zinc-600">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Receipt size={40} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No transactions yet</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Date", "Student", "Type", "Quants", "Balance after", "Details"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-zinc-800/50 ${isFetching ? "opacity-60" : ""}`}
            >
              {rows.map((t) => {
                const meta = TYPE_META[t.type];
                const Icon = meta.icon;
                return (
                  <tr key={t._id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-zinc-400 whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-zinc-100">
                        {t.student?.fullName || "Deleted student"}
                      </p>
                      <p className="text-xs text-zinc-500">{t.student?.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                        t.amount >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {formatNumber(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {formatNumber(t.balanceAfter)}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 max-w-xs truncate">
                      {details(t)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <span>
            Page {data.page} of {data.pages} · {formatNumber(data.total)} transactions
          </span>
          <div className="flex gap-2">
            <button
              className="btn-ghost disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              className="btn-ghost disabled:opacity-40"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
