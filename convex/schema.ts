import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const commitValidator = v.object({
  sha: v.string(),
  branch: v.optional(v.string()),
  message: v.optional(v.string()),
});

export const eventKindValidator = v.union(
  v.literal("created"),
  v.literal("edited"),
  v.literal("started"),
  v.literal("closed"),
  v.literal("reopened"),
  v.literal("deleted"),
  v.literal("blocked"),
  v.literal("unblocked"),
  v.literal("attached"),
  v.literal("detached"),
);

export default defineSchema({
  projects: defineTable({
    key: v.string(),
  }).index("by_key", ["key"]),

  tasks: defineTable({
    projectId: v.id("projects"),
    parentId: v.optional(v.id("tasks")),
    shortId: v.string(),
    name: v.string(),
    description: v.string(),
    priority: v.number(),
    completed: v.boolean(),
    result: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    commit: v.optional(commitValidator),
  })
    .index("by_shortId", ["shortId"])
    .index("by_parent", ["parentId"])
    .index("by_project_completed_priority", ["projectId", "completed", "priority"])
    .index("by_completed_priority", ["completed", "priority"]),

  // A file on a task. The bytes are in Convex file storage. A name is unique in one task.
  attachments: defineTable({
    taskId: v.id("tasks"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
  }).index("by_task_name", ["taskId", "name"]),

  blockers: defineTable({
    blockerId: v.id("tasks"),
    blockedId: v.id("tasks"),
  })
    .index("by_blocker", ["blockerId"])
    .index("by_blocked", ["blockedId", "blockerId"]),

  // One row for each change to a task. The row copies the short ID and the name,
  // so the log can show a task after it is deleted.
  events: defineTable({
    projectId: v.id("projects"),
    taskShortId: v.string(),
    taskName: v.string(),
    kind: eventKindValidator,
    // The changed fields for "edited". The other task for "blocked" and "unblocked".
    // The file name for "attached" and "detached".
    detail: v.optional(v.string()),
    machine: v.string(),
  })
    .index("by_project", ["projectId"])
    .index("by_task", ["taskShortId"]),

  machineTokens: defineTable({
    name: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_name", ["name"]),
});
