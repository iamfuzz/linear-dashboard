"use client";

import { useState, useTransition } from "react";
import { quitApp } from "@/app/actions";

// Shown only in the packaged Mac app, which has no window of its own to close.
export default function QuitButton() {
  const [pending, startTransition] = useTransition();
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (stopped) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Linear Dashboard has stopped.</p>
          <p className="mt-1 text-sm text-slate-600">
            You can close this tab. Open the app again to restart it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const res = await quitApp();
              if (res.ok) setStopped(true);
              else setError(res.error ?? "Could not quit.");
            } catch {
              setStopped(true); // the server may exit before the response arrives
            }
          })
        }
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Quitting..." : "Quit"}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </>
  );
}
