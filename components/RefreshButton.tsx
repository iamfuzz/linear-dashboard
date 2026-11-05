"use client";

import { useTransition } from "react";
import { refreshDashboard } from "@/app/actions";

export default function RefreshButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => refreshDashboard())}
      disabled={pending}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "Refreshing..." : "Refresh"}
    </button>
  );
}
