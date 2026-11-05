"use client";

import { startTransition, useOptimistic, useState } from "react";
import { setIssuePriority, setIssueStatus } from "@/app/actions";
import {
  applyOverrides,
  isClosedType,
  isDone,
  statesForIssue,
  type IssueOverride,
  type PriorityUpdateResult,
} from "@/lib/dashboard";
import type { Issue, Person, Project, Team } from "@/lib/types";
import { IssueEditsContext, type IssueEdits } from "./IssueEditsContext";
import { beginEdit, endEdit } from "./pendingEdits";
import PersonView from "./PersonView";
import ProjectsView from "./ProjectsView";
import Tabs, { type TabItem } from "./Tabs";

type Overrides = Record<string, IssueOverride>; // issue id -> optimistic changes

function without(map: Record<string, string>, key: string): Record<string, string> {
  const next = { ...map };
  delete next[key];
  return next;
}

/**
 * Tabs plus the active view. Priority and status changes are applied optimistically to the
 * whole dataset (so sorting, stats, tab counts and Show done visibility all follow) until the
 * server action finishes. On success the action refreshes the page data; on failure the
 * optimistic value is dropped automatically and an inline error is shown under the row.
 * Server refreshes that arrive meanwhile only replace the base data: the overrides stay on top.
 */
export default function Dashboard({
  projects,
  issues,
  teams,
  people,
  activeTab,
  showDone,
  today,
}: {
  projects: Project[];
  issues: Issue[];
  teams: Record<string, Team>;
  people: Person[];
  activeTab: string;
  showDone: boolean;
  today: string;
}) {
  const [overrides, addOverride] = useOptimistic<Overrides, { id: string } & IssueOverride>(
    {},
    (state, { id, ...change }) => ({ ...state, [id]: { ...state[id], ...change } }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const shown = applyOverrides(issues, overrides, teams);
  const person = people.find((p) => p.slug === activeTab);

  const openCount = (personId?: string) =>
    shown.filter((i) => !isDone(i) && (!personId || i.assignee?.id === personId)).length;
  const tabs: TabItem[] = [
    { key: "projects", label: "Projects", count: openCount() },
    ...people.map((p) => ({ key: p.slug, label: p.name, count: openCount(p.id) })),
  ];

  function run(
    issue: Issue,
    change: IssueOverride,
    send: () => Promise<PriorityUpdateResult>,
    what: string,
  ) {
    setErrors((e) => without(e, issue.id));
    beginEdit();
    startTransition(async () => {
      addOverride({ id: issue.id, ...change });
      let result: PriorityUpdateResult;
      try {
        result = await send();
      } catch {
        result = { ok: false, error: "Could not reach the server." };
      } finally {
        endEdit();
      }
      if (!result.ok) {
        const message = `${what} not changed: ${result.error}`;
        startTransition(() => {
          setErrors((e) => ({ ...e, [issue.id]: message }));
          setNotice((n) => (n?.startsWith(`${issue.identifier} `) ? null : n));
        });
      }
    });
  }

  const edits: IssueEdits = {
    teams,
    isPending: (id) => id in overrides,
    errors,
    dismissError: (id) => setErrors((e) => without(e, id)),
    changePriority(issue, priority) {
      if (priority === issue.priority) return;
      run(issue, { priority }, () => setIssuePriority(issue.id, priority), "Priority");
    },
    changeStatus(issue, stateId) {
      if (stateId === issue.state.id) return;
      const target = statesForIssue(issue, teams).find((s) => s.id === stateId);
      if (!target) return;
      const hides = !showDone && isClosedType(target.type) && !isDone(issue);
      setNotice(hides ? `${issue.identifier} moved to ${target.name} (hidden while Show done is off).` : null);
      run(issue, { stateId }, () => setIssueStatus(issue.id, stateId), "Status");
    },
  };

  return (
    <IssueEditsContext value={edits}>
      <Tabs tabs={tabs} active={person ? person.slug : "projects"} showDone={showDone} />
      {notice && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-500 hover:text-emerald-800"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </p>
      )}
      {person ? (
        <PersonView
          person={person}
          projects={projects}
          issues={shown}
          showDone={showDone}
          today={today}
        />
      ) : (
        <ProjectsView projects={projects} issues={shown} showDone={showDone} today={today} />
      )}
    </IssueEditsContext>
  );
}
