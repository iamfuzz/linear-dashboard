import type { Stats } from "@/lib/dashboard";

export default function StatsBar({ stats, compact = false }: { stats: Stats; compact?: boolean }) {
  const items: [string, number, string][] = [
    ["Open", stats.open, "text-slate-700"],
    ["In progress", stats.inProgress, "text-amber-700"],
    ["Done", stats.done, "text-emerald-700"],
    ["Overdue", stats.overdue, stats.overdue ? "text-red-600" : "text-slate-400"],
  ];

  if (compact) {
    return (
      <span className="flex items-center gap-3 text-xs text-slate-500">
        {items.map(([label, n, color]) => (
          <span key={label}>
            <span className={`font-semibold ${color}`}>{n}</span> {label.toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <span
              className="block h-full bg-emerald-500"
              style={{ width: `${stats.percentDone}%` }}
            />
          </span>
          <span className="font-semibold text-slate-700">{stats.percentDone}%</span>
        </span>
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map(([label, n, color]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className={`text-2xl font-semibold ${color}`}>{n}</div>
        </div>
      ))}
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-500">% done</div>
        <div className="text-2xl font-semibold text-slate-800">{stats.percentDone}%</div>
      </div>
    </div>
  );
}
