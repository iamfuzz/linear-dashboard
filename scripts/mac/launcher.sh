#!/bin/bash
# LinearDashboard.app launcher (Contents/MacOS/LinearDashboard).
# Starts the bundled Next.js server with the bundled Node on 127.0.0.1, then opens the browser.
# If our server is already running, it just opens the browser again.
#
# Optional env (for testing): LINEAR_DASHBOARD_PORT (preferred port, default 3100),
# LINEAR_DASHBOARD_NO_BROWSER=1 (do not open a browser or show alerts).
set -u
export PATH=/usr/bin:/bin:/usr/sbin:/sbin
: "${HOME:=$(cd ~ && pwd)}"
export HOME

CONTENTS="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$CONTENTS/Resources/node/bin/node"
APP_DIR="$CONTENTS/Resources/app"
SUPPORT="$HOME/Library/Application Support/LinearDashboard"
LOG_DIR="$HOME/Library/Logs"
LOG="$LOG_DIR/LinearDashboard.log"
PID_FILE="$SUPPORT/server.pid"
PORT_FILE="$SUPPORT/server.port"
PREFERRED_PORT="${LINEAR_DASHBOARD_PORT:-3100}"
NO_BROWSER="${LINEAR_DASHBOARD_NO_BROWSER:-}"

mkdir -p "$SUPPORT" "$LOG_DIR"
# Keep the log small: rotate once it passes ~5 MB.
if [ -f "$LOG" ] && [ "$(stat -f %z "$LOG" 2>/dev/null || echo 0)" -gt 5000000 ]; then
  mv -f "$LOG" "$LOG.old"
fi
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [launcher] $*" >>"$LOG"; }

alert() {
  log "$1"
  [ "$NO_BROWSER" = "1" ] && return
  /usr/bin/osascript -e "display alert \"Linear Dashboard\" message \"$1\" as critical" >/dev/null 2>&1 || true
}

open_browser() {
  log "ready on http://127.0.0.1:$1/"
  [ "$NO_BROWSER" = "1" ] && return
  /usr/bin/open "http://127.0.0.1:$1/"
}

# Is our server (this pid) listening on this port and answering the health check?
is_ours() {
  local pid="$1" port="$2"
  kill -0 "$pid" 2>/dev/null || return 1
  /usr/sbin/lsof -nP -a -p "$pid" -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 || return 1
  /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:$port/api/health" 2>/dev/null \
    | grep -q '"app":"LinearDashboard"'
}

port_free() {
  ! /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# 1. Already running? Just open the browser.
if [ -f "$PID_FILE" ] && [ -f "$PORT_FILE" ]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null)"
  old_port="$(cat "$PORT_FILE" 2>/dev/null)"
  if [ -n "$old_pid" ] && [ -n "$old_port" ] && is_ours "$old_pid" "$old_port"; then
    log "already running (pid $old_pid)"
    open_browser "$old_port"
    exit 0
  fi
  rm -f "$PID_FILE" "$PORT_FILE"
fi

if [ ! -x "$NODE" ] || [ ! -f "$APP_DIR/server.js" ]; then
  alert "The app bundle is incomplete. Please download it again."
  exit 1
fi

# 2. Pick a free port, preferring 3100.
port=""
for ((p = PREFERRED_PORT; p < PREFERRED_PORT + 50; p++)); do
  if port_free "$p"; then port="$p"; break; fi
done
if [ -z "$port" ]; then
  alert "No free port found near $PREFERRED_PORT."
  exit 1
fi

# 3. Start the server, detached, bound to localhost only.
log "starting on 127.0.0.1:$port with $("$NODE" --version 2>/dev/null)"
cd "$APP_DIR" || exit 1
LINEAR_DASHBOARD_APP=1 HOSTNAME=127.0.0.1 PORT="$port" NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  nohup "$NODE" "$APP_DIR/server.js" >>"$LOG" 2>&1 </dev/null &
pid=$!
echo "$pid" >"$PID_FILE"
echo "$port" >"$PORT_FILE"

# 4. Wait for it to answer, then open the browser.
for _ in $(seq 1 120); do
  if is_ours "$pid" "$port"; then
    open_browser "$port"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$PID_FILE" "$PORT_FILE"
    alert "Linear Dashboard could not start. Details are in ~/Library/Logs/LinearDashboard.log"
    exit 1
  fi
  sleep 0.25
done
alert "Linear Dashboard is taking too long to start. Details are in ~/Library/Logs/LinearDashboard.log"
exit 1
