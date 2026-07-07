import { describe, expect, it } from "vitest";
import {
  buildShowDetailStructuredData,
  buildShowListStructuredData,
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

describe("show structured data helpers", () => {
  it("builds collection structured data for shows pages", () => {
    const data = buildShowListStructuredData([show]);

    expect(data["@type"]).toBe("CollectionPage");
    expect(data.mainEntity.itemListElement).toHaveLength(1);
    expect(data.mainEntity.itemListElement[0].item["@type"]).toBe(
      "RadioEpisode",
    );
  });

  it("builds detail structured data with publish/listen metadata", () => {
    const data = buildShowDetailStructuredData(show);

    expect(data["@type"]).toBe("RadioEpisode");
    expect(data.datePublished).toBe(show.publishedAt);
    expect(data.duration).toBe("PT7850S");
    expect(data.interactionStatistic).toEqual({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ListenAction",
      userInteractionCount: 29,
    });
  });
});
