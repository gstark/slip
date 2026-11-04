import { SlipError } from "../errors.ts";
import { formatEvents } from "../format.ts";
import { print, projectKey, stringOption } from "./command.ts";
import type { Command } from "./command.ts";

export const log: Command = {
  name: "log",
  usage: "log [<id>] [-n <count>] [--all-projects]",
  summary: "Show recent activity, newest first.",
  notes: [
    "",
    "  <id>              Show only the activity of this task",
    "  -n, --limit <n>   Show this many events. The default is 20",
    "  --all-projects    Show the activity of all projects",
    "",
    "The log shows creates, edits, starts, closes, reopens, deletes, and blocker changes.",
  ],
  options: {
    limit: { type: "string", short: "n" },
    "all-projects": { type: "boolean" },
  },
  async run(ctx, input) {
    if (input.positionals.length > 1) throw new SlipError("USAGE", "Expected at most one <id> argument");
    const task = input.positionals[0];
    const raw = stringOption(input, "limit");
    if (raw !== undefined && !/^\d+$/.test(raw)) throw new SlipError("USAGE", `--limit must be an integer, not ${raw}`);
    const limit = raw === undefined ? undefined : Number(raw);
    const allProjects = input.values["all-projects"] === true;
    // A task ID finds the task in any project, so git is not needed.
    const key = allProjects || task !== undefined ? undefined : await projectKey(ctx, input);
    const events = await (await ctx.client()).listEvents({ projectKey: key, allProjects, task, limit });
    print(ctx, input, events, () => (events.length === 0 ? ["No activity"] : formatEvents(events, allProjects)));
  },
};
