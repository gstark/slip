import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { MAX_ATTACHMENT_BYTES } from "./limits";
import { expectCode, setup } from "./test.setup";

type Setup = Awaited<ReturnType<typeof setup>>;

/** Puts bytes in storage, like a POST to the upload URL. */
function upload(t: Setup["t"], text = "png bytes", type = "image/png") {
  return t.run((ctx) => ctx.storage.store(new Blob([text], { type })));
}

async function storedFiles(t: Setup["t"]) {
  return t.run((ctx) => ctx.db.system.query("_storage").collect());
}

describe("attachments", () => {
  it("gives an upload URL", async () => {
    const { t, token } = await setup();
    expect(await t.mutation(api.attachments.uploadUrl, { token })).toEqual(expect.any(String));
  });

  it("puts a file on a task and shows it in tasks.get and the log", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const storageId = await upload(t);
    const added = await t.mutation(api.attachments.add, { token, id: task.shortId, storageId, name: " shot.png " });
    expect(added).toMatchObject({ name: "shot.png", contentType: "image/png", size: 9, url: expect.any(String) });

    const detail = await t.query(api.tasks.get, { token, id: task.shortId });
    expect(detail.attachments).toEqual([added]);
    const events = await t.query(api.events.list, { token, task: task.shortId });
    expect(events[0]).toMatchObject({ kind: "attached", detail: "shot.png" });
  });

  it("replaces a file with the same name and deletes the old bytes", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await t.mutation(api.attachments.add, { token, id: task.shortId, storageId: await upload(t, "old"), name: "a.txt" });
    const newId = await upload(t, "newer", "image/jpeg");
    await t.mutation(api.attachments.add, { token, id: task.shortId, storageId: newId, name: "a.txt" });

    const detail = await t.query(api.tasks.get, { token, id: task.shortId });
    expect(detail.attachments).toEqual([expect.objectContaining({ name: "a.txt", size: 5, contentType: "image/jpeg" })]);
    expect((await storedFiles(t)).map((file) => file._id)).toEqual([newId]);
  });

  it("rejects a bad name and an unknown task", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const storageId = await upload(t);
    for (const name of ["", "  ", ".", "..", "a/b.png", "a\\b", "a\nb"]) {
      await expectCode(t.mutation(api.attachments.add, { token, id: task.shortId, storageId, name }), "INVALID_INPUT");
    }
    await expectCode(t.mutation(api.attachments.add, { token, id: "missing", storageId, name: "a" }), "NOT_FOUND");
  });

  it("rejects a file above the limit", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    const storageId = await upload(t, "x".repeat(MAX_ATTACHMENT_BYTES + 1));
    await expectCode(t.mutation(api.attachments.add, { token, id: task.shortId, storageId, name: "big" }), "INVALID_INPUT");
  });

  it("removes a file from the task and from storage", async () => {
    const { t, token, create } = await setup();
    const task = await create("A");
    await t.mutation(api.attachments.add, { token, id: task.shortId, storageId: await upload(t), name: "a.png" });
    expect(await t.mutation(api.attachments.remove, { token, id: task.shortId, name: "a.png" })).toBe("a.png");

    expect((await t.query(api.tasks.get, { token, id: task.shortId })).attachments).toEqual([]);
    expect(await storedFiles(t)).toEqual([]);
    const events = await t.query(api.events.list, { token, task: task.shortId });
    expect(events[0]).toMatchObject({ kind: "detached", detail: "a.png" });
    await expectCode(t.mutation(api.attachments.remove, { token, id: task.shortId, name: "a.png" }), "NOT_FOUND");
  });

  it("deletes the files of a deleted task and its subtasks", async () => {
    const { t, token, create } = await setup();
    const parent = await create("Parent");
    const child = await create("Child", { parent: parent.shortId });
    await t.mutation(api.attachments.add, { token, id: parent.shortId, storageId: await upload(t), name: "p.png" });
    await t.mutation(api.attachments.add, { token, id: child.shortId, storageId: await upload(t), name: "c.png" });
    await t.mutation(api.tasks.remove, { token, id: parent.shortId });

    expect(await t.run((ctx) => ctx.db.query("attachments").collect())).toEqual([]);
    expect(await storedFiles(t)).toEqual([]);
  });

  it("requires a valid token", async () => {
    const { t } = await setup();
    await expectCode(t.mutation(api.attachments.uploadUrl, { token: "bad" }), "UNAUTHORIZED");
  });
});
