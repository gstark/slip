import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation } from "./_generated/server";
import { requireMachine } from "./auth";
import { fail } from "./errors";
import { FILE_NAME_RULE, MAX_ATTACHMENT_BYTES, isFileName } from "./limits";
import type { AttachmentView } from "./model";
import { attachmentView, findTask, logEvent } from "./model";


/** A one-time URL. POST the file bytes to it. The response JSON has the `storageId`. */
export const uploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireMachine(ctx, token);
    return ctx.storage.generateUploadUrl();
  },
});

/** Puts an uploaded file on a task. A file with the same name on the task is replaced. */
export const add = mutation({
  args: { token: v.string(), id: v.string(), storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, args): Promise<AttachmentView> => {
    const machine = await requireMachine(ctx, args.token);
    // A failure rolls back the whole mutation, so the uploaded file stays in storage.
    // The clients check the name and the size before they upload, so this is rare.
    const task = await findTask(ctx, args.id);
    const name = checkName(args.name);
    const file = await ctx.db.system.get(args.storageId);
    if (!file) fail("NOT_FOUND", "The uploaded file is not in storage");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      fail("INVALID_INPUT", `The file is ${file.size} bytes. The limit is ${MAX_ATTACHMENT_BYTES} bytes`);
    }

    const old = await rowNamed(ctx, task._id, name);
    if (old) await deleteRow(ctx, old._id, old.storageId);
    const rowId = await ctx.db.insert("attachments", {
      taskId: task._id,
      storageId: args.storageId,
      name,
      contentType: file.contentType ?? "application/octet-stream",
      size: file.size,
    });
    await logEvent(ctx, machine, task, "attached", name);
    return attachmentView(ctx, (await ctx.db.get(rowId))!);
  },
});

/** Deletes a file from a task and from storage. */
export const remove = mutation({
  args: { token: v.string(), id: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const machine = await requireMachine(ctx, args.token);
    const task = await findTask(ctx, args.id);
    const row = await rowNamed(ctx, task._id, args.name);
    if (!row) fail("NOT_FOUND", `Task ${task.shortId} has no file named ${args.name}`);
    await deleteRow(ctx, row._id, row.storageId);
    await logEvent(ctx, machine, task, "detached", row.name);
    return row.name;
  },
});

/** Returns the name without outer spaces, or fails if it is not a safe file name. */
function checkName(name: string): string {
  const trimmed = name.trim();
  if (!isFileName(trimmed)) fail("INVALID_INPUT", FILE_NAME_RULE);
  return trimmed;
}

function rowNamed(ctx: MutationCtx, taskId: Id<"tasks">, name: string) {
  return ctx.db
    .query("attachments")
    .withIndex("by_task_name", (q) => q.eq("taskId", taskId).eq("name", name))
    .unique();
}

export async function deleteRow(ctx: MutationCtx, rowId: Id<"attachments">, storageId: Id<"_storage">) {
  await ctx.db.delete(rowId);
  await ctx.storage.delete(storageId);
}
