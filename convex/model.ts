import type { Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail } from "./errors";
import type { commitValidator, eventKindValidator } from "./schema";

// Convex rejects a document above 1 MiB (1,048,576 bytes). The budget leaves room
// for `_id`, `_creationTime`, and differences between JSON and Convex's own encoding.
const MAX_DOC_BYTES = 1_000_000;
const encoder = new TextEncoder();
// Depth of the lowest allowed level: epic 0, task 1, subtask 2.
const MAX_DEPTH = 2;
const SHORT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export type TaskView = {
  shortId: string;
  projectKey: string;
  parentShortId: string | null;
  name: string;
  description: string;
  priority: number;
  completed: boolean;
  result: string | null;
  startedAt: number | null;
  completedAt: number | null;
  commit: Infer<typeof commitValidator> | null;
  createdAt: number;
  blockedBy: string[];
};

/** A task in `tasks.list`. The description is left out to keep the list small. */
export type TaskListItem = Omit<TaskView, "description">;

export type TaskSummary = { shortId: string; name: string; completed: boolean };

/** One file on a task. `url` downloads the bytes, and is null if the file is gone from storage. */
export type AttachmentView = {
  name: string;
  contentType: string;
  size: number;
  url: string | null;
  createdAt: number;
};

export type EventKind = Infer<typeof eventKindValidator>;

/** One row of `events.list`. */
export type EventView = {
  at: number;
  projectKey: string;
  taskShortId: string;
  taskName: string;
  kind: EventKind;
  detail: string | null;
  machine: string;
};

/** Adds one row to the activity log. Call it in the mutation that makes the change. */
export async function logEvent(
  ctx: MutationCtx,
  machine: Doc<"machineTokens">,
  task: Doc<"tasks">,
  kind: EventKind,
  detail?: string,
): Promise<void> {
  await ctx.db.insert("events", {
    projectId: task.projectId,
    taskShortId: task.shortId,
    taskName: task.name,
    kind,
    detail,
    machine: machine.name,
  });
}

export function checkText(field: string, value: string, min: number): void {
  if (value.length < min) fail("INVALID_INPUT", `${field} must have at least ${min} character(s)`);
}

/** Rejects a document that would not fit in Convex. Call it with the full document before a write. */
export function checkDocSize(doc: object): void {
  const bytes = encoder.encode(JSON.stringify(doc)).byteLength;
  if (bytes > MAX_DOC_BYTES) {
    fail("INVALID_INPUT", `Document is ${bytes} bytes. The limit is ${MAX_DOC_BYTES} bytes`);
  }
}

export function checkPriority(priority: number): void {
  if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
    fail("INVALID_INPUT", "priority must be an integer from 0 to 100");
  }
}

export async function findTask(ctx: QueryCtx, shortId: string): Promise<Doc<"tasks">> {
  const task = await ctx.db
    .query("tasks")
    .withIndex("by_shortId", (q) => q.eq("shortId", shortId))
    .unique();
  if (!task) fail("NOT_FOUND", `Task ${shortId} not found`);
  return task;
}

export async function findProject(ctx: QueryCtx, key: string): Promise<Doc<"projects"> | null> {
  return ctx.db
    .query("projects")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export async function childrenOf(ctx: QueryCtx, taskId: Id<"tasks">): Promise<Doc<"tasks">[]> {
  return ctx.db
    .query("tasks")
    .withIndex("by_parent", (q) => q.eq("parentId", taskId))
    .collect();
}

export async function descendantsOf(ctx: QueryCtx, taskId: Id<"tasks">): Promise<Doc<"tasks">[]> {
  const result: Doc<"tasks">[] = [];
  for (const child of await childrenOf(ctx, taskId)) {
    result.push(child, ...(await descendantsOf(ctx, child._id)));
  }
  return result;
}

async function depthOf(ctx: QueryCtx, task: Doc<"tasks">): Promise<number> {
  let depth = 0;
  let parentId = task.parentId;
  while (parentId) {
    const parent = await ctx.db.get(parentId);
    if (!parent) break;
    depth++;
    parentId = parent.parentId;
  }
  return depth;
}

async function heightOf(ctx: QueryCtx, taskId: Id<"tasks">): Promise<number> {
  let height = 0;
  for (const child of await childrenOf(ctx, taskId)) {
    height = Math.max(height, 1 + (await heightOf(ctx, child._id)));
  }
  return height;
}

async function isInSubtree(ctx: QueryCtx, node: Doc<"tasks">, rootId: Id<"tasks">): Promise<boolean> {
  let current: Doc<"tasks"> | null = node;
  while (current) {
    if (current._id === rootId) return true;
    current = current.parentId ? await ctx.db.get(current.parentId) : null;
  }
  return false;
}

/**
 * Checks server rules 1 to 3 before a task goes under `parent`.
 * `taskId` is undefined for a new task.
 */
export async function checkParent(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  parent: Doc<"tasks">,
  taskId?: Id<"tasks">,
): Promise<void> {
  if (parent.projectId !== projectId) {
    fail("CROSS_PROJECT", `Parent ${parent.shortId} is in a different project`);
  }
  if (taskId && (await isInSubtree(ctx, parent, taskId))) {
    fail("PARENT_CYCLE", "A task cannot become its own ancestor");
  }
  const height = taskId ? await heightOf(ctx, taskId) : 0;
  if ((await depthOf(ctx, parent)) + 1 + height > MAX_DEPTH) {
    fail("MAX_DEPTH", "The subtask tree must be 3 levels deep at most");
  }
}

export async function newShortId(ctx: MutationCtx): Promise<string> {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const shortId = Array.from(bytes, (byte) => SHORT_ID_ALPHABET[byte % 36]).join("");
    const clash = await ctx.db
      .query("tasks")
      .withIndex("by_shortId", (q) => q.eq("shortId", shortId))
      .first();
    if (!clash) return shortId;
  }
}

async function openBlockerShortIds(ctx: QueryCtx, taskId: Id<"tasks">): Promise<string[]> {
  const rows = await ctx.db
    .query("blockers")
    .withIndex("by_blocked", (q) => q.eq("blockedId", taskId))
    .collect();
  const shortIds: string[] = [];
  for (const row of rows) {
    const blocker = await ctx.db.get(row.blockerId);
    if (blocker && !blocker.completed) shortIds.push(blocker.shortId);
  }
  return shortIds;
}

export async function toView(ctx: QueryCtx, task: Doc<"tasks">, projectKey: string): Promise<TaskView> {
  const parent = task.parentId ? await ctx.db.get(task.parentId) : null;
  return {
    shortId: task.shortId,
    projectKey,
    parentShortId: parent?.shortId ?? null,
    name: task.name,
    description: task.description,
    priority: task.priority,
    completed: task.completed,
    result: task.result ?? null,
    startedAt: task.startedAt ?? null,
    completedAt: task.completedAt ?? null,
    commit: task.commit ?? null,
    createdAt: task._creationTime,
    blockedBy: await openBlockerShortIds(ctx, task._id),
  };
}

export async function projectKeyOf(ctx: QueryCtx, task: Doc<"tasks">): Promise<string> {
  const project = await ctx.db.get(task.projectId);
  if (!project) fail("NOT_FOUND", `The project of task ${task.shortId} does not exist`);
  return project.key;
}

export async function viewOf(ctx: QueryCtx, task: Doc<"tasks">): Promise<TaskView> {
  return toView(ctx, task, await projectKeyOf(ctx, task));
}

export async function summaryOf(ctx: QueryCtx, taskId: Id<"tasks">): Promise<TaskSummary | null> {
  const task = await ctx.db.get(taskId);
  return task && { shortId: task.shortId, name: task.name, completed: task.completed };
}

export async function attachmentRowsOf(ctx: QueryCtx, taskId: Id<"tasks">): Promise<Doc<"attachments">[]> {
  return ctx.db
    .query("attachments")
    .withIndex("by_task_name", (q) => q.eq("taskId", taskId))
    .collect();
}

export async function attachmentView(ctx: QueryCtx, row: Doc<"attachments">): Promise<AttachmentView> {
  return {
    name: row.name,
    contentType: row.contentType,
    size: row.size,
    url: await ctx.storage.getUrl(row.storageId),
    createdAt: row._creationTime,
  };
}
