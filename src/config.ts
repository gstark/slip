import { access, chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parse, stringify } from "smol-toml";
import { SlipError } from "./errors.ts";

export type Config = { convexUrl: string; token: string };

type Env = Record<string, string | undefined>;

export function configPath(env: Env): string {
  return env.SLIP_CONFIG ?? join(homedir(), ".config", "slip", "config.toml");
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Moves `~/.config/tix` to `~/.config/slip` once. The tool was called tix before 2026-11. */
async function moveLegacyConfigDir(env: Env): Promise<void> {
  if (env.SLIP_CONFIG !== undefined) return;
  const current = dirname(configPath(env));
  try {
    await access(current);
    return;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  try {
    await rename(join(homedir(), ".config", "tix"), current);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

async function readTable(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
  try {
    return parse(text);
  } catch {
    throw new SlipError("CONFIG", `Cannot parse ${path}. It must be TOML`);
  }
}

/** Reads the file, then applies SLIP_CONVEX_URL and SLIP_TOKEN on top. */
export async function loadConfig(env: Env): Promise<Config> {
  await moveLegacyConfigDir(env);
  const path = configPath(env);
  const table = await readTable(path);
  const convexUrl = env.SLIP_CONVEX_URL ?? table.convex_url;
  const token = env.SLIP_TOKEN ?? table.token;
  if (typeof convexUrl !== "string" || typeof token !== "string" || convexUrl === "" || token === "") {
    throw new SlipError("CONFIG", `No Convex URL or token in ${path}. Run slip login --url <url> --token <token>`);
  }
  return { convexUrl, token };
}

/** Writes the file with mode 0600 and returns its path. */
export async function saveConfig(env: Env, config: Config): Promise<string> {
  await moveLegacyConfigDir(env);
  const path = configPath(env);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, stringify({ convex_url: config.convexUrl, token: config.token }) + "\n", { mode: 0o600 });
  // writeFile does not change the mode of a file that already exists.
  await chmod(path, 0o600);
  return path;
}
