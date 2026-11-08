/** @jsxImportSource @opentui/react */
import { StyledText, TextRenderable, createMarkdownCodeBlockRenderer, fg } from "@opentui/core";
import type { ImageRenderable, RenderContext, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";
import { useRenderer } from "@opentui/react";
import { useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { formatSize, isImage } from "../attach.ts";
import type { AttachmentView, TaskDetail, TaskListItem, TaskSummary } from "../client.ts";
import { statusOf } from "./board.ts";
import { Flap } from "./Flap.tsx";
import { mermaidArt, strokes } from "./mermaid.ts";
import type { Stroke } from "./mermaid.ts";
import { color, statusColor } from "./theme.ts";
import { ago } from "./time.ts";

type Props = {
  /** The row from the board. It shows at once, before the detail loads. */
  item: TaskListItem | null;
  detail: TaskDetail | undefined;
  error: string | null;
  syntaxStyle: SyntaxStyle;
  /** The columns for the text, inside the padding. */
  width: number;
  /** The most rows that one image can use. */
  imageRows: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onJump: (shortId: string) => void;
  onOpen: (file: AttachmentView) => void;
};

export function Ticket({ item, detail, error, syntaxStyle, width, imageRows, scrollRef, onJump, onOpen }: Props) {
  const renderer = useRenderer();
  const renderNode = useMemo(() => mermaidBlocks(renderer, width), [renderer, width]);
  if (item === null) {
    return (
      <box flexGrow={1} paddingLeft={2} paddingTop={1}>
        <text fg={color.soot}>Select a task to see it here.</text>
      </box>
    );
  }
  // The detail of the last task stays until the new one loads. Use it only when it matches.
  const task = detail?.shortId === item.shortId ? detail : undefined;
  const status = statusOf(item);
  const now = Date.now();
  return (
    <scrollbox ref={scrollRef} flexGrow={1} paddingLeft={2} paddingRight={2} scrollbarOptions={{ visible: false }}>
      <box paddingTop={1}>
        <text fg={color.chalk}>
          <strong>{item.name}</strong>
        </text>
      </box>
      <box flexDirection="row" marginTop={1} height={1}>
        <Flap key={item.shortId} word={status} fg={statusColor[status]} />
        <text wrapMode="none">
          <span fg={color.chalk}>{`  ${item.shortId}`}</span>
          <Meta label="priority" value={String(item.priority)} />
          {item.startedAt !== null && <Meta label="started" value={ago(item.startedAt, now)} />}
          {item.completedAt !== null && <Meta label="closed" value={ago(item.completedAt, now)} />}
          <Meta label="created" value={ago(item.createdAt, now)} />
        </text>
      </box>
      {item.parentShortId !== null && (
        <box height={1} onMouseDown={() => onJump(item.parentShortId!)}>
          <text>
            <span fg={color.soot}>{"under "}</span>
            <span fg={color.flap}>
              <u>{item.parentShortId}</u>
            </span>
            {task?.projectKey !== undefined && <span fg={color.soot}>{`  in ${task.projectKey}`}</span>}
          </text>
        </box>
      )}

      {error !== null && (
        <Section title="Cannot load the task">
          <text fg={color.signal}>{error}</text>
        </Section>
      )}

      {task === undefined ? (
        error === null && (
          <box marginTop={1}>
            <text fg={color.soot}>Loading…</text>
          </box>
        )
      ) : (
        <>
          {task.blockers.length > 0 && (
            <Section title="Blocked by">
              <Links tasks={task.blockers} onJump={onJump} />
            </Section>
          )}
          {task.result !== null && task.result !== "" && (
            <Section title="Result">
              <markdown content={task.result} syntaxStyle={syntaxStyle} renderNode={renderNode} />
            </Section>
          )}
          {task.commit !== null && (
            <Section title="Commit">
              <text>
                <span fg={color.flap}>{task.commit.sha.slice(0, 10)}</span>
                {task.commit.branch && <span fg={color.soot}>{`  ${task.commit.branch}`}</span>}
                {task.commit.message && <span fg={color.chalk}>{`  ${task.commit.message}`}</span>}
              </text>
            </Section>
          )}
          <Section title="Description">
            {task.description === "" ? (
              <text fg={color.soot}>No description. Press e to write one, or E to write it in your editor.</text>
            ) : (
              <markdown content={task.description} syntaxStyle={syntaxStyle} renderNode={renderNode} />
            )}
          </Section>
          {task.children.length > 0 && (
            <Section title={`Subtasks  ${task.children.filter((child) => child.completed).length}/${task.children.length} done`}>
              <Links tasks={task.children} onJump={onJump} />
            </Section>
          )}
          {task.blocks.length > 0 && (
            <Section title="Blocks">
              <Links tasks={task.blocks} onJump={onJump} />
            </Section>
          )}
          {task.attachments.length > 0 && (
            <Section title={`Attachments  ${task.attachments.length}`}>
              {task.attachments.map((file) => (
                <Attachment key={file.name} file={file} width={width} rows={imageRows} onOpen={() => onOpen(file)} />
              ))}
            </Section>
          )}
          <box height={1} />
        </>
      )}
    </scrollbox>
  );
}

const strokeColor: Record<Stroke, string> = { line: color.soot, arrow: color.flap, label: color.chalk };

/** Draws ```mermaid blocks as diagrams. A block that does not parse, or does not fit, shows its source. */
function mermaidBlocks(ctx: RenderContext, width: number) {
  return createMarkdownCodeBlockRenderer({
    mermaid: (token) => {
      const art = mermaidArt(token.text, width);
      if (art === null) return undefined;
      const chunks = strokes(art).map(({ kind, text }) => fg(strokeColor[kind])(text));
      return new TextRenderable(ctx, { content: new StyledText(chunks), wrapMode: "none", marginBottom: 1 });
    },
  });
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span fg={color.soot}>{`   ${label} `}</span>
      <span fg={color.chalk}>{value}</span>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <box marginTop={1} flexDirection="column">
      <text fg={color.soot}>
        <strong>{title}</strong>
      </text>
      {children}
    </box>
  );
}

/** The name and size of a file. An image also shows inline. A click opens the file in the system viewer. */
function Attachment({ file, width, rows, onOpen }: { file: AttachmentView; width: number; rows: number; onOpen: () => void }) {
  const ref = useRef<ImageRenderable>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = file.url !== null && isImage(file.contentType) && failed === null;
  // The fitted size needs the pixel size of the image, so it is known only after the load.
  const fitted = loaded && ref.current !== null ? ref.current.getFittedSize(width, rows) : null;
  return (
    <box flexDirection="column" marginBottom={showImage ? 1 : 0}>
      <box height={1} onMouseDown={onOpen}>
        <text wrapMode="none">
          <span fg={color.flap}>
            <u>{file.name}</u>
          </span>
          <span fg={color.soot}>{`  ${formatSize(file.size)}`}</span>
          {showImage && !loaded && <span fg={color.soot}>{"  loading…"}</span>}
          {failed !== null && <span fg={color.signal}>{`  cannot show the image: ${failed}`}</span>}
          {file.url === null && <span fg={color.signal}>{"  the file is gone from storage"}</span>}
        </text>
      </box>
      {showImage && (
        <image
          ref={ref}
          source={file.url!}
          fit="fit"
          width={fitted?.width ?? 1}
          height={fitted?.height ?? 1}
          onLoad={() => setLoaded(true)}
          onError={(error) => setFailed(error instanceof Error ? error.message : String(error))}
          onMouseDown={onOpen}
        />
      )}
    </box>
  );
}

type Linkable = TaskSummary | (TaskSummary & Pick<TaskListItem, "startedAt" | "blockedBy">);

/** Tasks that the reader can click to open. */
function Links({ tasks, onJump }: { tasks: Linkable[]; onJump: (shortId: string) => void }) {
  return (
    <box flexDirection="column">
      {tasks.map((task) => {
        const status = "startedAt" in task ? statusOf(task) : task.completed ? "done" : "open";
        return (
          <box key={task.shortId} height={1} onMouseDown={() => onJump(task.shortId)}>
            <text wrapMode="none">
              <span fg={statusColor[status]}>{status.padEnd(6)}</span>
              <span fg={color.flap}>
                <u>{task.shortId}</u>
              </span>
              <span fg={task.completed ? color.soot : color.chalk}>{`  ${task.name}`}</span>
            </text>
          </box>
        );
      })}
    </box>
  );
}
