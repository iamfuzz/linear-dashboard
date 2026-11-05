# Partner SE Linear Dashboard

A small Next.js app that shows the issues in the Linear initiative **AMER Partner SE Programs** (I-503): a **Projects** tab with every issue grouped by project, plus one tab per assignee (the API key owner first, then alphabetical).

## Install (for teammates)

You need an Apple Silicon Mac (M1 or newer) with macOS 13.5 or later. You don't need Node, npm, or GitHub.

1. **Unzip** `LinearDashboard-<version>-arm64.zip` (double-click it).
2. **Drag** `LinearDashboard.app` into your **Applications** folder.
3. **Allow it to open (once per Mac).** Double-click the app. The app is not signed with an Apple developer certificate, so macOS shows "Apple could not verify "LinearDashboard.app" is free of malware...". This is expected.
   - Click **Done** (not **Move to Trash**).
   - Open **System Settings > Privacy & Security**, scroll down to the **Security** section, and click **Open Anyway** next to the message about LinearDashboard.app.
   - Authenticate with your password or Touch ID, then click **Open Anyway** again in the confirmation dialog.
   - You only need to do this once per Mac.
   - If that doesn't work, run this once in Terminal instead: `/usr/bin/xattr -dr com.apple.quarantine /Applications/LinearDashboard.app`
   - On older macOS (before Sequoia 15), right-click the app > **Open**, then click **Open** in the dialog. On macOS 15 and later this no longer works; use the steps above.
4. **Paste your Linear API key.** Your browser opens a setup page. Create a key in Linear (Settings > Security & access > Personal API keys > New key), paste it, and click **Save key**. The app checks the key with Linear before saving it.
5. The dashboard opens. After this, a double-click opens it straight away.

Good to know:

- **It runs in your browser.** The app starts a small server on your Mac, only at `http://127.0.0.1` (not reachable from other machines), and opens the dashboard in your default browser. It has no Dock icon. Opening the app again just opens the dashboard again.
- **Quit:** click **Quit** in the dashboard header. Closing the browser tab does not stop it. Logging out or restarting also stops it.
- **Your key** is stored in your macOS Keychain, not in a file. To change it, click **Change API key** in the dashboard. To remove it, open Keychain Access, search for **LinearDashboard**, and delete that item.
- **What you see:** the dashboard shows what your Linear account can see. Priority and status changes are made in Linear as you.
- **Updating:** quit the app, replace `LinearDashboard.app` in Applications with the new version, and open it. You may need to do the **Open Anyway** step (step 3) again. Your key stays in the Keychain.
- **Logs:** `~/Library/Logs/LinearDashboard.log` (no keys are logged).

## Setup

1. **Create a Linear API key:** Linear, then Settings > Security & access > Personal API keys > New key.
2. **Give the app the key**, in one of two ways:
   - Create `.env.local` in this folder:

     ```
     LINEAR_API_KEY=lin_api_...
     # Optional: track a different initiative by UUID (default is I-503)
     # INITIATIVE_ID=b8fdca15-b6d3-4304-b937-cbf50cee4829
     ```

   - Or skip `.env.local`. Start the app and paste the key on the `/setup` page, which saves it in the macOS Keychain (service `LinearDashboard`).

   If both are set, `LINEAR_API_KEY` wins. The key is only read on the server. It is never sent to the browser or logged.
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

- **Change API key** (header link) opens `/setup`. If the key is missing, the dashboard sends you to `/setup`. If Linear rejects the key, the error links there.

## Scripts

- `npm run dev`, `npm run build`, `npm run start`, `npm run lint`
- `npm run package:mac` builds `dist/LinearDashboard-<version>-arm64.zip` for teammates (see below).
- `npm run verify` checks the data layer and the sort, group, and stat helpers against a mocked Linear API. It also checks empty-project hiding and the priority and status changes: input checks, the team check for statuses, the mutation request, cache clearing, failures, and stats after a status change. It needs no key and never calls the real Linear API. It also checks API key handling with a mocked Keychain: `LINEAR_API_KEY` first, then the Keychain, the key format checks, saving through `security -i` on stdin (never on the command line), and key validation with a read-only `viewer` query.

## Building the Mac app

`npm run package:mac` (on an Apple Silicon Mac) runs `scripts/package-mac.sh`. The script:

1. Runs `next build` with `output: "standalone"`. It runs `npm ci` first only if `node_modules` is missing, or if you set `PACKAGE_MAC_CLEAN_INSTALL=1`. npm packages still come from Chainguard Libraries via `.npmrc`.
2. Downloads the official Node.js **current LTS** for darwin-arm64 from nodejs.org. It looks up the version in `index.json` and checks the tarball against `SHASUMS256.txt`. This is the one upstream item, because Chainguard doesn't publish a macOS Node binary. Downloads are cached in `dist/.cache`.
3. Builds `dist/LinearDashboard.app`: the standalone server with `.next/static`, the Node binary, the launcher (`scripts/mac/launcher.sh`), and `Info.plist` (`scripts/mac/Info.plist.template`). It checks that no `.env*`, `.npmrc`, or key-like string is in the bundle.
4. Signs the app ad-hoc (`codesign --sign -`) and zips it with `ditto`.

The launcher starts the server on `127.0.0.1`, on port 3100 or the next free port, then opens the browser. It sets `LINEAR_DASHBOARD_APP=1`, which turns on the **Quit** button. For testing, `LINEAR_DASHBOARD_PORT` sets the first port to try, and `LINEAR_DASHBOARD_NO_BROWSER=1` stops it opening a browser.

The initiative (AMER Partner SE Programs) is built in, so share the zip directly. Do not publish it publicly.
