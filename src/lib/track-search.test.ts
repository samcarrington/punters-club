import { describe, expect, it } from "vitest";
import type { Show } from "./mixcloud";
import {
  buildTrackSearchIndex,
  normalizeSearchText,
  searchTrackIndex,
} from "./track-search";

const shows: Show[] = [
  {
    title: "Newest show",
    url: "https://example.com/newest",
    slug: "newest-show",
    tracklist: [
      { position: 1, artist: "Sísý Ey", title: "Restless (Club Mix)" },
      { position: 2, artist: "Four Tet", title: "31 Bloom" },
    ],
  },
  {
    title: "Older show",
    url: "https://example.com/older",
    slug: "older-show",
    tracklist: [
      { position: 8, artist: "SÍSÝ EY", title: "RESTLESS (CLUB MIX)" },
      { position: 9, artist: "Four Tet", title: "Three Drums" },
    ],
  },
  {
    title: "No slug",
    url: "https://example.com/no-slug",
    tracklist: [{ position: 1, artist: "Hidden", title: "Track" }],
  },
];

describe("normalizeSearchText", () => {
  it("normalizes case, diacritics, and whitespace", () => {
    expect(normalizeSearchText("  Sísý   EY ")).toBe("sisy ey");
  });
});

describe("buildTrackSearchIndex", () => {
  it("groups the same artist and title across shows", () => {
    const index = buildTrackSearchIndex(shows);
    const restless = index.find((entry) => entry.title === "Restless (Club Mix)");

    expect(restless?.appearances).toEqual([
      {
        showTitle: "Newest show",
        showPath: "/shows/newest-show/",
        position: 1,
      },
      {
        showTitle: "Older show",
        showPath: "/shows/older-show/",
        position: 8,
      },
    ]);
  });

  it("ignores shows without a stable slug", () => {
    expect(buildTrackSearchIndex(shows)).not.toContainEqual(
      expect.objectContaining({ artist: "Hidden" }),
    );
  });
});

describe("searchTrackIndex", () => {
  const index = buildTrackSearchIndex(shows);

  it("matches artists and titles case- and diacritic-insensitively", () => {
    expect(searchTrackIndex(index, "SISY")[0]?.title).toBe(
      "Restless (Club Mix)",
    );
    expect(searchTrackIndex(index, "three drums")[0]?.artist).toBe("Four Tet");
  });

  it("matches query tokens across artist and title", () => {
    expect(searchTrackIndex(index, "four bloom")[0]?.title).toBe("31 Bloom");
  });

  it("ranks exact artist matches before other artist tracks", () => {
    expect(searchTrackIndex(index, "Four Tet").map((entry) => entry.title)).toEqual([
      "31 Bloom",
      "Three Drums",
    ]);
  });

  it("requires two characters and respects the result limit", () => {
    expect(searchTrackIndex(index, "f")).toEqual([]);
    expect(searchTrackIndex(index, "four", 1)).toHaveLength(1);
  });
});
