import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { toSlipError } from "./client.ts";
import { SlipError } from "./errors.ts";

const URL = "https://a.convex.cloud";

describe("toSlipError", () => {
  it("keeps the code and message of a server error", () => {
    const error = toSlipError(new ConvexError({ code: "MAX_DEPTH", message: "Too deep" }), URL);
    expect(error).toBeInstanceOf(SlipError);
    expect(error).toMatchObject({ code: "MAX_DEPTH", message: "Too deep" });
  });

  it("turns a fetch failure into NETWORK with the URL", () => {
    expect(toSlipError(new TypeError("fetch failed"), URL)).toMatchObject({
      code: "NETWORK",
      message: `Cannot reach Convex at ${URL}`,
    });
  });

  it("passes other errors through", () => {
    const error = new Error("Server Error");
    expect(toSlipError(error, URL)).toBe(error);
    const unshaped = new ConvexError("plain");
    expect(toSlipError(unshaped, URL)).toBe(unshaped);
  });
});
