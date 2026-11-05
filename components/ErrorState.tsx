import Link from "next/link";
import type { LinearErrorKind } from "@/lib/types";

const TITLES: Record<LinearErrorKind, string> = {
  missing_key: "Linear API key missing",
  invalid_key: "Linear API key invalid",
  api_error: "Could not load data from Linear",
};

export default function ErrorState({ kind, message }: { kind: LinearErrorKind; message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <h2 className="mb-1 font-semibold">{TITLES[kind]}</h2>
      <p>{message}</p>
      {kind !== "api_error" && (
        <>
          <Link
            href="/setup"
            className="mt-3 inline-block rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800"
          >
            Set up your Linear API key
          </Link>
          <p className="mt-2 text-xs text-red-700">
            Developers: a <code className="rounded bg-red-100 px-1">LINEAR_API_KEY</code> in{" "}
            <code className="rounded bg-red-100 px-1">.env.local</code> takes priority over the key
            saved in the Keychain.
          </p>
        </>
      )}
    </div>
  );
}
