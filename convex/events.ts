import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireMachine } from "./auth";
import { fail } from "./errors";
import type { EventView } from "./model";
import { findProject } from "./model";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;

/** The newest events first, for one project, all projects, or one task. */
export const list = query({
  args: {
    token: v.string(),
    projectKey: v.optional(v.string()),
    allProjects: v.optional(v.boolean()),
    task: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<EventView[]> => {
    await requireMachine(ctx, args.token);
    const limit = args.limit ?? DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      fail("INVALID_INPUT", `limit must be an integer from 1 to ${MAX_LIMIT}`);
    }

    let rows: Doc<"events">[];
    if (args.task !== undefined) {
      const task = args.task;
      rows = await ctx.db
        .query("events")
        .withIndex("by_task", (q) => q.eq("taskShortId", task))
        .order("desc")
        .take(limit);
    } else if (args.allProjects) {
      rows = await ctx.db.query("events").order("desc").take(limit);
    } else {
      if (args.projectKey === undefined) fail("INVALID_INPUT", "projectKey is required without allProjects");
      const project = await findProject(ctx, args.projectKey);
      if (!project) return [];
      rows = await ctx.db
        .query("events")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .order("desc")
        .take(limit);
    }

    const keys = new Map<Id<"projects">, string>();
    const views: EventView[] = [];
    for (const row of rows) {
      let key = keys.get(row.projectId);
      if (key === undefined) {
        key = (await ctx.db.get(row.projectId))?.key ?? "?";
        keys.set(row.projectId, key);
      }
      views.push({
        at: row._creationTime,
        projectKey: key,
        taskShortId: row.taskShortId,
        taskName: row.taskName,
        kind: row.kind,
        detail: row.detail ?? null,
        machine: row.machine,
      });
    }
    return views;
  },
});
