type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "neutral";
};

export function KpiCard({ label, value, hint, trend }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_0_rgb(0_0_0/0.07)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          {trend === "up" && (
            <span className="inline-flex items-center text-emerald-600 font-medium">↑</span>
          )}
          {trend === "down" && (
            <span className="inline-flex items-center text-red-500 font-medium">↓</span>
          )}
          {hint}
        </p>
      ) : null}
    </div>
  );
}
