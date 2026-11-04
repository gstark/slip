import { describe, expect, it, vi } from "vitest";
import type { EventView, TixClient } from "../client.ts";
import { PROJECT, fakeClient, runCli } from "../test.setup.ts";

function event(fields: Partial<EventView> = {}): EventView {
  return {
    at: new Date(2026, 10, 4, 9, 5).getTime(),
    projectKey: PROJECT,
    taskShortId: "a1",
    taskName: "Fix",
    kind: "closed",
    detail: null,
    machine: "laptop",
    ...fields,
  };
}

function logging(events = [event()]) {
  const listEvents = vi.fn<TixClient["listEvents"]>(async () => events);
  return { listEvents, client: fakeClient({ listEvents }) };
}

describe("tix log", () => {
  it("shows the activity of the git remote project", async () => {
    const { listEvents, client } = logging([event(), event({ kind: "edited", detail: "name, priority" })]);
    const { code, out } = await runCli(["log"], { client });
    expect(code).toBe(0);
    expect(out).toBe(
      [
        "2026-11-04 09:05  closed    a1: Fix @laptop",
        "2026-11-04 09:05  edited    a1: Fix (name, priority) @laptop",
      ].join("\n"),
    );
    expect(listEvents).toHaveBeenCalledWith({ projectKey: PROJECT, allProjects: false, task: undefined, limit: undefined });
  });

  it("names the blocker and the project with --all-projects", async () => {
    const { listEvents, client } = logging([event({ kind: "blocked", detail: "b1" })]);
    const remoteUrl = vi.fn(async () => null);
    const { out } = await runCli(["log", "--all-projects", "-n", "5"], { client, git: { remoteUrl } });
    expect(out).toBe(`2026-11-04 09:05  blocked   ${PROJECT} a1: Fix (blocker b1) @laptop`);
    expect(listEvents).toHaveBeenCalledWith({ projectKey: undefined, allProjects: true, task: undefined, limit: 5 });
    expect(remoteUrl).not.toHaveBeenCalled();
  });

  it("shows one task and does not read git", async () => {
    const { listEvents, client } = logging([]);
    const remoteUrl = vi.fn(async () => null);
    expect(await runCli(["log", "a1"], { client, git: { remoteUrl } })).toMatchObject({ code: 0, out: "No activity" });
    expect(listEvents).toHaveBeenCalledWith(expect.objectContaining({ task: "a1", projectKey: undefined }));
    expect(remoteUrl).not.toHaveBeenCalled();
  });

  it("rejects a limit that is not an integer", async () => {
    expect(await runCli(["log", "--limit", "ten"])).toMatchObject({ code: 1 });
  });
});
