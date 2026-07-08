const PLATFORM_DEFINITIONS = {
  spotify: {
    name: "Spotify",
    color: "#1DB954",
    hosts: ["open.spotify.com"],
    iconPath:
      "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  },
  tidal: {
    name: "Tidal",
    color: "#FFFFFF",
    hosts: ["tidal.com", "www.tidal.com"],
    iconPath:
      "M12.012 3.992 8.008 7.996 4.004 3.992 0 7.996 4.004 12l4.004-4.004L12.012 12l-4.004 4.004 4.004 4.004 4.004-4.004L12.012 12l4.004-4.004-4.004-4.004zM16.042 7.996l3.979-3.979L24 7.996l-3.979 3.979z",
  },
  mixcloud: {
    name: "Mixcloud",
    color: "#52AAD8",
    hosts: ["mixcloud.com", "www.mixcloud.com"],
    iconPath:
      "M21.143 8.3a4.412 4.412 0 00-2.81-1.087c-.852 0-1.663.237-2.349.684l.066-.013-.002-.004.026.019a3.574 3.574 0 00-1.58-1.388 3.624 3.624 0 00-1.625-.38 3.7 3.7 0 00-2.652 1.104 3.803 3.803 0 00-1.1 2.483c-.01.154-.01.308-.01.462 0 .103.005.206.01.308-1.438-.062-2.89.412-3.952 1.36A5.625 5.625 0 002.08 13.7a5.873 5.873 0 00-1.46 3.783c0 .702.19 1.39.543 1.993l.02.031a3.88 3.88 0 003.277 1.705h13.822a4.308 4.308 0 003.507-1.688 4.08 4.08 0 00.772-2.87 4.22 4.22 0 00-2.024-3.304l-.004-.002a4.246 4.246 0 00.606-2.223 4.21 4.21 0 00-1.096-2.826z",
  },
} as const;

export type Platform = keyof typeof PLATFORM_DEFINITIONS;

const platforms = Object.entries(PLATFORM_DEFINITIONS) as [
  Platform,
  (typeof PLATFORM_DEFINITIONS)[Platform],
][];

const hostToPlatform = new Map(
  platforms.flatMap(([platform, definition]) =>
    definition.hosts.map((host) => [host, platform] as const),
  ),
);

export const detectPlatform = (url: string): Platform | null => {
  try {
    return hostToPlatform.get(new URL(url).hostname) ?? null;
  } catch {
    return null;
  }
};

export const platformName = (platform: Platform | null): string =>
  platform ? PLATFORM_DEFINITIONS[platform].name : "";

/**
 * Returns an inline SVG string for the brand icon.
 * Icons are 24×24 viewBox with brand-appropriate fill colours.
 */
export const platformIconSvg = (platform: Platform | null): string => {
  if (!platform) return "";

  const { color, iconPath } = PLATFORM_DEFINITIONS[platform];
  return `<svg viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><path d="${iconPath}"/></svg>`;
};
