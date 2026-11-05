import Link from "next/link";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function buildHref(tab: string, showDone: boolean): string {
  const params = new URLSearchParams();
  if (tab !== "projects") params.set("tab", tab);
  if (showDone) params.set("done", "1");
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export default function Tabs({
  tabs,
  active,
  showDone,
}: {
  tabs: TabItem[];
  active: string;
  showDone: boolean;
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={buildHref(t.key, showDone)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
