---
name: slip-plan
description: Create a slip task from a markdown plan, spec, design document, or roadmap, and break it into subtasks when that helps.
---

# Convert a Markdown Plan to slip Tasks

Use `/slip-plan <file.md>` to turn a planning document into a slip task.

## When to Use

- After you finish a plan in plan mode (`~/.claude/plans/*.md`).
- For a spec, a design document, a roadmap, or an RFC that is ready for implementation.

Do not use it when:

- The document is a draft or exploratory notes.
- The file is not saved to disk.
- The content is not actionable.

## Step 1: Create the Main Task

```bash
slip plan <file.md>
```

- The name is the first `# ` heading. Without a heading, the name is the file name without `.md`.
- slip removes a `Plan: ` prefix from the name.
- The description is the full file content.
- The command prints the short ID of the new task. Keep it.

Use `--project <key>` when the current directory has no git remote.

## Step 2: Decide on a Breakdown

Read the plan. Make subtasks when the plan has one of these:

- 3 to 7 separate work items: numbered steps, sections, or phases.
- Work in different files, modules, or layers.
- Steps that must happen in order.

Make tasks under an epic, not subtasks, when the plan has 5 or more large areas, or phases that have their own steps.

Keep one task when:

- The plan has only 1 or 2 steps.
- The plan is one fix or one small change.
- The plan is research or investigation.
- The items are tightly coupled.
- The plan has fewer than 10 lines of real content.

A tree has 3 levels at most: epic, task, and subtask.

## Step 3: Create the Subtasks

For each work item:

1. Name: the step or heading text, with no number or bullet. Use 1 to 10 words. Start with a verb: Add, Create, Update, Fix.
2. Description: the full section for that item, with code, file paths, and requirements. Add "Part of: <main task name>".
3. Create it:

```bash
slip create "<name>" --parent <main-id> -d "<description>"
```

When a step must wait for another step, add a blocker:

```bash
slip block <later-id> --by <earlier-id>
```

## Step 4: Report

With subtasks:

```
Created task <id> from <file.md>.
Found <N> separate steps. Created <N> subtasks:
- <id>: <name>
- <id>: <name>
See the tree: slip
```

Without subtasks:

```
Created task <id> from <file.md>.
The plan is one cohesive task. I did not make subtasks.
See the task: slip show <id>
```
