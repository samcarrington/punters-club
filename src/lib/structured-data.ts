import type { Show } from "./mixcloud";
import type { NextShow } from "./next-show";
import { detectPlatform, platformName } from "./platform";
import type { Playlist } from "./playlist";

export const COLLECTION_PAGE_NAME = "The Punters' Club | Radio Waters";
export const COLLECTION_PAGE_DESCRIPTION =
  "The Punters' Club: disco and modern electronic selections from a husband-and-wife DJ duo on Radio Waters.";
export const RADIO_SERIES_NAME = "The Punters' Club";
export const RADIO_SERIES_URL = "https://www.mixcloud.com/radiowaters/";
export const SHOWS_PAGE_NAME = "Shows | The Punters' Club | Radio Waters";
export const SHOWS_PAGE_DESCRIPTION =
  "Browse archived episodes of The Punters' Club, from disco to modern electronic selections broadcast on Radio Waters.";
export const RADIO_WATERS_NAME = "Radio Waters";
export const RADIO_WATERS_URL = "https://www.radiowaters.co.uk/";

type SchemaContext = "https://schema.org";

type OrganizationStructuredData = {
  "@type": "Organization";
  name: string;
  url?: string;
};

type VirtualLocationStructuredData = {
  "@type": "VirtualLocation";
  url: string;
};

type RadioSeriesStructuredData = {
  "@type": "RadioSeries";
  name: string;
  url: string;
};

type InteractionCounterStructuredData = {
  "@type": "InteractionCounter";
  interactionType: "https://schema.org/ListenAction";
  userInteractionCount: number;
};

type RadioEpisodeStructuredData = {
  "@type": "RadioEpisode";
  name: string;
  url: string;
  partOfSeries: RadioSeriesStructuredData;
  description?: string;
  genre?: string[];
  image?: string;
  datePublished?: string;
  duration?: string;
  interactionStatistic?: InteractionCounterStructuredData;
  mainEntityOfPage?: string;
};

type MusicPlaylistStructuredData = {
  "@type": "MusicPlaylist";
  name: string;
  url: string;
  description?: string;
  image?: string;
  provider?: OrganizationStructuredData;
};

type JsonLdEntity = RadioEpisodeStructuredData | MusicPlaylistStructuredData;

type CollectionPageStructuredData = {
  "@context": SchemaContext;
  "@type": "CollectionPage";
  name: string;
  description: string;
  url?: string;
  mainEntity: [
    ItemListStructuredData<RadioEpisodeStructuredData>,
    ItemListStructuredData<MusicPlaylistStructuredData>,
  ];
};

type ShowListStructuredData = {
  "@context": SchemaContext;
  "@type": "CollectionPage";
  name: string;
  description: string;
  url?: string;
  mainEntity: ItemListStructuredData<RadioEpisodeStructuredData>;
};

type ShowDetailStructuredData = RadioEpisodeStructuredData & {
  "@context": SchemaContext;
};

type EventStructuredData = {
  "@context": SchemaContext;
  "@type": "Event";
  name: string;
  url: string;
  eventStatus: "https://schema.org/EventScheduled";
  eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode";
  location: VirtualLocationStructuredData;
  organizer: OrganizationStructuredData;
  performer: OrganizationStructuredData;
  description?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  mainEntityOfPage?: string;
};

type ItemListStructuredData<TItem extends JsonLdEntity> = {
  "@type": "ItemList";
  name: "Shows" | "Archive shows" | "Playlists";
  itemListElement: ListItemStructuredData<TItem>[];
};

type ListItemStructuredData<TItem extends JsonLdEntity> = {
  "@type": "ListItem";
  position: number;
  item: TItem;
};

const cleanText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const buildRadioWatersOrganization = (): OrganizationStructuredData => ({
  "@type": "Organization",
  name: RADIO_WATERS_NAME,
  url: RADIO_WATERS_URL,
});

export const buildShowEntity = (show: Show): RadioEpisodeStructuredData => {
  const item: RadioEpisodeStructuredData = {
    "@type": "RadioEpisode",
    name: show.title,
    url: show.url,
    partOfSeries: {
      "@type": "RadioSeries",
      name: RADIO_SERIES_NAME,
      url: RADIO_SERIES_URL,
    },
  };

  const description = cleanText(show.description);
  if (description) item.description = description;

  /**
   * Extract genres from show tags and add them to the item if available.
   */
  const genres = show.tags
    ?.map((tag) => cleanText(tag.name))
    .filter((genre): genre is string => Boolean(genre));
  if (genres?.length) item.genre = genres;

  const image = cleanText(show.artwork);
  if (image) item.image = image;

  const datePublished = cleanText(show.publishedAt);
  if (datePublished) item.datePublished = datePublished;

  if (typeof show.durationSeconds === "number") {
    item.duration = `PT${Math.max(0, Math.round(show.durationSeconds))}S`;
  }

  if (typeof show.playCount === "number") {
    item.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ListenAction",
      userInteractionCount: show.playCount,
    };
  }

  return item;
};

export const buildShowListStructuredData = (
  shows: Show[],
  options: { pageUrl?: string } = {},
): ShowListStructuredData => {
  const data: ShowListStructuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: SHOWS_PAGE_NAME,
    description: SHOWS_PAGE_DESCRIPTION,
    mainEntity: {
      "@type": "ItemList",
      name: "Shows",
      itemListElement: shows.map((show, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: buildShowEntity(show),
      })),
    },
  };

  if (options.pageUrl) data.url = options.pageUrl;

  return data;
};

export const buildShowDetailStructuredData = (
  show: Show,
  options: { pageUrl?: string } = {},
): ShowDetailStructuredData => {
  const data: ShowDetailStructuredData = {
    "@context": "https://schema.org",
    ...buildShowEntity(show),
  };

  if (options.pageUrl) data.mainEntityOfPage = options.pageUrl;

  return data;
};

export const buildPlaylistEntity = (
  playlist: Playlist,
): MusicPlaylistStructuredData => {
  const item: MusicPlaylistStructuredData = {
    "@type": "MusicPlaylist",
    name: playlist.title,
    url: playlist.url,
  };

  const description = cleanText(playlist.description);
  if (description) item.description = description;

  const image = cleanText(playlist.thumbnail_url);
  if (image) item.image = image;

  const providerName =
    cleanText(playlist.provider_name) ??
    platformName(detectPlatform(playlist.url));
  if (providerName) {
    item.provider = { "@type": "Organization", name: providerName };
  }

  return item;
};

export const buildCollectionPageStructuredData = ({
  shows,
  playlists,
  pageUrl,
}: {
  shows: Show[];
  playlists: Playlist[];
  pageUrl?: string;
}): CollectionPageStructuredData => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: COLLECTION_PAGE_NAME,
  description: COLLECTION_PAGE_DESCRIPTION,
  ...(pageUrl ? { url: pageUrl } : {}),
  mainEntity: [
    {
      "@type": "ItemList",
      name: "Archive shows",
      itemListElement: shows.map((show, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: buildShowEntity(show),
      })),
    },
    {
      "@type": "ItemList",
      name: "Playlists",
      itemListElement: playlists.map((playlist, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: buildPlaylistEntity(playlist),
      })),
    },
  ],
});

export const buildNextShowEventStructuredData = (
  show: NextShow,
  options: { pageUrl?: string } = {},
): EventStructuredData => {
  const data: EventStructuredData = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: show.title,
    url: show.url,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: {
      "@type": "VirtualLocation",
      url: show.url,
    },
    organizer: buildRadioWatersOrganization(),
    performer: buildRadioWatersOrganization(),
  };

  const description = cleanText(show.description);
  if (description) data.description = description;

  const startDate = cleanText(show.startsAtUtc);
  if (startDate) data.startDate = startDate;

  const endDate = cleanText(show.endsAtUtc);
  if (endDate) data.endDate = endDate;

  const image = cleanText(show.posterUrl);
  if (image) data.image = image;

  if (options.pageUrl) data.mainEntityOfPage = options.pageUrl;

  return data;
};

export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/<\/script/gi, "<\\/script");
