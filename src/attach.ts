import { basename, resolve } from "node:path";
import { FILE_NAME_RULE, MAX_ATTACHMENT_BYTES, isFileName } from "../convex/limits.ts";
import type { AttachmentView, SlipClient } from "./client.ts";
import { SlipError } from "./errors.ts";

/**
 * Reads a local file and puts it on a task. The name is the file name unless `name` is given.
 * The checks run before the upload, so a bad file does not leave bytes in storage.
 */
export async function attachFile(
  client: SlipClient,
  args: { id: string; path: string; cwd: string; name?: string },
): Promise<AttachmentView> {
  const path = resolve(args.cwd, args.path);
  const file = Bun.file(path);
  if (!(await file.exists())) throw new SlipError("USAGE", `${path} is not a file`);
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new SlipError("INVALID_INPUT", `${path} is ${formatSize(file.size)}. The limit is ${formatSize(MAX_ATTACHMENT_BYTES)}`);
  }
  const name = (args.name ?? basename(path)).trim();
  if (!isFileName(name)) throw new SlipError("USAGE", FILE_NAME_RULE);
  const storageId = await client.uploadFile(await file.bytes(), file.type || "application/octet-stream");
  return client.addAttachment({ id: args.id, storageId, name });
}

/** A size such as 512 B, 4.2 KB, or 3.1 MB. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** True for the formats that the board can draw. */
export function isImage(contentType: string): boolean {
  return /^image\/(png|jpeg|webp|gif)\b/.test(contentType);
}
