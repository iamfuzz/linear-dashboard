import { getStats, visibleProjectSections } from "@/lib/dashboard";
import type { Issue, Person, Project } from "@/lib/types";
import EmptyProjectsNote from "./EmptyProjectsNote";
import IssueList from "./IssueList";
import StatsBar from "./StatsBar";

export default function PersonView({
  person,
  projects,
  issues,
  showDone,
  today,
}: {
  person: Person;
  projects: Project[];
  issues: Issue[];
  showDone: boolean;
  today: string;
}) {
  const mine = issues.filter((i) => i.assignee?.id === person.id);
  const { sections, hiddenEmpty } = visibleProjectSections(projects, mine, { showDone });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">{person.name}</h2>
      <StatsBar stats={getStats(mine, today)} />
      {sections.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No {showDone ? "" : "open "}issues assigned.
        </p>
      )}
      {sections.map(({ project, visible }) => (
        <section
          key={project.id}
          className="overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <header className="flex items-center gap-3 bg-slate-50 px-4 py-2.5">
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-slate-800 hover:underline"
            >
              {project.name}
            </a>
            <span className="text-xs text-slate-500">{visible.length}</span>
          </header>
          <IssueList issues={visible} showAssignee={false} today={today} />
        </section>
      ))}
      {sections.length > 0 && (
        <EmptyProjectsNote
          count={hiddenEmpty}
          showDone={showDone}
          suffix={` assigned to ${person.name}`}
        />
      )}
    </div>
  );
}
