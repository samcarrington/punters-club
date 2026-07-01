import { detectPlatform, platformName } from "./platform";
import type { Playlist } from "./playlist";
import type { Show } from "./mixcloud";

export const COLLECTION_PAGE_NAME = "The Punters' Club | Radio Waters";
export const COLLECTION_PAGE_DESCRIPTION =
  "The Punters' Club: disco and modern electronic selections from a husband-and-wife DJ duo on Radio Waters.";
export const RADIO_SERIES_NAME = "The Punters' Club";
export const RADIO_SERIES_URL = "https://www.mixcloud.com/radiowaters/";

type JsonLdEntity = Record<string, unknown>;

type CollectionPageStructuredData = {
  "@context": "https://schema.org";
  "@type": "CollectionPage";
  name: string;
  description: string;
  mainEntity: [ItemListStructuredData, ItemListStructuredData];
};

type ItemListStructuredData = {
  "@type": "ItemList";
  name: "Archive shows" | "Playlists";
  itemListElement: ListItemStructuredData[];
};

type ListItemStructuredData = {
  "@type": "ListItem";
  position: number;
  item: JsonLdEntity;
};

const cleanText = (value?: string) => (value && value.trim() ? value : undefined);

export const buildShowEntity = (show: Show): JsonLdEntity => {
  const item: JsonLdEntity = {
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

  const genres = show.tags
    ?.map((tag) => cleanText(tag.name))
    .filter((genre): genre is string => Boolean(genre));
  if (genres && genres.length) item.genre = genres;

  const image = cleanText(show.artwork);
  if (image) item.image = image;

  return item;
};

export const buildPlaylistEntity = (playlist: Playlist): JsonLdEntity => {
  const item: JsonLdEntity = {
    "@type": "MusicPlaylist",
    name: playlist.title,
    url: playlist.url,
  };

  const description = cleanText(playlist.description);
  if (description) item.description = description;

  const image = cleanText(playlist.thumbnail_url);
  if (image) item.image = image;

  const providerName = cleanText(playlist.provider_name) ?? platformName(detectPlatform(playlist.url));
  if (providerName) {
    item.provider = { "@type": "Organization", name: providerName };
  }

  return item;
};

export const buildCollectionPageStructuredData = ({
  shows,
  playlists,
}: {
  shows: Show[];
  playlists: Playlist[];
}): CollectionPageStructuredData => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: COLLECTION_PAGE_NAME,
  description: COLLECTION_PAGE_DESCRIPTION,
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

export const serializeJsonLd = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/<\/script/gi, "<\\/script");
