"use server";

import { refresh } from "next/cache";
import {
  validatePriorityUpdate,
  validateStatusUpdate,
  type PriorityUpdateResult,
  type StatusUpdateResult,
} from "@/lib/dashboard";
import { clearDashboardCache, updateIssuePriority, updateIssueStatus } from "@/lib/linear";
import { LinearError } from "@/lib/types";

export async function refreshDashboard() {
  clearDashboardCache();
  refresh();
}

// Server actions are reachable by any client, so treat both arguments as untrusted.
export async function setIssuePriority(
  id: unknown,
  priority: unknown,
): Promise<PriorityUpdateResult> {
  const v = validatePriorityUpdate(id, priority);
  if (!v.ok) return v;
  try {
    await updateIssuePriority(v.id, v.priority); // also clears the in-memory cache
  } catch (err) {
    const message =
      err instanceof LinearError ? err.message : "Could not update priority in Linear.";
    return { ok: false, error: message };
  }
  refresh();
  return { ok: true };
}

// Untrusted input; updateIssueStatus also checks the state belongs to the issue's team.
export async function setIssueStatus(id: unknown, stateId: unknown): Promise<StatusUpdateResult> {
  const v = validateStatusUpdate(id, stateId);
  if (!v.ok) return v;
  try {
    await updateIssueStatus(v.id, v.stateId); // also clears the in-memory cache
  } catch (err) {
    const message =
      err instanceof LinearError ? err.message : "Could not update status in Linear.";
    return { ok: false, error: message };
  }
  refresh();
  return { ok: true };
}
