import type { IssueState, WorkflowState } from "@/lib/types";

export const STATE_STYLES: Record<string, string> = {
  started: "bg-amber-50 text-amber-700",
  unstarted: "bg-slate-100 text-slate-700",
  backlog: "bg-slate-50 text-slate-500",
  triage: "bg-violet-50 text-violet-700",
  completed: "bg-emerald-50 text-emerald-700",
  canceled: "bg-slate-50 text-slate-400 line-through",
  duplicate: "bg-slate-50 text-slate-400 line-through",
};

const BASE = "w-28 shrink-0 truncate rounded px-1.5 py-0.5 text-center text-xs";

/**
 * Status badge that doubles as a dropdown of the issue's own team workflow states
 * (in Linear's order). Read-only when onChange is omitted or no states are known.
 */
export default function StatusBadge({
  state,
  states,
  onChange,
  disabled = false,
  label,
}: {
  state: IssueState;
  states?: WorkflowState[];
  onChange?: (stateId: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const style = STATE_STYLES[state.type] ?? STATE_STYLES.unstarted;
  if (!onChange || !states?.length) {
    return <span className={`${BASE} ${style}`}>{state.name}</span>;
  }
  // Keep the current state selectable even if it is missing from the team list.
  const options = states.some((s) => s.id === state.id) ? states : [{ ...state, position: -1 }, ...states];
  return (
    <select
      aria-label={label ?? "Status"}
      title="Change status"
      value={state.id}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${BASE} ${style} cursor-pointer appearance-none hover:ring-1 hover:ring-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-wait disabled:opacity-70`}
    >
      {options.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
