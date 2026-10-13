import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Coins, Loader2, Save } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchQuantPricing, updateQuantPricing } from "../services/api";
import { QuantPricing } from "../types";

type RateField = Exclude<keyof QuantPricing, "billingEnabled" | "updatedAt">;

const RATE_FIELDS: { key: RateField; label: string; hint: string }[] = [
  {
    key: "perMessage",
    label: "Per message",
    hint: "Flat quants charged on every AI reply",
  },
  {
    key: "per100Chars",
    label: "Per 100 characters",
    hint: "Charged on the length of the student's message",
  },
  {
    key: "per1kInputTokens",
    label: "Per 1,000 AI input tokens",
    hint: "Prompt tokens Groq actually processed (includes chat history & tools)",
  },
  {
    key: "per1kOutputTokens",
    label: "Per 1,000 AI output tokens",
    hint: "Completion tokens Groq actually generated (includes reasoning)",
  },
  {
    key: "maxPerMessage",
    label: "Max per message",
    hint: "Cap on a single reply's cost — 0 means no cap",
  },
];

// Mirrors computeMessageCost in quant-backend/src/services/quantService.ts.
function computeCost(
  p: QuantPricing,
  chars: number,
  promptTokens: number,
  completionTokens: number,
) {
  const length = (chars / 100) * p.per100Chars;
  const aiTokens =
    (promptTokens / 1000) * p.per1kInputTokens +
    (completionTokens / 1000) * p.per1kOutputTokens;
  let total = Math.ceil(p.perMessage + length + aiTokens);
  if (p.maxPerMessage > 0) total = Math.min(total, p.maxPerMessage);
  return { length, aiTokens, total };
}

const fmt = (n: number) =>
  n.toLocaleString("en-NG", { maximumFractionDigits: 2 });

export default function QuantPricingPage() {
  const { admin } = useAuth();
  const canEdit = admin?.role === "super_admin";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["quant-pricing"],
    queryFn: fetchQuantPricing,
  });

  const [form, setForm] = useState<QuantPricing | null>(null);
  const [sample, setSample] = useState({
    chars: 100,
    promptTokens: 12000,
    completionTokens: 1500,
  });

  useEffect(() => {
    if (!data) return;
    setForm(data.pricing);
    // Preview a typical real message once there's usage to go on.
    if (data.stats.messages > 0) {
      setSample({
        chars: data.stats.avgInputChars,
        promptTokens: data.stats.avgPromptTokens,
        completionTokens: data.stats.avgCompletionTokens,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: updateQuantPricing,
    onSuccess: () => {
      toast.success("Pricing updated");
      qc.invalidateQueries({ queryKey: ["quant-pricing"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Could not save pricing";
      toast.error(msg);
    },
  });

  if (isLoading || !form || !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  const preview = computeCost(
    form,
    sample.chars,
    sample.promptTokens,
    sample.completionTokens,
  );
  const messagesPer1k = preview.total > 0 ? Math.floor(1000 / preview.total) : null;
  const { stats } = data;

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Quant Pricing</h1>
        <p className="text-sm text-zinc-500 mt-1">
          What one AI reply costs in quants (₦1 = 1 quant). Any rate set to 0
          is left out of the formula.
        </p>
      </div>

      <div className="card p-5 mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-100">Billing</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {form.billingEnabled
              ? "On — students are charged and blocked when out of quants."
              : "Off — chat is free; top-ups still work."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.billingEnabled}
          disabled={!canEdit}
          onClick={() =>
            setForm({ ...form, billingEnabled: !form.billingEnabled })
          }
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
            form.billingEnabled ? "bg-brand-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              form.billingEnabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-5 space-y-4">
          <p className="text-sm font-medium text-zinc-100">Rates (quants)</p>
          {RATE_FIELDS.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="label" htmlFor={key}>
                {label}
              </label>
              <input
                id={key}
                type="number"
                min={0}
                step="any"
                className="input"
                disabled={!canEdit}
                value={form[key]}
                onChange={(e) =>
                  setForm({ ...form, [key]: Math.max(0, Number(e.target.value) || 0) })
                }
              />
              <p className="text-xs text-zinc-600 mt-1">{hint}</p>
            </div>
          ))}

          {canEdit ? (
            <button
              className="btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => {
                const { updatedAt: _updatedAt, ...updates } = form;
                saveMutation.mutate(updates);
              }}
            >
              {saveMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save pricing
            </button>
          ) : (
            <p className="text-xs text-zinc-500">
              Only super admins can change pricing.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <p className="text-sm font-medium text-zinc-100">Preview</p>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["chars", "Message chars"],
                  ["promptTokens", "Input tokens"],
                  ["completionTokens", "Output tokens"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="label" htmlFor={`sample-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`sample-${key}`}
                    type="number"
                    min={0}
                    className="input"
                    value={sample[key]}
                    onChange={(e) =>
                      setSample({ ...sample, [key]: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
              ))}
            </div>

            <dl className="text-sm divide-y divide-zinc-800">
              <div className="flex justify-between py-2">
                <dt className="text-zinc-400">Per message</dt>
                <dd className="text-zinc-200">{fmt(form.perMessage)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-zinc-400">Length</dt>
                <dd className="text-zinc-200">{fmt(preview.length)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-zinc-400">AI tokens</dt>
                <dd className="text-zinc-200">{fmt(preview.aiTokens)}</dd>
              </div>
              <div className="flex justify-between py-2 font-medium">
                <dt className="text-zinc-100">
                  Charged{form.maxPerMessage > 0 ? " (after cap, rounded up)" : " (rounded up)"}
                </dt>
                <dd className="text-brand-400 flex items-center gap-1.5">
                  <Coins size={13} />
                  {preview.total} quants
                </dd>
              </div>
            </dl>
            <p className="text-xs text-zinc-500">
              {messagesPer1k === null
                ? "Messages like this are free."
                : `A ₦1,000 top-up buys about ${messagesPer1k} messages like this.`}
            </p>
          </div>

          <div className="card p-5">
            <p className="text-sm font-medium text-zinc-100 mb-3">
              Last {stats.days} days
            </p>
            {stats.messages === 0 ? (
              <p className="text-xs text-zinc-500">
                No charged messages yet. Averages appear once billing is on.
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {(
                  [
                    ["Charged messages", stats.messages],
                    ["Avg charged", `${stats.avgCharged} quants`],
                    ["Avg message chars", stats.avgInputChars],
                    ["Avg input tokens", stats.avgPromptTokens],
                    ["Avg output tokens", stats.avgCompletionTokens],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="text-zinc-200">
                      {typeof value === "number" ? fmt(value) : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
