#!/bin/bash
# Build dist/LinearDashboard-<version>-arm64.zip: a double-click Mac app (Apple Silicon) with the
# Next.js standalone server and its own Node runtime. Run with: npm run package:mac
#
# - npm packages come from Chainguard Libraries via the existing .npmrc (not touched here).
# - The Node runtime is the one upstream item: the official nodejs.org darwin-arm64 tarball of
#   the current LTS, looked up from https://nodejs.org/dist/index.json and checked against the
#   published SHASUMS256.txt. (Chainguard does not publish a macOS Node binary.)
# - The app is ad-hoc signed only. Recipients allow it once per Mac: click Done on the malware
#   warning, then System Settings > Privacy & Security > Open Anyway (see README). Right-click >
#   Open only works on macOS before Sequoia 15.
#
# Env: PACKAGE_MAC_CLEAN_INSTALL=1 runs `npm ci` first (otherwise only when node_modules is missing).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="LinearDashboard"
VERSION="$(node -p 'require("./package.json").version')"
DIST="$ROOT/dist"
CACHE="$DIST/.cache/node"
APP="$DIST/$APP_NAME.app"
ZIP="$DIST/$APP_NAME-$VERSION-arm64.zip"
NODE_DIST="https://nodejs.org/dist"

step() { printf '\n==> %s\n' "$*"; }
die() { printf 'package-mac: %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "run this on macOS"

# 1. Dependencies (only if needed; never rewrites .npmrc)
if [ ! -d node_modules ] || [ "${PACKAGE_MAC_CLEAN_INSTALL:-}" = "1" ]; then
  step "npm ci"
  NPM_LOG="$(mktemp)"
  if ! npm ci 2>&1 | tee "$NPM_LOG"; then
    if grep -q EALLOWREMOTE "$NPM_LOG"; then
      npm ci --allow-remote=all
    elif grep -qE 'E401|401 Unauthorized' "$NPM_LOG"; then
      rm -f "$NPM_LOG"
      die "npm got 401 from Chainguard Libraries. Re-run: chainctl auth configure-npm (in this folder)"
    else
      rm -f "$NPM_LOG"
      die "npm ci failed"
    fi
  fi
  rm -f "$NPM_LOG"
fi

# 2. Next.js standalone build
step "next build (standalone)"
NEXT_TELEMETRY_DISABLED=1 npx --no-install next build
STANDALONE="$ROOT/.next/standalone"
[ -f "$STANDALONE/server.js" ] || die "no .next/standalone/server.js (is output: \"standalone\" set?)"

# 3. Node runtime: current LTS, official darwin-arm64 tarball, checksum-verified
step "Node.js runtime (current LTS, darwin-arm64)"
mkdir -p "$CACHE"
curl -fsSL "$NODE_DIST/index.json" -o "$CACHE/index.json"
NODE_VERSION="$(node -e '
  const all = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const lts = all.find((r) => r.lts && r.files.includes("osx-arm64-tar"));
  if (!lts) process.exit(1);
  process.stdout.write(lts.version);
' "$CACHE/index.json")" || die "could not find an LTS release in index.json"
[[ "$NODE_VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "unexpected Node version: $NODE_VERSION"
TARBALL="node-$NODE_VERSION-darwin-arm64.tar.gz"
echo "Node $NODE_VERSION"
curl -fsSL "$NODE_DIST/$NODE_VERSION/SHASUMS256.txt" -o "$CACHE/SHASUMS256-$NODE_VERSION.txt"
EXPECTED="$(awk -v f="$TARBALL" '$2 == f { print $1 }' "$CACHE/SHASUMS256-$NODE_VERSION.txt")"
[ -n "$EXPECTED" ] || die "$TARBALL not listed in SHASUMS256.txt"
if [ ! -f "$CACHE/$TARBALL" ] || [ "$(shasum -a 256 "$CACHE/$TARBALL" | awk '{print $1}')" != "$EXPECTED" ]; then
  curl -fsSL "$NODE_DIST/$NODE_VERSION/$TARBALL" -o "$CACHE/$TARBALL.part"
  mv "$CACHE/$TARBALL.part" "$CACHE/$TARBALL"
fi
ACTUAL="$(shasum -a 256 "$CACHE/$TARBALL" | awk '{print $1}')"
[ "$ACTUAL" = "$EXPECTED" ] || { rm -f "$CACHE/$TARBALL"; die "checksum mismatch for $TARBALL"; }
echo "sha256 OK $ACTUAL"

# 4. Assemble the .app
step "assemble $APP_NAME.app"
rm -rf "$APP" "$ZIP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/node/bin"
EXTRACT="$(mktemp -d)"
trap 'rm -rf "$EXTRACT"' EXIT
tar -xzf "$CACHE/$TARBALL" -C "$EXTRACT" \
  "node-$NODE_VERSION-darwin-arm64/bin/node" "node-$NODE_VERSION-darwin-arm64/LICENSE"
cp "$EXTRACT/node-$NODE_VERSION-darwin-arm64/bin/node" "$APP/Contents/Resources/node/bin/node"
cp "$EXTRACT/node-$NODE_VERSION-darwin-arm64/LICENSE" "$APP/Contents/Resources/node/LICENSE"
echo "$NODE_VERSION" >"$APP/Contents/Resources/node/VERSION"
# The app needs whatever macOS the bundled Node binary was built for (LC_BUILD_VERSION minos).
MIN_MACOS="$(/usr/bin/otool -l "$APP/Contents/Resources/node/bin/node" | awk '/LC_BUILD_VERSION/ { f = 1 } f && $1 == "minos" { print $2; exit }')"
[[ "$MIN_MACOS" =~ ^[0-9]+(\.[0-9]+)*$ ]] || die "could not read the Node binary's minimum macOS version"
if /usr/bin/otool -L "$APP/Contents/Resources/node/bin/node" | grep -q /opt/homebrew; then
  die "bundled node links to /opt/homebrew"
fi

# Standalone server + static assets (+ public/ if present), as the Next.js docs describe.
cp -R "$STANDALONE" "$APP/Contents/Resources/app"
mkdir -p "$APP/Contents/Resources/app/.next"
cp -R "$ROOT/.next/static" "$APP/Contents/Resources/app/.next/static"
[ -d "$ROOT/public" ] && cp -R "$ROOT/public" "$APP/Contents/Resources/app/public"

# Never ship secrets or local config.
find "$APP/Contents/Resources/app" \( -name '.env' -o -name '.env.*' -o -name '.npmrc' \) -prune -exec rm -rf {} +
if find "$APP" \( -name '.env*' -o -name '.npmrc' \) | grep -q .; then die "secret file left in bundle"; fi
if grep -rIl 'lin_api_[A-Za-z0-9]\{20,\}' "$APP/Contents/Resources/app" >/dev/null 2>&1; then
  die "something that looks like a Linear API key is in the bundle"
fi

cp "$ROOT/scripts/mac/launcher.sh" "$APP/Contents/MacOS/$APP_NAME"
chmod 755 "$APP/Contents/MacOS/$APP_NAME" "$APP/Contents/Resources/node/bin/node"
sed -e "s/__VERSION__/$VERSION/g" -e "s/__MIN_MACOS__/$MIN_MACOS/g" \
  "$ROOT/scripts/mac/Info.plist.template" >"$APP/Contents/Info.plist"
/usr/bin/plutil -lint "$APP/Contents/Info.plist" >/dev/null

# 5. Ad-hoc sign (Apple Silicon needs some signature) and zip with ditto (keeps the bundle intact)
step "codesign (ad-hoc) + zip"
/usr/bin/xattr -cr "$APP"
/usr/bin/codesign --force --deep --sign - "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP" "$ZIP"

step "done"
echo "App:  $APP"
echo "Zip:  $ZIP ($(du -h "$ZIP" | awk '{print $1}'))"
echo "Node: $NODE_VERSION (darwin-arm64, sha256 verified)  min macOS: $MIN_MACOS"
