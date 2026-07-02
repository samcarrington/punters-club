import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  isValidIanaZone,
  localDatePart,
  matchesTitle,
  stripHtml,
  utcWallTimeToIso,
} from "./next-show";

describe("decodeEntities", () => {
  it("decodes numeric decimal entities (curly apostrophe, en dash)", () => {
    expect(decodeEntities("The Punters&#8217; Club &#8211; Summer")).toBe(
      "The Punters’ Club – Summer",
    );
  });

  it("decodes hex and common named entities", () => {
    expect(decodeEntities("Rock &amp; Roll &#x2019;s &quot;best&quot;")).toBe(
      'Rock & Roll ’s "best"',
    );
  });

  it("leaves plain text untouched", () => {
    expect(decodeEntities("Deep Bath with n_sonic")).toBe(
      "Deep Bath with n_sonic",
    );
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities, collapses whitespace", () => {
    expect(stripHtml("<p>Hello&#8230;  <b>world</b></p>")).toBe(
      "Hello… world",
    );
  });
});

describe("utcWallTimeToIso", () => {
  it("parses TEC UTC wall time as ISO Z", () => {
    expect(utcWallTimeToIso("2026-08-22 18:00:00")).toBe(
      "2026-08-22T18:00:00.000Z",
    );
  });

  it("returns null for missing/invalid input", () => {
    expect(utcWallTimeToIso(undefined)).toBeNull();
    expect(utcWallTimeToIso("nonsense")).toBeNull();
  });
});

describe("localDatePart", () => {
  it("extracts the date from a local wall time", () => {
    expect(localDatePart("2026-08-22 19:00:00")).toBe("2026-08-22");
  });

  it("returns null when absent", () => {
    expect(localDatePart(undefined)).toBeNull();
  });
});

describe("isValidIanaZone", () => {
  it("accepts a real zone and rejects junk", () => {
    expect(isValidIanaZone("Europe/London")).toBe(true);
    expect(isValidIanaZone("Not/AZone")).toBe(false);
    expect(isValidIanaZone(undefined)).toBe(false);
  });
});

describe("matchesTitle", () => {
  const patterns = ["punters?['’]?\\s+club"];

  it("matches an HTML-encoded Punters' Club title", () => {
    expect(matchesTitle("The Punters&#8217; Club &#8211; Summer", patterns)).toBe(
      true,
    );
  });

  it("matches a straight-apostrophe variant", () => {
    expect(matchesTitle("The Punter's Club", patterns)).toBe(true);
  });

  it("does not match unrelated shows", () => {
    expect(matchesTitle("Deep Bath with n_sonic", patterns)).toBe(false);
  });
});
