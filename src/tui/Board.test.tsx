/** @jsxImportSource @opentui/react */
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { listItem } from "../test.setup.ts";
import { Board } from "./Board.tsx";
import type { Row } from "./board.ts";

let destroy: () => void = () => {};
afterEach(() => destroy());

describe("Board", () => {
  it("does not scroll on arrow keys after a click", async () => {
    const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({
      kind: "task",
      task: listItem({ shortId: `t${i}`, name: `task ${i}` }),
      guides: "",
      childCount: 0,
      collapsed: false,
    }));
    const scrollRef = createRef<ScrollBoxRenderable>();
    const setup = await testRender(
      <box height={10} flexDirection="row">
        <Board rows={rows} selectedId="t0" focused width={40} scrollRef={scrollRef} onSelect={() => {}} onToggle={() => {}} empty="" />
      </box>,
      { width: 40, height: 10 },
    );
    destroy = () => setup.renderer.destroy();
    await setup.renderOnce();
    // A click must not give the board the keys. The app moves the selection, and the board follows it.
    await setup.mockMouse.click(10, 0);
    setup.mockInput.pressArrow("down");
    await setup.renderOnce();
    expect(scrollRef.current?.scrollTop).toBe(0);
  });
});
