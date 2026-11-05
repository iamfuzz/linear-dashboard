"use client";

import { useActionState } from "react";
import { saveApiKey, type SetupState } from "@/app/actions";

const initialState: SetupState = { error: null };

export default function SetupForm() {
  const [state, formAction, pending] = useActionState(saveApiKey, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="apiKey" className="block text-sm font-medium text-slate-800">
        Linear API key
      </label>
      <input
        id="apiKey"
        name="apiKey"
        type="password"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="lin_api_..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {state.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Checking with Linear..." : "Save key"}
      </button>
    </form>
  );
}
