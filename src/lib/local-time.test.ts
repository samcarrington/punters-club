import { describe, expect, it } from "vitest";
import { formatShowTime } from "./local-time";

describe("formatShowTime", () => {
  const startsAtUtc = "2026-08-22T18:00:00.000Z";

  it("formats the source Radio Waters time in Europe/London", () => {
    expect(formatShowTime(startsAtUtc, "Europe/London")).toBe(
      "Sat, 22 Aug 2026, 19:00 BST",
    );
  });

  it("converts the same show time for visitors west of the UK", () => {
    expect(formatShowTime(startsAtUtc, "America/New_York")).toBe(
      "Sat, 22 Aug 2026, 14:00 GMT-4",
    );
  });

  it("converts the same show time across the date boundary", () => {
    expect(formatShowTime(startsAtUtc, "Australia/Sydney")).toBe(
      "Sun, 23 Aug 2026, 04:00 GMT+10",
    );
  });
});
