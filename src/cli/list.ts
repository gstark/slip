import type { ListFilter, TaskListItem } from "../client.ts";
import { TixError } from "../errors.ts";
import { formatGroups, formatTree } from "../format.ts";
import { print, projectKey } from "./command.ts";
import type { Command } from "./command.ts";

const FILTERS = ["closed", "all", "ready"] as const;

/** The tasks with the given IDs, and all tasks under them. */
export function selectTasks(tasks: TaskListItem[], ids: string[]): TaskListItem[] {
  const selected = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const task of tasks) {
      if (task.parentShortId !== null && selected.has(task.parentShortId) && !selected.has(task.shortId)) {
        selected.add(task.shortId);
        grew = true;
      }
    }
  }
  return tasks.filter((task) => selected.has(task.shortId));
}

export const list: Command = {
  name: "list",
  usage: "list [<id>...] [--closed | --all | --ready] [--all-projects]",
  summary: "Show open tasks of the current project as a tree.",
  notes: [
    "",
    "  <id>...           Show only these tasks and the tasks under them",
    "  --closed          Show closed tasks",
    "  --all             Show open and closed tasks",
    "  --ready           Show open tasks that no open task blocks",
    "  --all-projects    Show tasks of all projects, grouped by project",
    "",
    "`tix` with no command runs `tix list`.",
  ],
  options: {
    closed: { type: "boolean" },
    all: { type: "boolean" },
    ready: { type: "boolean" },
    "all-projects": { type: "boolean" },
  },
  async run(ctx, input) {
    const chosen = FILTERS.filter((name) => input.values[name] === true);
    if (chosen.length > 1) throw new TixError("USAGE", "Use only one of --closed, --all, and --ready");
    const filter: ListFilter = chosen[0] ?? "open";
    const allProjects = input.values["all-projects"] === true;
    const key = allProjects ? undefined : await projectKey(ctx, input);
    const listed = await (await ctx.client()).listTasks({ filter, projectKey: key, allProjects });
    const tasks = input.positionals.length === 0 ? listed : selectTasks(listed, input.positionals);
    print(ctx, input, tasks, () => {
      if (tasks.length === 0) return ["No tasks"];
      return allProjects ? formatGroups(tasks) : formatTree(tasks);
    });
  },
};
