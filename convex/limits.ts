/** The largest file that a task can hold: 10 MiB. The CLI checks it before the upload. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const FILE_NAME_RULE = "The file name must not be empty, . or .., and must not have a slash or a line break";

/**
 * True if the name is safe as a file name in a folder. The board writes the file to a
 * folder before it opens it, so the name must not leave the folder.
 */
export function isFileName(name: string): boolean {
  return name !== "" && name !== "." && name !== ".." && !/[/\\\n\r\0]/.test(name);
}
