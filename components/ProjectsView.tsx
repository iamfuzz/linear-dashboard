import { getStats, visibleProjectSections } from "@/lib/dashboard";
import type { Issue, Project } from "@/lib/types";
import EmptyProjectsNote from "./EmptyProjectsNote";
import IssueList from "./IssueList";
import StatsBar from "./StatsBar";

export default function ProjectsView({
  projects,
  issues,
  showDone,
  today,
}: {
  projects: Project[];
  issues: Issue[];
  showDone: boolean;
  today: string;
}) {
  const { sections, hiddenEmpty } = visibleProjectSections(projects, issues, { showDone });

  return (
    <div className="space-y-4">
      <StatsBar stats={getStats(issues, today)} />
      {sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No {showDone ? "" : "open "}issues in any project.
        </p>
      )}
      {sections.map(({ project, all, visible }) => {
        const hidden = all.length - visible.length;
        return (
          <details
            key={project.id}
            open
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50 px-4 py-2.5">
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-800 hover:underline"
              >
                {project.name}
              </a>
              <span className="text-xs text-slate-500">{all.length} issues</span>
              <span className="ml-auto">
                <StatsBar stats={getStats(all, today)} compact />
              </span>
            </summary>
            <IssueList issues={visible} showAssignee today={today} />
            {hidden > 0 && (
              <p className="border-t border-slate-100 px-4 py-1.5 text-xs text-slate-400">
                {hidden} done/canceled hidden
              </p>
            )}
          </details>
        );
      })}
      <EmptyProjectsNote count={hiddenEmpty} showDone={showDone} />
    </div>
  );
}
