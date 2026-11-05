import "server-only";

import { execFile } from "node:child_process";

// Where the Linear API key comes from, in order:
//   1. LINEAR_API_KEY in the environment (e.g. .env.local during development)
//   2. the macOS Keychain, generic password with service "LinearDashboard"
// The key is never logged, never written to a file, and never passed on a command line.

export const KEYCHAIN_SERVICE = "LinearDashboard";
export const KEYCHAIN_ACCOUNT = "linear-api-key";
const SECURITY_BIN = "/usr/bin/security";

export type KeySource = "env" | "keychain" | "none";

/** Runs /usr/bin/security with the given args and optional stdin. Replaceable in tests. */
export type SecurityRunner = (
  args: string[],
  input?: string,
) => Promise<{ code: number; stdout: string }>;

const defaultRunner: SecurityRunner = (args, input) =>
  new Promise((resolve) => {
    const child = execFile(
      SECURITY_BIN,
      args,
      {
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        // Minimal env: do not hand LINEAR_API_KEY or anything else to the child.
        env: { NODE_ENV: process.env.NODE_ENV, PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "" },
      },
      (err, stdout) => {
        const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
        resolve({ code, stdout: String(stdout ?? "") });
      },
    );
    child.stdin?.end(input ?? "");
  });

let runner: SecurityRunner = defaultRunner;
let cachedKeychainKey: string | null = null;
// Optional keychain file (tests only); undefined means the user's default keychain.
let keychainPath: string | undefined;

/** Test hook: swap the `security` runner (and optionally target a keychain file). Clears the cache. */
export function _setSecurityRunnerForTests(r: SecurityRunner | null, keychain?: string): void {
  runner = r ?? defaultRunner;
  keychainPath = keychain;
  cachedKeychainKey = null;
}

const KEY_RE = /^[A-Za-z0-9_-]+$/;

export type KeyCheck = { ok: true; key: string } | { ok: false; error: string };

/** Shape check before any network call. Linear personal API keys look like lin_api_<letters/digits>. */
export function checkApiKeyFormat(raw: unknown): KeyCheck {
  if (typeof raw !== "string") return { ok: false, error: "Paste your Linear API key." };
  const key = raw.trim();
  if (!key) return { ok: false, error: "Paste your Linear API key." };
  if (key.length < 20 || key.length > 200 || !KEY_RE.test(key)) {
    return {
      ok: false,
      error: "That does not look like a Linear API key. It should start with lin_api_ and have no spaces.",
    };
  }
  if (!key.startsWith("lin_api_")) {
    return { ok: false, error: "Linear personal API keys start with lin_api_. Check that you copied the whole key." };
  }
  return { ok: true, key };
}

function envKey(): string | null {
  const v = process.env.LINEAR_API_KEY?.trim();
  return v ? v : null;
}

async function readKeychain(): Promise<string | null> {
  if (process.platform !== "darwin" && runner === defaultRunner) return null;
  if (cachedKeychainKey) return cachedKeychainKey;
  const args = ["find-generic-password", "-a", KEYCHAIN_ACCOUNT, "-s", KEYCHAIN_SERVICE, "-w"];
  if (keychainPath) args.push(keychainPath);
  try {
    const { code, stdout } = await runner(args);
    const key = code === 0 ? stdout.trim() : "";
    if (!key) return null; // 44 = not found; anything else is treated as "no key"
    cachedKeychainKey = key;
    return key;
  } catch {
    return null;
  }
}

/** The key to use, or null. Env wins over the Keychain. */
export async function getApiKey(): Promise<string | null> {
  return envKey() ?? (await readKeychain());
}

export async function getKeySource(): Promise<KeySource> {
  if (envKey()) return "env";
  return (await readKeychain()) ? "keychain" : "none";
}

/**
 * Save (or replace) the key in the Keychain. The command goes to `security -i` on stdin,
 * hex-encoded, so the key never appears in argv / `ps` and cannot break the command parsing.
 */
export async function saveApiKeyToKeychain(rawKey: string): Promise<void> {
  const check = checkApiKeyFormat(rawKey);
  if (!check.ok) throw new Error(check.error);
  const hex = Buffer.from(check.key, "utf8").toString("hex");
  let cmd =
    `add-generic-password -U -a ${KEYCHAIN_ACCOUNT} -s ${KEYCHAIN_SERVICE}` +
    ` -l "Linear Dashboard API key" -X ${hex}`;
  if (keychainPath) cmd += ` "${keychainPath.replace(/"/g, "")}"`;
  const { code } = await runner(["-i"], `${cmd}\n`);
  if (code !== 0) throw new Error("Could not save the key to the macOS Keychain.");
  cachedKeychainKey = check.key;
}
