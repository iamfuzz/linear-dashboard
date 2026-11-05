import { PRIORITY_LABELS, PRIORITY_VALUES } from "@/lib/dashboard";

export const PRIORITY_STYLES: Record<number, string> = {
  1: "bg-red-100 text-red-700 ring-red-200",
  2: "bg-orange-100 text-orange-700 ring-orange-200",
  3: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  4: "bg-sky-100 text-sky-700 ring-sky-200",
  0: "bg-slate-100 text-slate-500 ring-slate-200",
};

const SHORT_LABELS: Record<number, string> = { ...PRIORITY_LABELS, 0: "None" };

const BASE =
  "inline-flex w-16 shrink-0 justify-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset";

/** Priority badge that doubles as a dropdown. Read-only when onChange is omitted. */
export default function PriorityBadge({
  priority,
  onChange,
  disabled = false,
  label,
}: {
  priority: number;
  onChange?: (priority: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES[0];
  if (!onChange) {
    return <span className={`${BASE} ${style}`}>{SHORT_LABELS[priority] ?? "None"}</span>;
  }
  return (
    <select
      aria-label={label ?? "Priority"}
      title="Change priority"
      value={priority}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${BASE} ${style} cursor-pointer appearance-none text-center hover:ring-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-wait disabled:opacity-70`}
    >
      {PRIORITY_VALUES.map((p) => (
        <option key={p} value={p}>
          {p === priority ? SHORT_LABELS[p] : PRIORITY_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
