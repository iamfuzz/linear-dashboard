export type StateType =
  | "triage"
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled"
  | "duplicate";

export interface Person {
  id: string;
  name: string;
  slug: string;
}

export interface Project {
  id: string;
  name: string;
  url: string;
}

export interface IssueState {
  id: string;
  name: string;
  type: StateType | string;
}

/** A workflow state (status) a team's issues can be in. */
export interface WorkflowState extends IssueState {
  position: number;
}

export interface Team {
  id: string;
  key: string;
  name: string;
  states: WorkflowState[]; // Linear menu order: by type group, then position
}

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number; // 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low
  priorityLabel: string;
  state: IssueState;
  teamId: string;
  assignee: { id: string; name: string } | null;
  projectId: string;
  dueDate: string | null; // YYYY-MM-DD
  updatedAt: string;
  labels: { name: string; color: string }[];
}

export interface DashboardData {
  initiative: { id: string; name: string; url: string };
  viewerId: string | null;
  projects: Project[];
  issues: Issue[];
  teams: Record<string, Team>; // team id -> team (with its workflow states)
  fetchedAt: string;
}

export type LinearErrorKind = "missing_key" | "invalid_key" | "api_error";

export class LinearError extends Error {
  kind: LinearErrorKind;

  constructor(kind: LinearErrorKind, message: string) {
    super(message);
    this.name = "LinearError";
    this.kind = kind;
  }
}
