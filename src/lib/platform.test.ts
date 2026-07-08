import { describe, expect, it } from "vitest";

import { detectPlatform, platformIconSvg, platformName } from "./platform";

describe("detectPlatform", () => {
  it.each([
    ["https://open.spotify.com/playlist/37i9dQZEVXddQ2lzBCQuaj", "spotify"],
    ["https://tidal.com/playlist/c7db223a-6940-46ea-bf84-e758f5fce676", "tidal"],
    ["https://www.tidal.com/playlist/c7db223a-6940-46ea-bf84-e758f5fce676", "tidal"],
    ["https://www.mixcloud.com/radiowaters/the-punters-club-spring-forward/", "mixcloud"],
    ["https://mixcloud.com/radiowaters/the-punters-club-spring-forward/", "mixcloud"],
  ] as const)("detects %s as %s", (url, platform) => {
    expect(detectPlatform(url)).toBe(platform);
  });

  it.each(["not a url", "https://example.com/playlist/123"])(
    "returns null for unsupported URL %s",
    (url) => {
      expect(detectPlatform(url)).toBeNull();
    },
  );
});

describe("platformName", () => {
  it.each([
    ["spotify", "Spotify"],
    ["tidal", "Tidal"],
    ["mixcloud", "Mixcloud"],
    [null, ""],
  ] as const)("returns display name for %s", (platform, name) => {
    expect(platformName(platform)).toBe(name);
  });
});

describe("platformIconSvg", () => {
  it.each([
    ["spotify", "#1DB954"],
    ["tidal", "#FFFFFF"],
    ["mixcloud", "#52AAD8"],
  ] as const)("returns branded aria-hidden SVG for %s", (platform, color) => {
    const svg = platformIconSvg(platform);

    expect(svg).toContain('<svg viewBox="0 0 24 24"');
    expect(svg).toContain(`fill="${color}"`);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("<path d=");
  });

  it("returns an empty string when platform is unknown", () => {
    expect(platformIconSvg(null)).toBe("");
  });
});
