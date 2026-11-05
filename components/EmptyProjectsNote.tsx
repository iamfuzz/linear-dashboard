/** Footnote for projects hidden because they have no issues in the current view. */
export default function EmptyProjectsNote({
  count,
  showDone,
  suffix = "",
}: {
  count: number;
  showDone: boolean;
  suffix?: string;
}) {
  if (count <= 0) return null;
  return (
    <p className="text-xs text-slate-400">
      {`${count} ${count === 1 ? "project" : "projects"} with no ${showDone ? "" : "open "}issues${suffix} hidden`}
    </p>
  );
}
