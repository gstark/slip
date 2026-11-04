import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { OTHER_PROJECT, PROJECT, expectCode, setup } from "./test.setup";

describe("events.list", () => {
  it("records each change, newest first, with the machine name", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    const b = await create("B");
    await t.mutation(api.tasks.update, { token, id: a.shortId, name: "A2", priority: 3 });
    await t.mutation(api.tasks.start, { token, id: a.shortId });
    await t.mutation(api.blockers.add, { token, blocked: a.shortId, blocker: b.shortId });
    await t.mutation(api.blockers.remove, { token, blocked: a.shortId, blocker: b.shortId });
    await t.mutation(api.tasks.complete, { token, id: a.shortId });
    await t.mutation(api.tasks.reopen, { token, id: a.shortId });
    await t.mutation(api.tasks.remove, { token, id: b.shortId });

    const events = await t.query(api.events.list, { token, projectKey: PROJECT });
    expect(events.map((event) => [event.kind, event.taskShortId, event.detail])).toEqual([
      ["deleted", b.shortId, null],
      ["reopened", a.shortId, null],
      ["closed", a.shortId, null],
      ["unblocked", a.shortId, b.shortId],
      ["blocked", a.shortId, b.shortId],
      ["started", a.shortId, null],
      ["edited", a.shortId, "name, priority"],
      ["created", b.shortId, null],
      ["created", a.shortId, null],
    ]);
    expect(events[0]).toMatchObject({ taskName: "B", machine: "test", projectKey: PROJECT });
    expect(events[6].taskName).toBe("A2");
  });

  it("records nothing for a change that changes nothing", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    await t.mutation(api.tasks.start, { token, id: a.shortId });
    await t.mutation(api.tasks.start, { token, id: a.shortId });
    await t.mutation(api.tasks.update, { token, id: a.shortId });
    await t.mutation(api.tasks.reopen, { token, id: a.shortId });
    const kinds = (await t.query(api.events.list, { token, task: a.shortId })).map((event) => event.kind);
    expect(kinds).toEqual(["started", "created"]);
  });

  it("logs a second close as an edit of the result", async () => {
    const { t, token, create } = await setup();
    const a = await create("A");
    await t.mutation(api.tasks.complete, { token, id: a.shortId });
    await t.mutation(api.tasks.complete, { token, id: a.shortId, result: "Done" });
    const [latest] = await t.query(api.events.list, { token, task: a.shortId });
    expect(latest).toMatchObject({ kind: "edited", detail: "result" });
  });

  it("logs a delete for each subtask", async () => {
    const { t, token, create } = await setup();
    const parent = await create("P");
    const child = await create("C", { parent: parent.shortId });
    await t.mutation(api.tasks.remove, { token, id: parent.shortId });
    const deleted = (await t.query(api.events.list, { token, projectKey: PROJECT }))
      .filter((event) => event.kind === "deleted")
      .map((event) => event.taskShortId);
    expect(deleted.sort()).toEqual([parent.shortId, child.shortId].sort());
  });

  it("filters by project, or shows all projects, and keeps the limit", async () => {
    const { t, token, create } = await setup();
    await create("A");
    await create("W", { projectKey: OTHER_PROJECT });
    await create("B");
    const own = await t.query(api.events.list, { token, projectKey: PROJECT });
    expect(own.map((event) => event.taskName)).toEqual(["B", "A"]);
    const all = await t.query(api.events.list, { token, allProjects: true, limit: 2 });
    expect(all.map((event) => event.taskName)).toEqual(["B", "W"]);
    expect(await t.query(api.events.list, { token, projectKey: "github.com/none/x" })).toEqual([]);
  });

  it("rejects a bad limit", async () => {
    const { t, token } = await setup();
    await expectCode(t.query(api.events.list, { token, allProjects: true, limit: 0 }), "INVALID_INPUT");
  });
});
