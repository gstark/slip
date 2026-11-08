# slip

`slip` tracks private code tasks for agent coding. It stores the tasks in Convex, so all repositories and machines use the same data.

`slip` has:

- A CLI. Run `slip help` to see the commands.
- A live board in the terminal. Run `slip tui` to open it.
- An MCP server. Run `slip mcp` to start it on stdio.
- A Claude Code plugin with the `slip` and `slip-plan` skills.

## Board

`slip tui` shows the tasks of the current project. Outside a git repository, or with `--all-projects`, it shows all projects. Convex sends each change at once, so you see the work of agents while they do it. When a status changes, its cell flips like a departures board.

The left pane shows the task tree. The right pane shows the selected task, with the description and the result in Markdown. Image attachments draw in the pane. slip uses the kitty graphics protocol or sixel when the terminal has one, and block characters when it does not. Kitty, Ghostty, and WezTerm support the kitty protocol. iTerm2 3.5 and later support sixel. A ` ```mermaid ` block shows as a diagram when it fits the pane. Flowcharts, state, sequence, class, and ER diagrams work. You can click rows, filters, links, and buttons, and scroll with the mouse wheel. Drag the line between the panes to resize them. slip saves the list width in `ui.toml`, next to the config file.

| Keys | Action |
| --- | --- |
| `j` `k` `g` `G` | Select a task |
| `h` `l` `enter` | Close or open a subtree |
| `tab` | Move between the board and the ticket |
| `1` `2` `3` `4` | Show open, ready, all, or closed tasks |
| `/` | Find tasks by name or ID |
| `p` | Choose the project |
| `s` `d` `o` | Start, close, or reopen the task |
| `n` `a` | Create a task or a subtask |
| `e` `E` | Edit the task, or edit the description in `$EDITOR` |
| `b` `u` | Add or remove a blocker |
| `x` | Delete the task |
| `y` | Copy the short ID |
| `O` | Open a file of the task in the default app |
| `?` | Show all keys |
| `q` | Quit |

Set `SLIP_MOTION=off` to turn off the flip animation.

## Attachments

A task can hold files, such as screenshots from an agent. Convex file storage keeps the bytes. The limit is 10 MB for each file.

```bash
slip attach <id> before.png after.png   # A file with the same name is replaced
slip attach <id> shot.png --name login.png
slip detach <id> login.png
```

`slip show <id>` lists the files with a download URL. The MCP tool `manage_attachments` uploads a local file by its path. When you delete a task, slip also deletes its files.

## Install

The install needs git and [Bun](https://bun.com) 1.4 or later. Run `bun upgrade` to update Bun.

1. Run the install script:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/gstark/slip/main/install.sh | bash
   ```

   The script does these steps:
   - It clones the repository into `~/.local/share/slip`.
   - It links `slip` into `~/.local/bin`.
   - If Claude Code is installed, it installs the slip plugin with the skills and the MCP server.
2. In a checkout with Convex access, run `just token <machine>`. Convex shows the token once.
3. Run `slip login --url <production URL> --token <token>`.

Run the install script again to update slip. You can set these variables:
- `SLIP_DIR`: the checkout directory.
- `SLIP_REPO`: the repository to clone.

## Backend Setup

Do this once:

1. Clone the repository.
2. Run `bun install`.
3. Put your Convex team slug in `.env`: `SLIP_TEAM=<team slug>`. Git ignores this file.
4. Log in to Convex: `bunx convex login`.
5. Run `just setup`. It prints the production URL.

Run `just` to list the recipes.

## Development

- `bun run test` runs the tests.
- `bun run typecheck` runs the typecheck.
- Bun runs the TypeScript source directly. There is no build.

The design is in `docs/specs/2026-10-29-tix-design.md`.

## Credits

`slip` is inspired by [dex](https://github.com/dcramer/dex), the task tracker for agents by [David Cramer](https://github.com/dcramer). dex showed the model that slip keeps:
- Tasks are tickets, with a name, a description, and a result.
- Agents use a CLI, an [MCP](https://modelcontextprotocol.io) server, and skills.
- Plans become trees of tasks.

`slip` moves the storage to [Convex](https://www.convex.dev), so all machines share the same tasks. Thank you, David.

## License

MIT. See [LICENSE](LICENSE).
