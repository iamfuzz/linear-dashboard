// Pure helpers (no I/O) for sorting, grouping and summarizing issues.
import type { Issue, Person, Project, Team } from "./types";

export function isDone(issue: Issue): boolean {
  return isClosedType(issue.state.type);
}

/** Completed, canceled and duplicate states count as done (hidden unless "Show done"). */
export function isClosedType(type: string): boolean {
  return type === "completed" || type === "canceled" || type === "duplicate";
}

/** Urgent(1) -> High(2) -> Medium(3) -> Low(4) -> No priority(0) last. */
export function priorityRank(priority: number): number {
  return priority === 0 ? 5 : priority;
}

const STATE_ORDER: Record<string, number> = {
  started: 0,
  unstarted: 1,
  backlog: 2,
  triage: 3,
  completed: 4,
  canceled: 5,
  duplicate: 6,
};

const MENU_TYPE_ORDER = ["triage", "backlog", "unstarted", "started", "completed", "canceled", "duplicate"];

/** Linear's status menu order: grouped by type (triage ... canceled), then by position. */
export function compareWorkflowStates(
  a: { type: string; position: number },
  b: { type: string; position: number },
): number {
  const group = (t: string) => {
    const i = MENU_TYPE_ORDER.indexOf(t);
    return i === -1 ? MENU_TYPE_ORDER.length : i;
  };
  return group(a.type) - group(b.type) || a.position - b.position;
}

export function compareIssues(a: Issue, b: Issue): number {
  return (
    priorityRank(a.priority) - priorityRank(b.priority) ||
    (STATE_ORDER[a.state.type] ?? 9) - (STATE_ORDER[b.state.type] ?? 9) ||
    (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
    a.identifier.localeCompare(b.identifier, undefined, { numeric: true })
  );
}

export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(compareIssues);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Distinct assignees; the viewer (key owner) first, then alphabetical. */
export function getPeople(issues: Issue[], viewerId: string | null): Person[] {
  const byId = new Map<string, Person>();
  for (const i of issues) {
    if (i.assignee && !byId.has(i.assignee.id)) {
      byId.set(i.assignee.id, {
        id: i.assignee.id,
        name: i.assignee.name,
        slug: slugify(i.assignee.name) || i.assignee.id,
      });
    }
  }
  const people = [...byId.values()].sort((a, b) => {
    if (a.id === viewerId) return -1;
    if (b.id === viewerId) return 1;
    return a.name.localeCompare(b.name);
  });
  // Disambiguate duplicate slugs (two people with the same name).
  const seen = new Set<string>();
  for (const p of people) {
    if (seen.has(p.slug)) p.slug = `${p.slug}-${p.id.slice(0, 6)}`;
    seen.add(p.slug);
  }
  return people;
}

export interface ProjectGroup {
  project: Project;
  issues: Issue[];
}

/** Group issues by project, in project order, each group priority-sorted. */
export function groupByProject(
  projects: Project[],
  issues: Issue[],
  { includeEmpty }: { includeEmpty: boolean },
): ProjectGroup[] {
  return projects
    .map((project) => ({
      project,
      issues: sortIssues(issues.filter((i) => i.projectId === project.id)),
    }))
    .filter((g) => includeEmpty || g.issues.length > 0);
}

export interface ProjectSection {
  project: Project;
  all: Issue[]; // every issue in the project (priority-sorted)
  visible: Issue[]; // issues in the current view (done/canceled dropped unless showDone)
}

/**
 * Project sections for the current view. Projects with no issues in the view
 * (respecting showDone) are dropped; `hiddenEmpty` counts them for a footnote.
 */
export function visibleProjectSections(
  projects: Project[],
  issues: Issue[],
  { showDone }: { showDone: boolean },
): { sections: ProjectSection[]; hiddenEmpty: number } {
  const sections: ProjectSection[] = [];
  let hiddenEmpty = 0;
  for (const { project, issues: all } of groupByProject(projects, issues, { includeEmpty: true })) {
    const visible = showDone ? all : all.filter((i) => !isDone(i));
    if (visible.length) sections.push({ project, all, visible });
    else hiddenEmpty++;
  }
  return { sections, hiddenEmpty };
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

/** Dropdown order: No priority, Urgent, High, Medium, Low. */
export const PRIORITY_VALUES = [0, 1, 2, 3, 4] as const;

export type PriorityUpdateResult = { ok: true } | { ok: false; error: string };

/** Validate untrusted input for a priority change (server actions accept any payload). */
export function validatePriorityUpdate(
  id: unknown,
  priority: unknown,
): { ok: true; id: string; priority: number } | { ok: false; error: string } {
  if (typeof id !== "string" || id.trim() === "" || id.length > 200) {
    return { ok: false, error: "Invalid issue id." };
  }
  if (typeof priority !== "number" || !Number.isInteger(priority) || priority < 0 || priority > 4) {
    return { ok: false, error: "Priority must be an integer from 0 to 4." };
  }
  return { ok: true, id: id.trim(), priority };
}

export type StatusUpdateResult = PriorityUpdateResult;

/** Validate untrusted input for a status (workflow state) change. */
export function validateStatusUpdate(
  id: unknown,
  stateId: unknown,
): { ok: true; id: string; stateId: string } | { ok: false; error: string } {
  if (typeof id !== "string" || id.trim() === "" || id.length > 200) {
    return { ok: false, error: "Invalid issue id." };
  }
  if (typeof stateId !== "string" || stateId.trim() === "" || stateId.length > 200) {
    return { ok: false, error: "Invalid status id." };
  }
  return { ok: true, id: id.trim(), stateId: stateId.trim() };
}

/** The issue's team workflow states, ordered by position (empty if the team is unknown). */
export function statesForIssue(issue: Issue, teams: Record<string, Team>) {
  return teams[issue.teamId]?.states ?? [];
}

/** Pending local changes for one issue, keyed by issue id in an overrides map. */
export interface IssueOverride {
  priority?: number;
  stateId?: string;
}

/**
 * Apply optimistic overrides to issues (priority and/or status). A stateId that is not one of
 * the issue's team states is ignored. Issues without overrides are returned as-is.
 */
export function applyOverrides(
  issues: Issue[],
  overrides: Record<string, IssueOverride>,
  teams: Record<string, Team>,
): Issue[] {
  return issues.map((i) => {
    const o = overrides[i.id];
    if (!o) return i;
    let next = i;
    if (o.priority !== undefined && o.priority !== i.priority) {
      next = { ...next, priority: o.priority, priorityLabel: PRIORITY_LABELS[o.priority] ?? "" };
    }
    if (o.stateId !== undefined && o.stateId !== i.state.id) {
      const s = statesForIssue(i, teams).find((st) => st.id === o.stateId);
      if (s) next = { ...next, state: { id: s.id, name: s.name, type: s.type } };
    }
    return next;
  });
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isOverdue(issue: Issue, today = todayISO()): boolean {
  return !!issue.dueDate && issue.dueDate < today && !isDone(issue);
}

export interface Stats {
  total: number;
  open: number; // triage / backlog / unstarted
  inProgress: number; // started
  done: number; // completed
  canceled: number; // canceled + duplicate
  overdue: number;
  percentDone: number; // completed / (total - canceled)
}

export function getStats(issues: Issue[], today = todayISO()): Stats {
  const s: Stats = {
    total: issues.length,
    open: 0,
    inProgress: 0,
    done: 0,
    canceled: 0,
    overdue: 0,
    percentDone: 0,
  };
  for (const i of issues) {
    if (i.state.type === "completed") s.done++;
    else if (i.state.type === "canceled" || i.state.type === "duplicate") s.canceled++;
    else if (i.state.type === "started") s.inProgress++;
    else s.open++;
    if (isOverdue(i, today)) s.overdue++;
  }
  const denom = s.total - s.canceled;
  s.percentDone = denom > 0 ? Math.round((s.done / denom) * 100) : 0;
  return s;
}
