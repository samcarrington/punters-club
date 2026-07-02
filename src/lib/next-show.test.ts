import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  isValidIanaZone,
  localDatePart,
  matchesTitle,
  normalizeEvent,
  stripHtml,
  utcWallTimeToIso,
} from "./next-show";

const augEvent = {
  title: "The Punters&#8217; Club &#8211; Summer Holiday Sounds",
  slug: "the-punters-club-summer-holiday-sounds",
  url: "https://www.radiowaters.co.uk/show/the-punters-club-summer-holiday-sounds/2026-08-22/",
  start_date: "2026-08-22 19:00:00",
  end_date: "2026-08-22 21:00:00",
  timezone: "Europe/London",
  utc_start_date: "2026-08-22 18:00:00",
  utc_end_date: "2026-08-22 20:00:00",
  description: "<p>Sundown &#8230; sounds</p>",
  image: { url: "https://www.radiowaters.co.uk/wp-content/uploads/poster.jpg" },
};

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

describe("normalizeEvent", () => {
  it("decodes title, strips description, resolves UTC + poster", () => {
    const show = normalizeEvent(augEvent, "title");

    expect(show).toEqual({
      title: "The Punters’ Club – Summer Holiday Sounds",
      slug: "the-punters-club-summer-holiday-sounds",
      url: augEvent.url,
      startsAtUtc: "2026-08-22T18:00:00.000Z",
      endsAtUtc: "2026-08-22T20:00:00.000Z",
      timezone: "Europe/London",
      description: "Sundown … sounds",
      posterUrl: "https://www.radiowaters.co.uk/wp-content/uploads/poster.jpg",
      matchedBy: "title",
    });
  });

  it("returns null when UTC start is missing (discard)", () => {
    expect(
      normalizeEvent({ ...augEvent, utc_start_date: undefined }, "title"),
    ).toBeNull();
  });

  it("returns null when the timezone is not a real IANA zone", () => {
    expect(normalizeEvent({ ...augEvent, timezone: "Not/AZone" }, "title")).toBeNull();
  });

  it("omits poster when image is false/absent and preserves matchedBy guest", () => {
    const show = normalizeEvent({ ...augEvent, image: false }, "guest");

    expect(show?.posterUrl).toBeUndefined();
    expect(show?.matchedBy).toBe("guest");
  });
});
