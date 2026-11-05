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
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-red-700">
          <li>In Linear: Settings &rarr; Security &amp; access &rarr; Personal API keys &rarr; create a key.</li>
          <li>
            Put it in <code className="rounded bg-red-100 px-1">.env.local</code> as{" "}
            <code className="rounded bg-red-100 px-1">LINEAR_API_KEY=lin_api_...</code>
          </li>
          <li>Restart <code className="rounded bg-red-100 px-1">npm run dev</code>.</li>
        </ol>
      )}
    </div>
  );
}
