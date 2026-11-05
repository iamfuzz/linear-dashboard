import Link from "next/link";
import { connection } from "next/server";
import QuitButton from "@/components/QuitButton";
import SetupForm from "@/components/SetupForm";
import { INITIATIVE_NAME } from "@/lib/config";
import { getKeySource } from "@/lib/secret";

export const metadata = { title: "Set up Linear API key" };

export default async function SetupPage() {
  await connection(); // reads the Keychain per request; never prerender at build time
  const source = await getKeySource();

  return (
    <main className="mx-auto max-w-xl space-y-5 px-6 py-12">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {source === "none" ? "Connect to Linear" : "Change Linear API key"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          The {INITIATIVE_NAME} dashboard reads Linear with your own personal API key. It shows what
          you can see in Linear, and priority or status changes you make are made as you.
        </p>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          In Linear, open Settings &rarr; Security &amp; access &rarr; Personal API keys, and create a
          new key.
        </li>
        <li>Copy the key (it starts with lin_api_) and paste it below.</li>
      </ol>

      {source === "env" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A key is set with the LINEAR_API_KEY environment variable (for example in .env.local). It
          takes priority, so a key saved here is only used once that variable is removed.
        </p>
      )}

      <SetupForm />

      <p className="text-xs text-slate-500">
        The key is checked with Linear and then stored in your macOS Keychain (item
        &ldquo;LinearDashboard&rdquo;). It is not saved in any file and is never sent to your
        browser.
      </p>

      <div className="flex items-center gap-4">
        {source !== "none" && (
          <Link href="/" className="text-sm text-indigo-700 hover:underline">
            &larr; Back to the dashboard
          </Link>
        )}
        {process.env.LINEAR_DASHBOARD_APP === "1" && (
          <div className="ml-auto flex items-center gap-2">
            <QuitButton />
          </div>
        )}
      </div>
    </main>
  );
}
