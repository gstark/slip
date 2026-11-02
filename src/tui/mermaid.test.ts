import { describe, expect, it } from "vitest";
import { mermaidArt, strokes, wrapLabels } from "./mermaid.ts";

const widthOf = (art: string) => Math.max(...art.split("\n").map((line) => line.length));

describe("mermaidArt", () => {
  it("draws a flowchart with its labels", () => {
    const art = mermaidArt("flowchart TD\n  A[Start] --> B[Finish]", 80);
    expect(art).toContain("Start");
    expect(art).toContain("Finish");
    expect(art).toContain("▼");
  });

  it("wraps long labels until the diagram fits", () => {
    const source = [
      "flowchart TD",
      "  A[Migration, models, factories, test seed] --> B[Catalog facade on rows]",
      "  A --> C[Super admin API routes and resources]",
    ].join("\n");
    const wide = mermaidArt(source, 200);
    const narrow = mermaidArt(source, 60);
    expect(wide).toContain("Migration, models, factories, test seed");
    expect(narrow).not.toBeNull();
    expect(widthOf(narrow!)).toBeLessThanOrEqual(60);
    expect(narrow).toContain("Migration, models,");
  });

  it("returns null when the diagram cannot fit", () => {
    expect(mermaidArt("flowchart LR\n  A --> B --> C --> D --> E", 20)).toBeNull();
  });

  it("returns null for a diagram it cannot parse", () => {
    expect(mermaidArt('pie\n  "a": 1', 80)).toBeNull();
  });

  it("draws sequence diagrams", () => {
    expect(mermaidArt("sequenceDiagram\n  A->>B: hi", 80)).toContain("hi");
  });

  it("drops trailing spaces and blank lines", () => {
    const art = mermaidArt("flowchart TD\n  A --> B", 80)!;
    expect(art).not.toMatch(/ $/m);
    expect(art.endsWith("\n")).toBe(false);
  });
});

describe("wrapLabels", () => {
  it("breaks node and edge labels at spaces", () => {
    expect(wrapLabels("A[one two three] -->|four five six| B(seven eight)", 9)).toBe(
      "A[one two<br>three] -->|four five<br>six| B(seven<br>eight)",
    );
  });

  it("keeps short labels and quotes", () => {
    expect(wrapLabels('A["short"] --> B{also}', 9)).toBe('A["short"] --> B{also}');
    expect(wrapLabels('A["one two three"]', 9)).toBe('A["one two<br>three"]');
  });

  it("keeps a long word whole", () => {
    expect(wrapLabels("A[productNames.ts]", 5)).toBe("A[productNames.ts]");
  });
});

describe("strokes", () => {
  it("splits lines, arrows, and labels", () => {
    expect(strokes("─┬─ A\n ▼")).toEqual([
      { kind: "line", text: "─┬─" },
      { kind: "label", text: " A\n " },
      { kind: "arrow", text: "▼" },
    ]);
  });
});
