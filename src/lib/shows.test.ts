import { describe, expect, it } from "vitest";
import type { Show } from "./mixcloud";
import { assertValidShowSlugs, sortShows } from "./shows";

const generatedShows: Show[] = [
  {
    title: "Generated A",
    url: "https://www.mixcloud.com/samcarrington/source-a/",
    slug: "source-a",
    publishedAt: "2025-06-01T12:00:00Z",
    playCount: 10,
    tracklist: [{ position: 1, artist: "Artist A", title: "Track A" }],
  },
  {
    title: "Generated B",
    url: "https://www.mixcloud.com/samcarrington/other-url/",
    slug: "source-b",
    publishedAt: "2025-05-01T12:00:00Z",
    playCount: 3,
    tracklist: [{ position: 1, artist: "Artist B", title: "Track B" }],
  },
  {
    title: "Generated C",
    url: "https://www.mixcloud.com/samcarrington/source-c/",
    slug: "source-c",
  },
];

describe("sortShows", () => {
  const shows = generatedShows;

  it("sorts newest first and pushes missing dates to the end", () => {
    expect(sortShows(shows, "newest").map((show) => show.slug)).toEqual([
      "source-a",
      "source-b",
      "source-c",
    ]);
  });

  it("sorts oldest first and pushes missing dates to the end", () => {
    expect(sortShows(shows, "oldest").map((show) => show.slug)).toEqual([
      "source-b",
      "source-a",
      "source-c",
    ]);
  });

  it("sorts listens high/low and pushes missing counts to the end", () => {
    expect(sortShows(shows, "listens-high").map((show) => show.slug)).toEqual([
      "source-a",
      "source-b",
      "source-c",
    ]);
    expect(sortShows(shows, "listens-low").map((show) => show.slug)).toEqual([
      "source-b",
      "source-a",
      "source-c",
    ]);
  });
});

describe("assertValidShowSlugs", () => {
  it("passes for unique populated slugs", () => {
    expect(() => assertValidShowSlugs(generatedShows)).not.toThrow();
  });

  it("throws clearly on missing slugs", () => {
    expect(() =>
      assertValidShowSlugs([{ title: "No slug", url: "https://example.com/" }]),
    ).toThrow(/missing a slug/i);
  });

  it("throws clearly on duplicate slugs", () => {
    expect(() =>
      assertValidShowSlugs([
        { title: "A", url: "https://example.com/a", slug: "dup" },
        { title: "B", url: "https://example.com/b", slug: "dup" },
      ]),
    ).toThrow(/duplicate generated show slug/i);
  });
});
