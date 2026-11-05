# Partner SE Linear Dashboard

A small Next.js app that shows the issues in the Linear initiative **AMER Partner SE Programs** (I-503): a **Projects** tab with every issue grouped by project, plus one tab per assignee (the API key owner first, then alphabetical).

## Setup

1. **Create a Linear API key:** Linear, then Settings > Security & access > Personal API keys > New key.
2. **Create `.env.local`** in this folder:

   ```
   LINEAR_API_KEY=lin_api_...
   # Optional: track a different initiative by UUID (default is I-503)
   # INITIATIVE_ID=b8fdca15-b6d3-4304-b937-cbf50cee4829
   ```

   The key is only read on the server and never sent to the browser.
3. **Install dependencies:** `npm install` (packages come from Chainguard Libraries via `.npmrc`).
   If you get a `401`, re-run `chainctl auth configure-npm` in this folder.
   If you get `EALLOWREMOTE` (npm 12+), run `npm install --allow-remote=all`. Chainguard serves some tarballs from a sibling path on the same host, and npm 12 refuses that by default.
4. **Run:** `npm run dev`, then open http://localhost:3000

## Usage

- Tabs are in the URL (`?tab=projects`, `?tab=brian-thomason`), so you can link to them.
- **Show done** includes completed and canceled issues. They are hidden by default.
- Issues are sorted Urgent > High > Medium > Low > No priority, then by status and due date.
- Projects with no issues in the current view are hidden, on the Projects tab and on person tabs. With **Show done** off, a project that only has done or canceled issues counts as empty. A footnote shows how many projects were hidden.
- **Change priority:** click an issue's priority badge and pick No priority, Urgent, High, Medium, or Low. This writes to Linear right away (`issueUpdate`). The row moves to its new place at once. If Linear rejects the change, the row goes back and an error shows under it. The API key needs write access for this.
- **Change status:** click an issue's status badge and pick one of its team's statuses (for example Backlog, Todo, In Progress, Done). The list only shows the statuses of that issue's own team, in Linear's order. This writes to Linear right away (`issueUpdate` with `stateId`). The server first checks that the status belongs to the issue's team. The row, the stats, % done, and tab counts update at once. If you move an issue to Done, Canceled, or Duplicate while **Show done** is off, the row disappears and a short note says so. If Linear rejects the change, the row goes back and an error shows under it.
- Done, Canceled, and Duplicate statuses all count as done.
- Data is cached on the server for about 60 seconds. The page refreshes itself every 60 seconds while the tab is visible. It pauses when the tab is hidden and skips a refresh while a priority or status change is still saving. **Refresh** fetches fresh data right away.

## Scripts

- `npm run dev`, `npm run build`, `npm run start`, `npm run lint`
- `npm run verify` checks the data layer and the sort, group, and stat helpers against a mocked Linear API. It also checks empty-project hiding and the priority and status changes: input checks, the team check for statuses, the mutation request, cache clearing, failures, and stats after a status change. It needs no key and never calls the real Linear API.
