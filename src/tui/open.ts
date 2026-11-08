import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AttachmentView } from "../client.ts";

/** The command that opens a file in the default app of the system. */
function opener(): string {
  if (process.platform === "darwin") return "open";
  if (process.platform === "win32") return "explorer";
  return "xdg-open";
}

/** Downloads the file to a folder for the task, then opens it in the default app. Returns the local path. */
export async function openAttachment(shortId: string, file: AttachmentView): Promise<string> {
  if (file.url === null) throw new Error(`${file.name} is gone from storage`);
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Cannot download ${file.name}: HTTP ${response.status}`);
  const dir = join(tmpdir(), "slip", shortId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, file.name);
  await Bun.write(path, response);
  Bun.spawn([opener(), path], { stdio: ["ignore", "ignore", "ignore"] }).unref();
  return path;
}
