"use client";

import { createContext, useContext } from "react";
import type { Issue, Team } from "@/lib/types";

export interface IssueEdits {
  teams: Record<string, Team>;
  isPending: (issueId: string) => boolean;
  errors: Record<string, string>;
  dismissError: (issueId: string) => void;
  changePriority: (issue: Issue, priority: number) => void;
  changeStatus: (issue: Issue, stateId: string) => void;
}

export const IssueEditsContext = createContext<IssueEdits | null>(null);

/** Edit handlers for issue rows; null when rendered outside the Dashboard (read-only). */
export function useIssueEdits(): IssueEdits | null {
  return useContext(IssueEditsContext);
}
