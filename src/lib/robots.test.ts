import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("robots.txt", () => {
  it("advertises the sitemap URL", async () => {
    const robots = await readFile(resolve("public/robots.txt"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://punters.club/sitemap.xml");
  });
});
