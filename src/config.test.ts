import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configPath, loadConfig, saveConfig } from "./config.ts";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "slip-config-"));
  path = join(dir, "nested", "config.toml");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("configPath", () => {
  it("uses SLIP_CONFIG", () => {
    expect(configPath({ SLIP_CONFIG: "/x/slip.toml" })).toBe("/x/slip.toml");
  });

  it("defaults to ~/.config/slip/config.toml", () => {
    expect(configPath({})).toMatch(/\.config\/slip\/config\.toml$/);
  });
});

describe("loadConfig", () => {
  it("reads the file that saveConfig writes", async () => {
    await saveConfig({ SLIP_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "slip_a" });
    expect(await loadConfig({ SLIP_CONFIG: path })).toEqual({ convexUrl: "https://a.convex.cloud", token: "slip_a" });
  });

  it("lets SLIP_CONVEX_URL and SLIP_TOKEN override the file", async () => {
    await saveConfig({ SLIP_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "slip_a" });
    const env = { SLIP_CONFIG: path, SLIP_CONVEX_URL: "https://b.convex.cloud", SLIP_TOKEN: "slip_b" };
    expect(await loadConfig(env)).toEqual({ convexUrl: "https://b.convex.cloud", token: "slip_b" });
  });

  it("works with environment variables and no file", async () => {
    const env = { SLIP_CONFIG: path, SLIP_CONVEX_URL: "https://b.convex.cloud", SLIP_TOKEN: "slip_b" };
    expect(await loadConfig(env)).toEqual({ convexUrl: "https://b.convex.cloud", token: "slip_b" });
  });

  it("fails with CONFIG when a value is missing", async () => {
    await expect(loadConfig({ SLIP_CONFIG: path, SLIP_TOKEN: "slip_b" })).rejects.toMatchObject({
      code: "CONFIG",
      message: expect.stringContaining("slip login"),
    });
  });

  it("fails with CONFIG when the file is not TOML", async () => {
    const bad = join(dir, "bad.toml");
    writeFileSync(bad, "convex_url = ");
    await expect(loadConfig({ SLIP_CONFIG: bad })).rejects.toMatchObject({ code: "CONFIG" });
  });
});

describe("saveConfig", () => {
  it("writes the file with mode 0600, also over an existing file", async () => {
    await saveConfig({ SLIP_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "slip_a" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    chmodSync(path, 0o644);
    await saveConfig({ SLIP_CONFIG: path }, { convexUrl: "https://a.convex.cloud", token: "slip_a" });
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
