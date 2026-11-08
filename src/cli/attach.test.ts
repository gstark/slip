import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentView, SlipClient, StorageId } from "../client.ts";
import { fakeClient, runCli, taskDetail } from "../test.setup.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "slip-attach-"));
});

afterEach(() => rm(dir, { recursive: true, force: true }));

function attachment(fields: Partial<AttachmentView> = {}): AttachmentView {
  return { name: "shot.png", contentType: "image/png", size: 2048, url: "https://x/1", createdAt: 0, ...fields };
}

function attaching() {
  const uploadFile = vi.fn<SlipClient["uploadFile"]>(async () => "storage1" as StorageId);
  const addAttachment = vi.fn<SlipClient["addAttachment"]>(async (args) => attachment({ name: args.name }));
  return { uploadFile, addAttachment, client: fakeClient({ uploadFile, addAttachment }) };
}

describe("slip attach", () => {
  it("uploads each file and names it by the file name", async () => {
    await writeFile(join(dir, "shot.png"), "png");
    await writeFile(join(dir, "notes.txt"), "text");
    const { uploadFile, addAttachment, client } = attaching();
    const result = await runCli(["attach", "a1", "shot.png", "notes.txt"], { client, cwd: dir });
    expect(result).toEqual({
      code: 0,
      out: "Attached shot.png (2.0 KB) to a1\nAttached notes.txt (2.0 KB) to a1",
      err: "",
    });
    expect(uploadFile).toHaveBeenNthCalledWith(1, new Uint8Array(Buffer.from("png")), "image/png");
    expect(uploadFile.mock.calls[1][1]).toMatch(/^text\/plain/);
    expect(addAttachment).toHaveBeenCalledWith({ id: "a1", storageId: "storage1", name: "shot.png" });
  });

  it("uses --name for one file", async () => {
    await writeFile(join(dir, "shot.png"), "png");
    const { addAttachment, client } = attaching();
    await runCli(["attach", "a1", join(dir, "shot.png"), "--name", "before.png"], { client });
    expect(addAttachment).toHaveBeenCalledWith(expect.objectContaining({ name: "before.png" }));
  });

  it("rejects --name with two files", async () => {
    expect(await runCli(["attach", "a1", "a", "b", "--name", "x"])).toMatchObject({
      code: 1,
      err: "Error: --name works with one file only",
    });
  });

  it("rejects a missing file before it uploads", async () => {
    const { uploadFile, client } = attaching();
    const result = await runCli(["attach", "a1", "nope.png"], { client, cwd: dir });
    expect(result).toMatchObject({ code: 1, err: `Error: ${join(dir, "nope.png")} is not a file` });
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("requires a file", async () => {
    expect(await runCli(["attach", "a1"])).toMatchObject({ code: 1, err: "Error: Expected <id> and at least one <file>" });
  });
});

describe("slip detach", () => {
  it("deletes the file", async () => {
    const removeAttachment = vi.fn<SlipClient["removeAttachment"]>(async () => "shot.png");
    const result = await runCli(["detach", "a1", "shot.png"], { client: fakeClient({ removeAttachment }) });
    expect(result).toEqual({ code: 0, out: "Deleted shot.png from a1", err: "" });
    expect(removeAttachment).toHaveBeenCalledWith({ id: "a1", name: "shot.png" });
  });
});

describe("slip show", () => {
  it("lists the attachments with the URL", async () => {
    const getTask = vi.fn<SlipClient["getTask"]>(async () => taskDetail({ attachments: [attachment()] }));
    const { out } = await runCli(["show", "a1"], { client: fakeClient({ getTask }) });
    expect(out).toContain("Attachments\n  shot.png image/png, 2.0 KB\n    https://x/1");
  });
});
