import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  isSameResult,
  isValidIanaZone,
  localDatePart,
  matchesTitle,
  normalizeEvent,
  selectNextShow,
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

const config = {
  endpoint: "https://example.test",
  titlePatterns: ["punters?['’]?\\s+club"],
  guestAppearances: [{ slug: "saturday-night-in-with", date: "2026-07-04" }],
  lookaheadDays: 60,
};

const guestJul4 = {
  title: "Saturday Night In With…",
  slug: "saturday-night-in-with",
  url: "https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-07-04/",
  start_date: "2026-07-04 19:00:00",
  timezone: "Europe/London",
  utc_start_date: "2026-07-04 18:00:00",
  image: { url: "https://x/p.jpg" },
};

const guestAug29 = {
  ...guestJul4,
  url: "https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-08-29/",
  start_date: "2026-08-29 19:00:00",
  utc_start_date: "2026-08-29 18:00:00",
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

describe("selectNextShow", () => {
  const now = new Date("2026-07-02T00:00:00Z");

  it("picks the soonest qualifying show (guest before later named)", () => {
    const { result } = selectNextShow([augEvent, guestJul4, guestAug29], config, now);

    expect(result.status).toBe("upcoming");
    if (result.status !== "upcoming") throw new Error("expected upcoming");
    expect(result.show.url).toBe(guestJul4.url);
    expect(result.show.matchedBy).toBe("guest");
  });

  it("resolves guest by slug AND date only (ignores wrong-date same slug)", () => {
    const { result } = selectNextShow([augEvent, guestAug29], config, now);

    if (result.status !== "upcoming") throw new Error("expected upcoming");
    expect(result.show.url).toBe(augEvent.url);
  });

  it("drops past events", () => {
    const past = { ...augEvent, utc_start_date: "2026-06-01 18:00:00" };
    const { result } = selectNextShow([past], config, now);

    expect(result.status).toBe("none");
  });

  it("dedupes a show matched by both title and guest override", () => {
    const both = { ...augEvent, slug: "saturday-night-in-with" };
    const cfg = {
      ...config,
      guestAppearances: [{ slug: "saturday-night-in-with", date: "2026-08-22" }],
    };
    const { result } = selectNextShow([both], cfg, now);

    expect(result.status).toBe("upcoming");
  });

  it("warns about an unresolved future guest override", () => {
    const { warnings } = selectNextShow([augEvent], config, now);

    expect(
      warnings.some(
        (warning) =>
          warning.includes("saturday-night-in-with") &&
          warning.includes("2026-07-04"),
      ),
    ).toBe(true);
  });

  it("returns none for an empty event list", () => {
    const { result } = selectNextShow([], config, now);

    expect(result).toEqual({ status: "none", source: "tribe/events/v1" });
  });
});

describe("isSameResult", () => {
  const now = new Date("2026-07-02T00:00:00Z");

  it("returns true for identical results", () => {
    const { result } = selectNextShow([augEvent, guestJul4], config, now);

    expect(isSameResult(result, result)).toBe(true);
  });

  it("returns false when show changes", () => {
    const { result: guestResult } = selectNextShow([augEvent, guestJul4], config, now);
    const { result: showResult } = selectNextShow([augEvent], config, now);

    expect(isSameResult(guestResult, showResult)).toBe(false);
  });

  it("returns false when status differs", () => {
    const { result: upcomingResult } = selectNextShow([augEvent], config, now);
    const { result: noneResult } = selectNextShow([], config, now);

    expect(isSameResult(upcomingResult, noneResult)).toBe(false);
  });
});
