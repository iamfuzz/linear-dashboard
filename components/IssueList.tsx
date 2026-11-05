"use client";

import { sortIssues, statesForIssue } from "@/lib/dashboard";
import type { Issue } from "@/lib/types";
import { useIssueEdits } from "./IssueEditsContext";
import IssueRow from "./IssueRow";

/**
 * Sorted list of issues with inline priority and status dropdowns per row.
 * The issues already include optimistic changes (applied in Dashboard), so a changed row
 * moves to its new place right away. Read-only when rendered outside the Dashboard.
 */
export default function IssueList({
  issues,
  showAssignee,
  today,
}: {
  issues: Issue[];
  showAssignee: boolean;
  today: string;
}) {
  const edits = useIssueEdits();
  return (
    <ul className="divide-y divide-slate-100">
      {sortIssues(issues).map((i) => (
        <IssueRow
          key={i.id}
          issue={i}
          showAssignee={showAssignee}
          today={today}
          states={edits ? statesForIssue(i, edits.teams) : undefined}
          pending={edits?.isPending(i.id) ?? false}
          error={edits?.errors[i.id]}
          onDismissError={edits ? () => edits.dismissError(i.id) : undefined}
          onPriorityChange={edits ? (p) => edits.changePriority(i, p) : undefined}
          onStatusChange={edits ? (s) => edits.changeStatus(i, s) : undefined}
        />
      ))}
    </ul>
  );
}
