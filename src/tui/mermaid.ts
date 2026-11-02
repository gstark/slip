import { renderMermaidASCII } from "beautiful-mermaid";

/** Label widths to try, widest first. Narrow labels make narrow boxes. */
const LABEL_WIDTHS = [Number.POSITIVE_INFINITY, 28, 20, 14];

/** Only these diagrams use brackets for labels. Class diagrams use them for members. */
const WRAPPABLE = /^(flowchart|graph|statediagram)/i;

/** The text inside one pair of label brackets or pipes, as in `A[text]`, `B(text)`, `C{text}`, and `-->|text|`. */
const LABEL = /([[({|]"?)([^[\](){}|"<>\n]+)("?[\])}|])/g;

/**
 * The diagram as text art no wider than `width` columns.
 * Returns null when the source does not parse, or when no label width makes it fit.
 */
export function mermaidArt(source: string, width: number): string | null {
  const widths = WRAPPABLE.test(source.trim()) ? LABEL_WIDTHS : LABEL_WIDTHS.slice(0, 1);
  for (const labelWidth of widths) {
    const art = render(source, labelWidth);
    if (art === null) return null;
    if (Math.max(...art.split("\n").map((line) => line.length)) <= width) return art;
  }
  return null;
}

/** Renders by label width and source. A render takes tens of milliseconds, and a drag of the split asks for a new width on each step. */
const renders = new Map<string, string | null>();

function render(source: string, labelWidth: number): string | null {
  const key = `${labelWidth}\n${source}`;
  let art = renders.get(key);
  if (art === undefined) {
    try {
      art = trim(renderMermaidASCII(wrapLabels(source, labelWidth), { colorMode: "none" }));
    } catch {
      art = null;
    }
    if (renders.size >= 64) renders.clear();
    renders.set(key, art);
  }
  return art;
}

/** Breaks each label longer than `width` at spaces, with `<br>`. */
export function wrapLabels(source: string, width: number): string {
  return source.replace(LABEL, (match, open: string, text: string, close: string) =>
    text.length <= width ? match : `${open}${wrapWords(text, width).join("<br>")}${close}`,
  );
}

function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Drops trailing spaces and blank lines. */
function trim(art: string): string {
  return art
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

export type Stroke = "line" | "arrow" | "label";

/** Splits the art into runs, so each kind of character can take its own color. */
export function strokes(art: string): { kind: Stroke; text: string }[] {
  const runs: { kind: Stroke; text: string }[] = [];
  for (const char of art) {
    const kind = strokeOf(char);
    const last = runs.at(-1);
    if (last?.kind === kind) last.text += char;
    else runs.push({ kind, text: char });
  }
  return runs;
}

function strokeOf(char: string): Stroke {
  if (/[▲▼◄►◀▶]/.test(char)) return "arrow";
  // Box drawing: U+2500 to U+257F.
  if (char >= "─" && char <= "╿") return "line";
  return "label";
}
