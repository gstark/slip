/** @jsxImportSource @opentui/react */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { useRenderer } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import { createRef, useMemo } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AttachmentView } from "../client.ts";
import { listItem, taskDetail } from "../test.setup.ts";
import { markdownStyle } from "./theme.ts";
import { Ticket } from "./Ticket.tsx";

/** A red PNG of the given size. */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([255, 0, 0]))]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let dir: string | null = null;
let destroy: () => void = () => {};

afterEach(async () => {
  destroy();
  if (dir !== null) await rm(dir, { recursive: true, force: true });
  dir = null;
});

/** The ticket of one task, with the syntax style that the board makes from its renderer. */
function TicketWith({ attachments }: { attachments: AttachmentView[] }) {
  const renderer = useRenderer();
  const syntaxStyle = useMemo(() => markdownStyle(renderer), [renderer]);
  return (
    <Ticket
      item={listItem({ shortId: "a1", name: "Fix the header" })}
      detail={taskDetail({ shortId: "a1", name: "Fix the header", attachments })}
      error={null}
      syntaxStyle={syntaxStyle}
      width={56}
      imageRows={10}
      scrollRef={createRef<ScrollBoxRenderable>()}
      onJump={() => {}}
      onOpen={() => {}}
    />
  );
}

async function renderTicket(attachments: AttachmentView[]) {
  const setup = await testRender(<TicketWith attachments={attachments} />, { width: 60, height: 40 });
  destroy = () => setup.renderer.destroy();
  return setup;
}

describe("Ticket attachments", () => {
  it("lists a file that is not an image", async () => {
    const file: AttachmentView = { name: "log.txt", contentType: "text/plain", size: 2048, url: "https://x/1", createdAt: 0 };
    const { renderOnce, captureCharFrame } = await renderTicket([file]);
    await renderOnce();
    expect(captureCharFrame()).toContain("Attachments  1");
    expect(captureCharFrame()).toContain("log.txt  2.0 KB");
  });

  it("draws an image, sized to the pane", async () => {
    dir = await mkdtemp(join(tmpdir(), "slip-ticket-"));
    const path = join(dir, "shot.png");
    await writeFile(path, png(40, 10));
    const file: AttachmentView = { name: "shot.png", contentType: "image/png", size: 100, url: path, createdAt: 0 };
    const { renderOnce, captureCharFrame } = await renderTicket([file]);
    await renderOnce();
    expect(captureCharFrame()).toContain("loading…");

    await vi.waitFor(async () => {
      await renderOnce();
      expect(captureCharFrame()).not.toContain("loading…");
    });
    const frame = captureCharFrame();
    expect(frame).toContain("shot.png  100 B");
    // The test terminal has no pixel size, so the image draws with block characters.
    const rows = frame.split("\n");
    const caption = rows.findIndex((line) => line.includes("shot.png"));
    expect(rows[caption + 1].trim()).not.toBe("");
  });

  it("says when the file is gone from storage", async () => {
    const file: AttachmentView = { name: "a.png", contentType: "image/png", size: 1, url: null, createdAt: 0 };
    const { renderOnce, captureCharFrame } = await renderTicket([file]);
    await renderOnce();
    expect(captureCharFrame()).toContain("the file is gone from storage");
  });
});
