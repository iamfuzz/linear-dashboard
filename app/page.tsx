import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import ErrorState from "@/components/ErrorState";
import Dashboard from "@/components/Dashboard";
import RefreshButton from "@/components/RefreshButton";
import { buildHref } from "@/components/Tabs";
import { CACHE_TTL_MS, INITIATIVE_NAME } from "@/lib/config";
import { getPeople, todayISO } from "@/lib/dashboard";
import { getDashboardData } from "@/lib/linear";
import { LinearError, type DashboardData } from "@/lib/types";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const requestedTab = first(sp.tab) ?? "projects";
  const showDone = first(sp.done) === "1";

  let data: DashboardData | null = null;
  let error: LinearError | null = null;
  try {
    data = await getDashboardData();
  } catch (err) {
    error =
      err instanceof LinearError
        ? err
        : new LinearError("api_error", (err as Error)?.message ?? "Unknown error");
  }

  const people = data ? getPeople(data.issues, data.viewerId) : [];
  const person = people.find((p) => p.slug === requestedTab);
  const activeTab = person ? person.slug : "projects";
  const today = todayISO();

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {data ? (
              <a href={data.initiative.url} target="_blank" rel="noreferrer" className="hover:underline">
                {data.initiative.name}
              </a>
            ) : (
              INITIATIVE_NAME
            )}
          </h1>
          {data && (
            <p className="text-xs text-slate-500">
              {data.projects.length} projects &middot; {data.issues.length} issues &middot; updated{" "}
              {new Date(data.fetchedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={buildHref(activeTab, !showDone)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <span
              className={`inline-block h-4 w-4 rounded border ${showDone ? "border-indigo-600 bg-indigo-600" : "border-slate-400 bg-white"}`}
              aria-hidden
            />
            Show done
          </Link>
          <RefreshButton />
          <AutoRefresh intervalMs={CACHE_TTL_MS} />
        </div>
      </header>

      {error && <ErrorState kind={error.kind} message={error.message} />}

      {data && (
        <Dashboard
          projects={data.projects}
          issues={data.issues}
          teams={data.teams}
          people={people}
          activeTab={activeTab}
          showDone={showDone}
          today={today}
        />
      )}
    </main>
  );
}
