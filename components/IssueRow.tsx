import { isDone, isOverdue } from "@/lib/dashboard";
import type { Issue, WorkflowState } from "@/lib/types";
import PriorityBadge from "./PriorityBadge";
import StatusBadge from "./StatusBadge";

function formatDue(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function IssueRow({
  issue,
  showAssignee,
  today,
  onPriorityChange,
  states,
  onStatusChange,
  pending = false,
  error,
  onDismissError,
}: {
  issue: Issue;
  showAssignee: boolean;
  today: string;
  onPriorityChange?: (priority: number) => void;
  states?: WorkflowState[];
  onStatusChange?: (stateId: string) => void;
  pending?: boolean;
  error?: string;
  onDismissError?: () => void;
}) {
  const done = isDone(issue);
  const overdue = isOverdue(issue, today);
  return (
    <li className="px-4 py-2 text-sm">
      <div className={`flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
        <PriorityBadge
          priority={issue.priority}
          onChange={onPriorityChange}
          disabled={pending}
          label={`Priority for ${issue.identifier}`}
        />
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="w-20 shrink-0 font-mono text-xs text-slate-500 hover:text-indigo-600 hover:underline"
        >
          {issue.identifier}
        </a>
        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate hover:underline"
          title={issue.title}
        >
          {issue.title}
        </a>
        {showAssignee && (
          <span className="w-36 shrink-0 truncate text-slate-600">
            {issue.assignee?.name ?? <span className="italic text-slate-400">Unassigned</span>}
          </span>
        )}
        <StatusBadge
          state={issue.state}
          states={states}
          onChange={onStatusChange}
          disabled={pending}
          label={`Status for ${issue.identifier}`}
        />
        <span
          className={`w-16 shrink-0 text-right text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}
          title={overdue ? "Overdue" : undefined}
        >
          {issue.dueDate ? formatDue(issue.dueDate) : ""}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 flex items-center gap-2 pl-[4.75rem] text-xs text-red-600">
          {error}
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="text-red-400 hover:text-red-700"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          )}
        </p>
      )}
    </li>
  );
}
