"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  validatePriorityUpdate,
  validateStatusUpdate,
  type PriorityUpdateResult,
  type StatusUpdateResult,
} from "@/lib/dashboard";
import {
  clearDashboardCache,
  updateIssuePriority,
  updateIssueStatus,
  validateApiKey,
} from "@/lib/linear";
import { checkApiKeyFormat, saveApiKeyToKeychain } from "@/lib/secret";
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

export type SetupState = { error: string | null };

// First-run / "Change API key": check the key with Linear (read-only viewer query), then
// store it in the macOS Keychain. The key is never echoed back or logged.
export async function saveApiKey(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const check = checkApiKeyFormat(formData.get("apiKey"));
  if (!check.ok) return { error: check.error };
  try {
    await validateApiKey(check.key);
  } catch (err) {
    if (err instanceof LinearError && err.kind === "invalid_key") {
      return {
        error:
          "Linear rejected this key. Check that you copied the whole key and that it has not been revoked.",
      };
    }
    return {
      error:
        err instanceof LinearError
          ? `Could not check the key with Linear. ${err.message}`
          : "Could not check the key with Linear. Check your internet connection and try again.",
    };
  }
  try {
    await saveApiKeyToKeychain(check.key);
  } catch {
    return { error: "The key works, but it could not be saved to the macOS Keychain." };
  }
  clearDashboardCache();
  redirect("/"); // outside try/catch: redirect() throws by design
}

/** True when running as the packaged Mac app (set by the launcher). */
function isPackagedApp(): boolean {
  return process.env.LINEAR_DASHBOARD_APP === "1";
}

// Stops the local server. Only allowed in the packaged app, so it cannot stop `npm run dev`.
export async function quitApp(): Promise<{ ok: boolean; error?: string }> {
  if (!isPackagedApp()) return { ok: false, error: "Quit is only available in the Mac app." };
  setTimeout(() => process.exit(0), 300); // let this response reach the browser first
  return { ok: true };
}
