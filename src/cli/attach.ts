import { attachFile, formatSize } from "../attach.ts";
import type { AttachmentView } from "../client.ts";
import { SlipError } from "../errors.ts";
import { print, stringOption } from "./command.ts";
import type { Command } from "./command.ts";

export const attach: Command = {
  name: "attach",
  usage: "attach <id> <file>... [--name <name>]",
  summary: "Put files, such as screenshots, on a task.",
  notes: [
    "",
    "  --name <name>    The name on the task. The default is the file name. Use it with one file only",
    "",
    "A file with the same name on the task is replaced. The limit is 10 MB for each file.",
  ],
  options: { name: { type: "string" } },
  async run(ctx, input) {
    const [id, ...paths] = input.positionals;
    if (id === undefined || paths.length === 0) throw new SlipError("USAGE", "Expected <id> and at least one <file>");
    const name = stringOption(input, "name");
    if (name !== undefined && paths.length > 1) throw new SlipError("USAGE", "--name works with one file only");
    const client = await ctx.client();
    const added: AttachmentView[] = [];
    for (const path of paths) added.push(await attachFile(client, { id, path, cwd: ctx.cwd, name }));
    print(ctx, input, added, () => added.map((file) => `Attached ${file.name} (${formatSize(file.size)}) to ${id}`));
  },
};

export const detach: Command = {
  name: "detach",
  usage: "detach <id> <name>",
  summary: "Delete a file from a task.",
  async run(ctx, input) {
    if (input.positionals.length !== 2) throw new SlipError("USAGE", "Expected <id> and <name>");
    const [id, name] = input.positionals;
    const removed = await (await ctx.client()).removeAttachment({ id, name });
    print(ctx, input, { removed }, () => [`Deleted ${removed} from ${id}`]);
  },
};
