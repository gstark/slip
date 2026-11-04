import type { ErrorCode } from "../convex/errors.ts";

/** Server codes, plus the codes that only the client makes. */
export type SlipErrorCode = ErrorCode | "USAGE" | "CONFIG" | "NETWORK";

export class SlipError extends Error {
  readonly code: SlipErrorCode;

  constructor(code: SlipErrorCode, message: string) {
    super(message);
    this.name = "SlipError";
    this.code = code;
  }
}

/** Maps an error code to the CLI exit code in the spec. */
export function exitCodeOf(code: SlipErrorCode): 1 | 2 | 3 {
  if (code === "UNAUTHORIZED" || code === "CONFIG") return 2;
  if (code === "NETWORK") return 3;
  return 1;
}
