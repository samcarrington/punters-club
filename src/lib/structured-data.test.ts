import { describe, expect, it } from "vitest";
import { RADIO_WATERS, SCHEMA, SITE } from "./constants";
import {
  buildCollectionPageStructuredData,
  buildNextShowEventStructuredData,
  buildShowDetailStructuredData,
  buildShowListStructuredData,
  serializeJsonLd,
} from "./structured-data";

const show = {
  title: "Punters Club June 29th 2025",
  url: "https://www.mixcloud.com/samcarrington/punters-club-june-29th-2025/",
  slug: "punters-club-june-29th-2025",
  description: "Disco and beyond.",
  artwork: "https://example.com/artwork.jpg",
  publishedAt: "2025-06-29T20:48:55Z",
  durationSeconds: 7850,
  playCount: 29,
  tags: [{ name: "Disco" }],
};

const playlist = {
  title: "Sample Sources",
  description: "Source tracks",
  url: "https://open.spotify.com/playlist/0FHIhH7YFk4bsWVUYnJLu4",
  thumbnail_url: "https://example.com/playlist.jpg",
};

const nextShow = {
  title: "The Punters’ Club – Summer Holiday Sounds",
  slug: "the-punters-club-summer-holiday-sounds",
  url: "https://www.radiowaters.co.uk/show/the-punters-club-summer-holiday-sounds/",
  startsAtUtc: "2026-08-08T18:00:00.000Z",
  endsAtUtc: "2026-08-08T20:00:00.000Z",
  timezone: "Europe/London",
  description: "Let’s celebrate the Summer.",
  posterUrl: "https://www.radiowaters.co.uk/wp-content/uploads/31071.gif",
  matchedBy: "title" as const,
};

describe("show structured data helpers", () => {
  it("builds collection structured data for shows pages", () => {
    const data = buildShowListStructuredData([show], {
      pageUrl: `${SITE.url}${SITE.showsPath}`,
    });

    expect(data["@type"]).toBe("CollectionPage");
    expect(data.url).toBe(`${SITE.url}${SITE.showsPath}`);
    expect(data.mainEntity.itemListElement).toHaveLength(1);
    expect(data.mainEntity.itemListElement[0].item["@type"]).toBe(
      "RadioEpisode",
    );
  });

  it("binds show detail structured data to its first-party page", () => {
    const data = buildShowDetailStructuredData(show, {
      pageUrl: `${SITE.url}${SITE.showsPath}punters-club-june-29th-2025/`,
    });

    expect(data.url).toBe(show.url);
    expect(data.mainEntityOfPage).toBe(
      `${SITE.url}${SITE.showsPath}punters-club-june-29th-2025/`,
    );
  });

  it("builds detail structured data with publish/listen metadata", () => {
    const data = buildShowDetailStructuredData(show);

    expect(data["@type"]).toBe("RadioEpisode");
    expect(data.datePublished).toBe(show.publishedAt);
    expect(data.duration).toBe("PT7850S");
    expect(data.interactionStatistic).toEqual({
      "@type": "InteractionCounter",
      interactionType: SCHEMA.listenAction,
      userInteractionCount: 29,
    });
  });

  it("trims optional show text values before emitting JSON-LD", () => {
    const data = buildShowDetailStructuredData({
      ...show,
      description: "  Disco and beyond.  ",
      artwork: "  https://example.com/artwork.jpg  ",
      publishedAt: "  2025-06-29T20:48:55Z  ",
      tags: [{ name: "  Disco  " }, { name: "   " }],
    });

    expect(data.description).toBe("Disco and beyond.");
    expect(data.image).toBe("https://example.com/artwork.jpg");
    expect(data.datePublished).toBe("2025-06-29T20:48:55Z");
    expect(data.genre).toEqual(["Disco"]);
  });
});

describe("collection page structured data", () => {
  it("binds the homepage collection to its first-party URL", () => {
    const data = buildCollectionPageStructuredData({
      shows: [show],
      playlists: [playlist],
      pageUrl: `${SITE.url}/`,
    });

    expect(data.url).toBe(`${SITE.url}/`);
    expect(data.mainEntity[0].itemListElement[0].item["@type"]).toBe(
      "RadioEpisode",
    );
    expect(data.mainEntity[1].itemListElement[0].item.provider).toEqual({
      "@type": "Organization",
      name: "Spotify",
    });
  });
});

describe("next show event structured data", () => {
  it("builds virtual event JSON-LD for upcoming show", () => {
    const data = buildNextShowEventStructuredData(nextShow, {
      pageUrl: `${SITE.url}/`,
    });

    expect(data).toEqual({
      "@context": SCHEMA.context,
      "@type": "Event",
      name: nextShow.title,
      description: nextShow.description,
      url: nextShow.url,
      startDate: nextShow.startsAtUtc,
      endDate: nextShow.endsAtUtc,
      eventStatus: SCHEMA.eventScheduled,
      eventAttendanceMode: SCHEMA.onlineEventAttendanceMode,
      location: {
        "@type": "VirtualLocation",
        url: nextShow.url,
      },
      image: nextShow.posterUrl,
      organizer: {
        "@type": "Organization",
        name: RADIO_WATERS.name,
        url: RADIO_WATERS.url,
      },
      performer: {
        "@type": "Organization",
        name: RADIO_WATERS.name,
        url: RADIO_WATERS.url,
      },
      mainEntityOfPage: `${SITE.url}/`,
    });
  });

  it("omits empty optional event fields after trimming", () => {
    const data = buildNextShowEventStructuredData({
      ...nextShow,
      description: "   ",
      startsAtUtc: " 2026-08-08T18:00:00.000Z ",
      endsAtUtc: "   ",
      posterUrl: "   ",
    });

    expect(data.description).toBeUndefined();
    expect(data.startDate).toBe("2026-08-08T18:00:00.000Z");
    expect(data.endDate).toBeUndefined();
    expect(data.image).toBeUndefined();
    expect(data.mainEntityOfPage).toBeUndefined();
  });
});

describe("serializeJsonLd", () => {
  it("escapes values that can break inline JSON-LD script tags", () => {
    const serialized = serializeJsonLd({
      text: "</script><script>alert('xss')</script>",
      operators: "<>&",
      actualSeparators: `line${String.fromCharCode(0x2028)}paragraph${String.fromCharCode(0x2029)}`,
    });

    expect(serialized).not.toContain("</script");
    expect(serialized).not.toContain("<script");
    expect(serialized).not.toContain("<>&");
    expect(serialized).toContain("\\u003c");
    expect(serialized).toContain("\\u003e");
    expect(serialized).toContain("\\u0026");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });
});
