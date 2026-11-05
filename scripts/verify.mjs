// Offline check of the data layer and helpers against a mocked Linear GraphQL API.
// Run: npm run verify   (Node 22.18+ / 23.6+ for built-in TypeScript type stripping)
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Let Node load the app's extensionless TS imports and stub Next's "server-only" marker.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw err;
    }
  },
});

const linear = await import("../lib/linear.ts");
const dash = await import("../lib/dashboard.ts");

const VIEWER = { id: "u-brian", name: "Brian Thomason" };
const projects = [
  { id: "p-portal", name: "Partner Portal", url: "https://linear.app/x/project/portal" },
  { id: "p-docs", name: "Documentation (Partner SE)", url: "https://linear.app/x/project/docs" },
  { id: "p-empty", name: "Artifact Managers", url: "https://linear.app/x/project/am" },
];
// Two teams with different workflow states (statuses are per team in Linear).
const STATE_TYPES = ["backlog", "unstarted", "started", "completed", "canceled"];
const NAMES = { backlog: "Backlog", unstarted: "Todo", started: "In Progress", completed: "Done", canceled: "Canceled" };
const teamStates = (team) =>
  // Returned out of order on purpose: the app must sort by position.
  [...STATE_TYPES].reverse().map((type) => ({
    id: `${team}-${type}`,
    name: `${NAMES[type]}${team === "t-ops" ? " (Ops)" : ""}`,
    type,
    position: STATE_TYPES.indexOf(type),
  }));
// Like real Linear: positions are not globally ordered by type ("In Review" is a started
// state with a high position), and there is a "duplicate" type.
const seExtra = [
  { id: "t-se-review", name: "In Review", type: "started", position: 10 },
  { id: "t-se-duplicate", name: "Duplicate", type: "duplicate", position: 5 },
];
const TEAMS = [
  { id: "t-se", key: "SE", name: "Partner SE", states: { nodes: [...seExtra, ...teamStates("t-se")] } },
  { id: "t-ops", key: "OPS", name: "Ops", states: { nodes: teamStates("t-ops") } },
];
let n = 0;
const issue = (projectId, priority, stateType, assignee, dueDate = null, team = "t-se") => {
  n++;
  return {
    id: `i${n}`,
    identifier: `SE-${n}`,
    title: `Issue ${n}`,
    url: `https://linear.app/x/issue/SE-${n}`,
    priority,
    priorityLabel: ["No priority", "Urgent", "High", "Medium", "Low"][priority],
    dueDate,
    updatedAt: "2026-11-04T00:00:00.000Z",
    state: { id: `${team}-${stateType}`, name: NAMES[stateType], type: stateType },
    team: { id: team },
    assignee,
    project: { id: projectId },
    labels: { nodes: [] },
  };
};
const zoe = { id: "u-zoe", name: "Zoe Adams" };
const al = { id: "u-al", name: "Al Baker" };
const page1 = [
  issue("p-portal", 0, "backlog", al),
  issue("p-portal", 4, "started", VIEWER, "2020-01-01"), // overdue
  issue("p-portal", 1, "unstarted", zoe, null, "t-ops"),
  issue("p-docs", 2, "completed", VIEWER),
];
const page2 = [
  issue("p-docs", 3, "canceled", zoe),
  issue("p-docs", 2, "started", null), // unassigned
  issue("p-other", 1, "started", { id: "u-x", name: "Outsider" }), // not in initiative
];

let mode = "ok";
let mutationMode = "ok"; // "ok" | "unsuccessful" | "gql-error"
let lookupMode = "ok"; // issue team-states lookup: "ok" | "missing"
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
  const json = (status, body) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (mode === "invalid") {
    return json(400, {
      errors: [{ message: "Authentication required, not authenticated", extensions: { code: "AUTHENTICATION_ERROR" } }],
    });
  }
  const { query, variables } = JSON.parse(init.body);
  if (query.includes("issueUpdate(")) {
    if (mutationMode === "gql-error") {
      return json(200, { errors: [{ message: "Entity not found: Issue" }] });
    }
    return json(200, {
      data: {
        issueUpdate: {
          success: mutationMode === "ok",
          issue: { id: variables.id, priority: variables.priority ?? 0, priorityLabel: "x" },
        },
      },
    });
  }
  if (query.includes("teams(")) {
    return json(200, { data: { teams: { nodes: TEAMS.filter((t) => variables.ids.includes(t.id)) } } });
  }
  if (query.includes("issue(id:")) {
    const team = TEAMS.find((t) => t.id === "t-se");
    return json(200, {
      data: { issue: lookupMode === "missing" ? null : { id: variables.id, team: { id: team.id, states: team.states } } },
    });
  }
  if (query.includes("initiative(")) {
    return json(200, {
      data: {
        viewer: { id: VIEWER.id },
        initiative: { id: variables.id, name: "AMER Partner SE Programs", url: "https://linear.app/x/i", projects: { nodes: projects } },
      },
    });
  }
  const second = variables.after === "c1";
  return json(200, {
    data: {
      issues: {
        pageInfo: { hasNextPage: !second, endCursor: second ? null : "c1" },
        nodes: second ? page2 : page1,
      },
    },
  });
};

// 1. Missing key
delete process.env.LINEAR_API_KEY;
await assert.rejects(linear.getDashboardData(), (e) => e.kind === "missing_key");
assert.equal(calls.length, 0, "no request without a key");

// 2. Invalid key
process.env.LINEAR_API_KEY = "lin_api_test";
mode = "invalid";
await assert.rejects(linear.getDashboardData(), (e) => e.kind === "invalid_key");

// 3. Happy path with pagination
mode = "ok";
calls.length = 0;
const data = await linear.getDashboardData();
assert.equal(calls[0].url, "https://api.linear.app/graphql");
assert.equal(calls[0].headers.Authorization, "lin_api_test", "no Bearer prefix");
assert.equal(calls.length, 4, "initiative + 2 issue pages + teams");
assert.deepEqual(calls[3].body.variables.ids.sort(), ["t-ops", "t-se"], "only teams of loaded issues");
assert.match(calls[3].body.query, /states\(first: 50\) \{ nodes \{ id name type position \} \}/);
assert.deepEqual(calls[1].body.variables.projectIds.sort(), ["p-docs", "p-empty", "p-portal"]);
assert.equal(data.issues.length, 6, "issue outside initiative projects dropped");
assert.deepEqual(data.projects.map((p) => p.name), ["Artifact Managers", "Documentation (Partner SE)", "Partner Portal"]);

// 4. Cache: second call within TTL makes no request; clear forces refetch
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 0, "served from cache");
linear.clearDashboardCache();
await linear.getDashboardData();
assert.equal(calls.length, 4, "refetched after clear");

// 5. People: viewer first, then alphabetical; unassigned/outsiders excluded
const people = dash.getPeople(data.issues, data.viewerId);
assert.deepEqual(people.map((p) => p.name), ["Brian Thomason", "Al Baker", "Zoe Adams"]);
assert.deepEqual(people.map((p) => p.slug), ["brian-thomason", "al-baker", "zoe-adams"]);

// 6. Priority sort: Urgent, High, Medium, Low, None
const sorted = dash.sortIssues(data.issues).map((i) => i.priority);
assert.deepEqual(sorted, [1, 2, 2, 3, 4, 0]);

// 7. Grouping and stats
const groups = dash.groupByProject(data.projects, data.issues, { includeEmpty: true });
assert.deepEqual(groups.map((g) => g.issues.length), [0, 3, 3]);
const portal = dash.getStats(groups[2].issues, "2026-11-05");
assert.deepEqual(
  { open: portal.open, inProgress: portal.inProgress, done: portal.done, overdue: portal.overdue },
  { open: 2, inProgress: 1, done: 0, overdue: 1 },
);
const docs = dash.getStats(groups[1].issues, "2026-11-05");
assert.equal(docs.percentDone, 50, "completed / (total - canceled)");
const brian = data.issues.filter((i) => i.assignee?.id === VIEWER.id);
assert.deepEqual(dash.groupByProject(data.projects, brian, { includeEmpty: false }).map((g) => g.project.name), [
  "Documentation (Partner SE)",
  "Partner Portal",
]);

// 8. Empty-project hiding respects "Show done" (Brian: 1 completed in Docs, 1 started in Portal)
const sectionNames = (r) => r.sections.map((s) => s.project.name);
const brianOpen = dash.visibleProjectSections(data.projects, brian, { showDone: false });
assert.deepEqual(sectionNames(brianOpen), ["Partner Portal"], "done-only project hidden when Show done is off");
assert.equal(brianOpen.hiddenEmpty, 2);
const brianAll = dash.visibleProjectSections(data.projects, brian, { showDone: true });
assert.deepEqual(sectionNames(brianAll), ["Documentation (Partner SE)", "Partner Portal"]);
assert.equal(brianAll.hiddenEmpty, 1, "only the project with zero issues is hidden");
assert.deepEqual(brianAll.sections[0].all.map((i) => i.state.type), ["completed"]);
const allOpen = dash.visibleProjectSections(data.projects, data.issues, { showDone: false });
assert.deepEqual(sectionNames(allOpen), ["Documentation (Partner SE)", "Partner Portal"]);
assert.equal(allOpen.hiddenEmpty, 1, "Artifact Managers (no issues) hidden");
assert.deepEqual(allOpen.sections[0].visible.map((i) => i.state.type), ["started"]);
assert.equal(allOpen.sections[0].all.length, 3, "section keeps all issues for counts/stats");

// 9. Priority input validation (server-side)
for (const [id, priority] of [
  ["i1", 5], ["i1", -1], ["i1", 1.5], ["i1", "2"], ["i1", NaN], ["i1", null], ["i1", undefined],
  ["", 2], ["   ", 2], [null, 2], [42, 2], [{ id: "i1" }, 2], ["x".repeat(201), 2],
]) {
  assert.equal(dash.validatePriorityUpdate(id, priority).ok, false, `reject ${JSON.stringify([id, priority])}`);
}
for (const p of [0, 1, 2, 3, 4]) assert.deepEqual(dash.validatePriorityUpdate(" i1 ", p), { ok: true, id: "i1", priority: p });

// 10. Priority mutation: invalid input never reaches Linear
calls.length = 0;
await assert.rejects(linear.updateIssuePriority("i1", 7), /0 to 4/);
await assert.rejects(linear.updateIssuePriority("", 2), /issue id/);
assert.equal(calls.length, 0, "no request for invalid input");

// 11. Priority mutation: request shape, auth header, cache invalidation
await linear.getDashboardData(); // warm cache
calls.length = 0;
await linear.updateIssuePriority("i3", 2);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, "https://api.linear.app/graphql");
assert.equal(calls[0].headers.Authorization, "lin_api_test", "no Bearer prefix");
assert.match(calls[0].body.query, /mutation\b/);
assert.match(calls[0].body.query, /issueUpdate\(id: \$id, input: \{ priority: \$priority \}\)/);
assert.match(calls[0].body.query, /\$id: String!, \$priority: Int!/);
assert.deepEqual(calls[0].body.variables, { id: "i3", priority: 2 });
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 4, "cache invalidated after a successful priority change");

// 12. Priority mutation failures surface as errors and keep the cache
calls.length = 0;
mutationMode = "unsuccessful";
await assert.rejects(linear.updateIssuePriority("i3", 1), (e) => e.kind === "api_error" && /did not accept/.test(e.message));
mutationMode = "gql-error";
await assert.rejects(linear.updateIssuePriority("i3", 1), (e) => e.kind === "api_error" && /Entity not found/.test(e.message));
mode = "invalid";
await assert.rejects(linear.updateIssuePriority("i3", 1), (e) => e.kind === "invalid_key");
mode = "ok";
mutationMode = "ok";
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 0, "failed mutations do not clear the cache");

// 13. Re-sorting after an (optimistic) priority change keeps priority order
const portalIssues = groups[2].issues; // priorities [1, 4, 0]
const bumped = portalIssues.map((i) => (i.priority === 0 ? { ...i, priority: 1 } : i));
assert.deepEqual(dash.sortIssues(bumped).map((i) => i.priority), [1, 1, 4]);

// 14. Teams and workflow states are attached, in Linear's menu order
assert.deepEqual(Object.keys(data.teams).sort(), ["t-ops", "t-se"]);
assert.deepEqual(
  data.teams["t-se"].states.map((s) => s.name),
  ["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled", "Duplicate"],
  "Linear menu order: type group, then position",
);
const se1 = data.issues.find((i) => i.identifier === "SE-1");
const se3 = data.issues.find((i) => i.identifier === "SE-3");
assert.equal(se1.teamId, "t-se");
assert.deepEqual(se1.state, { id: "t-se-backlog", name: "Backlog", type: "backlog" });
assert.deepEqual(dash.statesForIssue(se3, data.teams).map((s) => s.id), STATE_TYPES.map((t) => `t-ops-${t}`), "own team only");
assert.deepEqual(dash.statesForIssue({ ...se1, teamId: "t-unknown" }, data.teams), []);

// 15. Status input validation (server-side)
for (const [id, stateId] of [
  ["i1", ""], ["i1", "   "], ["i1", null], ["i1", undefined], ["i1", 3], ["i1", { id: "x" }], ["i1", "s".repeat(201)],
  ["", "t-se-started"], ["  ", "t-se-started"], [null, "t-se-started"], [7, "t-se-started"], ["x".repeat(201), "t-se-started"],
]) {
  assert.equal(dash.validateStatusUpdate(id, stateId).ok, false, `reject ${JSON.stringify([id, stateId])}`);
}
assert.deepEqual(dash.validateStatusUpdate(" i1 ", " t-se-done "), { ok: true, id: "i1", stateId: "t-se-done" });

// 16. Status mutation: invalid input and states from another team never reach Linear
linear.clearDashboardCache();
await linear.getDashboardData(); // warm cache (used for the team check)
calls.length = 0;
await assert.rejects(linear.updateIssueStatus("", "t-se-started"), /issue id/);
await assert.rejects(linear.updateIssueStatus("i1", ""), /status id/);
await assert.rejects(linear.updateIssueStatus("i1", "x".repeat(201)), /status id/);
await assert.rejects(linear.updateIssueStatus("i1", "t-ops-started"), /does not belong/, "other team's state");
await assert.rejects(linear.updateIssueStatus("i3", "t-se-started"), /does not belong/, "SE state on an OPS issue");
await assert.rejects(linear.updateIssueStatus("i1", "bogus"), /does not belong/);
assert.equal(calls.length, 0, "no request for invalid input or foreign states (cached team states used)");

// 17. Status mutation: request shape, auth header, cache invalidation
calls.length = 0;
await linear.updateIssueStatus("i1", "t-se-completed");
assert.equal(calls.length, 1, "only the mutation (team check used cached data)");
assert.equal(calls[0].url, "https://api.linear.app/graphql");
assert.equal(calls[0].headers.Authorization, "lin_api_test", "no Bearer prefix");
assert.match(calls[0].body.query, /mutation\b/);
assert.match(calls[0].body.query, /issueUpdate\(id: \$id, input: \{ stateId: \$stateId \}\)/);
assert.match(calls[0].body.query, /\$id: String!, \$stateId: String!/);
assert.deepEqual(calls[0].body.variables, { id: "i1", stateId: "t-se-completed" });
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 4, "cache invalidated after a successful status change");

// 18. Team check falls back to a lookup when the issue is not in the cached data
calls.length = 0;
await linear.updateIssueStatus("i-new", "t-se-started");
assert.equal(calls.length, 2, "lookup + mutation");
assert.match(calls[0].body.query, /issue\(id: \$id\)/);
assert.deepEqual(calls[0].body.variables, { id: "i-new" });
assert.ok(!calls[0].body.query.includes("issueUpdate"), "lookup is read-only");
await linear.getDashboardData(); // re-warm
calls.length = 0;
await assert.rejects(linear.updateIssueStatus("i-new", "t-ops-started"), /does not belong/);
assert.equal(calls.length, 1, "lookup only, no mutation for a foreign state");
lookupMode = "missing";
calls.length = 0;
await assert.rejects(linear.updateIssueStatus("i-gone", "t-se-started"), /not found/);
assert.equal(calls.length, 1, "no mutation when the issue does not exist");
lookupMode = "ok";

// 19. Status mutation failures surface as errors and keep the cache
await linear.getDashboardData();
calls.length = 0;
mutationMode = "unsuccessful";
await assert.rejects(linear.updateIssueStatus("i1", "t-se-started"), (e) => e.kind === "api_error" && /did not accept the status/.test(e.message));
mutationMode = "gql-error";
await assert.rejects(linear.updateIssueStatus("i1", "t-se-started"), (e) => e.kind === "api_error" && /Entity not found/.test(e.message));
mode = "invalid";
await assert.rejects(linear.updateIssueStatus("i1", "t-se-started"), (e) => e.kind === "invalid_key");
mode = "ok";
mutationMode = "ok";
assert.equal(calls.length, 3, "one mutation attempt per failure");
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 0, "failed status mutations do not clear the cache");

// 20. A fetch that started before a mutation cannot repopulate the cache with stale data
linear.clearDashboardCache();
calls.length = 0;
const before = linear.getDashboardData(); // in flight
linear.clearDashboardCache(); // e.g. a mutation succeeded meanwhile
const after = linear.getDashboardData();
assert.notEqual(before, after, "in-flight fetch from an older generation is not reused");
await Promise.all([before, after]);
calls.length = 0;
await linear.getDashboardData();
assert.equal(calls.length, 0, "newest fetch cached");

// 21. Optimistic status change: stats, % done, person summaries, Show done visibility, sorting
const T = "2026-11-05";
const base = data.issues;
const statOf = (issues) => {
  const s = dash.getStats(issues, T);
  return { open: s.open, inProgress: s.inProgress, done: s.done, overdue: s.overdue, percentDone: s.percentDone };
};
assert.deepEqual(statOf(base), { open: 2, inProgress: 2, done: 1, overdue: 1, percentDone: 20 });
// SE-2 (Brian, started, overdue, Portal) -> Done
const se2 = base.find((i) => i.identifier === "SE-2");
const moved = dash.applyOverrides(base, { [se2.id]: { stateId: "t-se-completed" } }, data.teams);
const se2After = moved.find((i) => i.id === se2.id);
assert.deepEqual(se2After.state, { id: "t-se-completed", name: "Done", type: "completed" });
assert.equal(base.find((i) => i.id === se2.id).state.type, "started", "base data not mutated");
assert.deepEqual(statOf(moved), { open: 2, inProgress: 1, done: 2, overdue: 0, percentDone: 40 }, "overdue drops once done");
const portalAfter = moved.filter((i) => i.projectId === "p-portal");
assert.deepEqual(statOf(portalAfter), { open: 2, inProgress: 0, done: 1, overdue: 0, percentDone: 33 }, "per-project % done");
const brianAfter = moved.filter((i) => i.assignee?.id === VIEWER.id);
assert.deepEqual(statOf(brianAfter), { open: 0, inProgress: 0, done: 2, overdue: 0, percentDone: 100 }, "person summary");
// Brian's Portal project now only has done work: hidden with Show done off, shown with it on
const brianView = dash.visibleProjectSections(data.projects, brianAfter, { showDone: false });
assert.deepEqual(brianView.sections, [], "both of Brian's projects now hidden");
assert.equal(brianView.hiddenEmpty, 3);
assert.deepEqual(sectionNames(dash.visibleProjectSections(data.projects, brianAfter, { showDone: true })), [
  "Documentation (Partner SE)",
  "Partner Portal",
]);
const allAfter = dash.visibleProjectSections(data.projects, moved, { showDone: false });
assert.ok(!allAfter.sections.flatMap((s) => s.visible).some((i) => i.id === se2.id), "hidden when Show done is off");
assert.equal(allAfter.sections.find((s) => s.project.id === "p-portal").all.length, 3, "still counted in project stats");
// Reopen a done issue -> In Progress: re-sorted ahead of open/backlog work of the same priority
const se4 = base.find((i) => i.identifier === "SE-4"); // High, completed
const reopened = dash.applyOverrides(base, { [se4.id]: { stateId: "t-se-started" } }, data.teams);
assert.deepEqual(statOf(reopened), { open: 2, inProgress: 3, done: 0, overdue: 1, percentDone: 0 });
assert.deepEqual(dash.sortIssues(base.filter((i) => i.projectId === "p-docs")).map((i) => i.identifier), ["SE-6", "SE-4", "SE-5"]);
const docsSorted = dash.sortIssues(reopened.filter((i) => i.projectId === "p-docs")).map((i) => i.identifier);
assert.deepEqual(docsSorted, ["SE-4", "SE-6", "SE-5"]);
// Duplicate counts as closed: hidden without Show done, excluded from % done like canceled
const dup = dash.applyOverrides(base, { [se1.id]: { stateId: "t-se-duplicate" } }, data.teams);
assert.ok(dash.isDone(dup.find((i) => i.id === se1.id)));
assert.deepEqual(statOf(dup), { open: 1, inProgress: 2, done: 1, overdue: 1, percentDone: 25 });
// Foreign or unknown state ids are ignored; combined priority + status overrides apply together
const foreign = dash.applyOverrides(base, { [se1.id]: { stateId: "t-ops-started" } }, data.teams);
assert.equal(foreign.find((i) => i.id === se1.id), se1, "state from another team ignored");
const both = dash.applyOverrides(base, { [se1.id]: { priority: 1, stateId: "t-se-started" } }, data.teams);
const se1Both = both.find((i) => i.id === se1.id);
assert.deepEqual([se1Both.priority, se1Both.priorityLabel, se1Both.state.type], [1, "Urgent", "started"]);
assert.equal(dash.applyOverrides(base, {}, data.teams)[0], base[0], "no overrides: same objects");

console.log("verify: all checks passed");
