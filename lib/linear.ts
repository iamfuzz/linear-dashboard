import "server-only";

import { CACHE_TTL_MS, INITIATIVE_ID, LINEAR_API_URL } from "./config";
import { compareWorkflowStates, validatePriorityUpdate, validateStatusUpdate } from "./dashboard";
import { getApiKey } from "./secret";
import { LinearError, type DashboardData, type Issue, type Team } from "./types";

interface GqlResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string; type?: string } }[];
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown>,
  explicitKey?: string,
): Promise<T> {
  // Env LINEAR_API_KEY first, then the macOS Keychain (see lib/secret.ts).
  const key = explicitKey ?? (await getApiKey());
  if (!key) {
    throw new LinearError("missing_key", "No Linear API key is set up yet.");
  }

  let res: Response;
  try {
    res = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Personal API keys are sent as-is (no "Bearer" prefix).
        Authorization: key,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
  } catch (err) {
    throw new LinearError("api_error", `Could not reach Linear: ${(err as Error).message}`);
  }

  let body: GqlResponse<T> | null = null;
  try {
    body = (await res.json()) as GqlResponse<T>;
  } catch {
    // non-JSON response; handled below
  }

  const errors = body?.errors ?? [];
  const authFailed =
    res.status === 401 ||
    res.status === 403 ||
    errors.some(
      (e) =>
        e.extensions?.code === "AUTHENTICATION_ERROR" ||
        /authenticat/i.test(e.extensions?.type ?? "") ||
        /authenticat/i.test(e.message),
    );
  if (authFailed) {
    throw new LinearError(
      "invalid_key",
      "Linear rejected the API key. Check that the key is correct and has not been revoked.",
    );
  }
  if (!res.ok || errors.length || !body?.data) {
    const msg = errors.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new LinearError("api_error", `Linear API error: ${msg}`);
  }
  return body.data;
}

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer { id name }
  }
`;

/**
 * Check a candidate key with a cheap read-only `viewer` query before it is saved.
 * Returns the key owner's name. Throws LinearError (invalid_key / api_error).
 */
export async function validateApiKey(key: string): Promise<{ id: string; name: string }> {
  const data = await gql<{ viewer: { id: string; name: string } | null }>(VIEWER_QUERY, {}, key);
  if (!data.viewer) throw new LinearError("invalid_key", "Linear did not recognize this key.");
  return data.viewer;
}

const INITIATIVE_QUERY = /* GraphQL */ `
  query Initiative($id: String!) {
    viewer { id }
    initiative(id: $id) {
      id
      name
      url
      projects(first: 100) {
        nodes { id name url }
      }
    }
  }
`;

const ISSUES_QUERY = /* GraphQL */ `
  query Issues($projectIds: [ID!], $after: String) {
    issues(
      first: 100
      after: $after
      includeArchived: false
      filter: { project: { id: { in: $projectIds } } }
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        identifier
        title
        url
        priority
        priorityLabel
        dueDate
        updatedAt
        state { id name type }
        team { id }
        assignee { id name }
        project { id }
        labels(first: 10) { nodes { name color } }
      }
    }
  }
`;

// Workflow states are per team, so load each referenced team's states once.
const TEAMS_QUERY = /* GraphQL */ `
  query Teams($ids: [ID!]) {
    teams(first: 50, filter: { id: { in: $ids } }) {
      nodes {
        id
        key
        name
        states(first: 50) { nodes { id name type position } }
      }
    }
  }
`;

interface TeamsResult {
  teams: {
    nodes: {
      id: string;
      key: string;
      name: string;
      states: { nodes: { id: string; name: string; type: string; position: number }[] };
    }[];
  };
}

function toTeam(t: TeamsResult["teams"]["nodes"][number]): Team {
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    states: [...t.states.nodes].sort(compareWorkflowStates),
  };
}

interface InitiativeResult {
  viewer: { id: string } | null;
  initiative: {
    id: string;
    name: string;
    url: string;
    projects: { nodes: { id: string; name: string; url: string }[] };
  } | null;
}

interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  priorityLabel: string;
  dueDate: string | null;
  updatedAt: string;
  state: { id: string; name: string; type: string };
  team: { id: string } | null;
  assignee: { id: string; name: string } | null;
  project: { id: string } | null;
  labels: { nodes: { name: string; color: string }[] };
}

interface IssuesResult {
  issues: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: RawIssue[];
  };
}

async function fetchDashboard(): Promise<DashboardData> {
  const { viewer, initiative } = await gql<InitiativeResult>(INITIATIVE_QUERY, {
    id: INITIATIVE_ID,
  });
  if (!initiative) {
    throw new LinearError("api_error", `Initiative ${INITIATIVE_ID} not found or not accessible.`);
  }

  const projects = initiative.projects.nodes
    .map((p) => ({ id: p.id, name: p.name, url: p.url }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const projectIds = projects.map((p) => p.id);

  const issues: Issue[] = [];
  if (projectIds.length) {
    let after: string | null = null;
    for (let page = 0; page < 50; page++) {
      const data: IssuesResult = await gql<IssuesResult>(ISSUES_QUERY, { projectIds, after });
      for (const n of data.issues.nodes) {
        if (!n.project || !projectIds.includes(n.project.id)) continue;
        issues.push({
          id: n.id,
          identifier: n.identifier,
          title: n.title,
          url: n.url,
          priority: n.priority,
          priorityLabel: n.priorityLabel,
          state: n.state,
          teamId: n.team?.id ?? "",
          assignee: n.assignee,
          projectId: n.project.id,
          dueDate: n.dueDate,
          updatedAt: n.updatedAt,
          labels: n.labels.nodes,
        });
      }
      if (!data.issues.pageInfo.hasNextPage) break;
      after = data.issues.pageInfo.endCursor;
    }
  }

  const teams: Record<string, Team> = {};
  const teamIds = [...new Set(issues.map((i) => i.teamId).filter(Boolean))];
  if (teamIds.length) {
    const data = await gql<TeamsResult>(TEAMS_QUERY, { ids: teamIds });
    for (const t of data.teams.nodes) teams[t.id] = toTeam(t);
  }

  return {
    initiative: { id: initiative.id, name: initiative.name, url: initiative.url },
    viewerId: viewer?.id ?? null,
    projects,
    issues,
    teams,
    fetchedAt: new Date().toISOString(),
  };
}

// Simple in-memory server cache (~60s) with in-flight request de-duplication.
// `generation` bumps on every clear, so a fetch that started before a mutation can neither
// be reused afterwards nor write its (stale) result into the cache.
let cache: { data: DashboardData; at: number } | null = null;
let inflight: { promise: Promise<DashboardData>; generation: number } | null = null;
let generation = 0;

export async function getDashboardData(): Promise<DashboardData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!inflight || inflight.generation !== generation) {
    const gen = generation;
    const entry = {
      generation: gen,
      promise: fetchDashboard()
        .then((data) => {
          if (gen === generation) cache = { data, at: Date.now() };
          return data;
        })
        .finally(() => {
          if (inflight === entry) inflight = null;
        }),
    };
    inflight = entry;
  }
  return inflight.promise;
}

export function clearDashboardCache(): void {
  cache = null;
  generation++;
}

const SET_PRIORITY_MUTATION = /* GraphQL */ `
  mutation SetIssuePriority($id: String!, $priority: Int!) {
    issueUpdate(id: $id, input: { priority: $priority }) {
      success
      issue { id priority priorityLabel }
    }
  }
`;

interface SetPriorityResult {
  issueUpdate: {
    success: boolean;
    issue: { id: string; priority: number; priorityLabel: string } | null;
  } | null;
}

/**
 * Set an issue's priority (0 = none, 1 = urgent ... 4 = low) in Linear.
 * Validates input, then invalidates the in-memory cache on success.
 * Throws LinearError on invalid input or API failure.
 */
export async function updateIssuePriority(id: unknown, priority: unknown): Promise<void> {
  const v = validatePriorityUpdate(id, priority);
  if (!v.ok) throw new LinearError("api_error", v.error);
  const data = await gql<SetPriorityResult>(SET_PRIORITY_MUTATION, {
    id: v.id,
    priority: v.priority,
  });
  if (!data.issueUpdate?.success) {
    throw new LinearError("api_error", "Linear did not accept the priority change.");
  }
  clearDashboardCache();
}

const SET_STATE_MUTATION = /* GraphQL */ `
  mutation SetIssueState($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
      issue { id state { id name type } }
    }
  }
`;

interface SetStateResult {
  issueUpdate: {
    success: boolean;
    issue: { id: string; state: { id: string; name: string; type: string } } | null;
  } | null;
}

// Fallback when the issue is not in the cached dashboard data.
const ISSUE_TEAM_STATES_QUERY = /* GraphQL */ `
  query IssueTeamStates($id: String!) {
    issue(id: $id) {
      id
      team { id states(first: 50) { nodes { id } } }
    }
  }
`;

interface IssueTeamStatesResult {
  issue: { id: string; team: { id: string; states: { nodes: { id: string }[] } } | null } | null;
}

/** State ids allowed for the issue (its team's workflow states). Uses cached data when possible. */
async function allowedStateIds(issueId: string): Promise<Set<string>> {
  const cached = cache?.data;
  const issue = cached?.issues.find((i) => i.id === issueId);
  const team = issue && cached?.teams[issue.teamId];
  if (team) return new Set(team.states.map((s) => s.id));
  const data = await gql<IssueTeamStatesResult>(ISSUE_TEAM_STATES_QUERY, { id: issueId });
  if (!data.issue) throw new LinearError("api_error", "Issue not found in Linear.");
  return new Set(data.issue.team?.states.nodes.map((s) => s.id) ?? []);
}

/**
 * Move an issue to another workflow state of its own team in Linear.
 * Validates input and that the state belongs to the issue's team before sending the
 * mutation, then invalidates the in-memory cache on success.
 * Throws LinearError on invalid input or API failure.
 */
export async function updateIssueStatus(id: unknown, stateId: unknown): Promise<void> {
  const v = validateStatusUpdate(id, stateId);
  if (!v.ok) throw new LinearError("api_error", v.error);
  const allowed = await allowedStateIds(v.id);
  if (!allowed.has(v.stateId)) {
    throw new LinearError("api_error", "That status does not belong to this issue's team.");
  }
  const data = await gql<SetStateResult>(SET_STATE_MUTATION, { id: v.id, stateId: v.stateId });
  if (!data.issueUpdate?.success) {
    throw new LinearError("api_error", "Linear did not accept the status change.");
  }
  clearDashboardCache();
}
