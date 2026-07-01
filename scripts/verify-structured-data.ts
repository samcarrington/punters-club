import { readFileSync } from "node:fs";
import { join } from "node:path";

type ListItem = {
  position?: unknown;
  item?: unknown;
};

type ItemList = {
  "@type"?: unknown;
  name?: unknown;
  itemListElement?: unknown;
};

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;

const fail = (message: string): never => {
  throw new Error(`Structured data verification failed: ${message}`);
};

const scriptTags = readFileSync(join("dist", "index.html"), "utf8").match(
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
);

const jsonLdScripts =
  scriptTags?.filter((tag) => /type=["']application\/ld\+json["']/i.test(tag)) ?? [];

if (jsonLdScripts.length !== 1) {
  fail(`expected exactly one JSON-LD script, found ${jsonLdScripts.length}`);
}

const scriptBody = jsonLdScripts[0]?.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "");
if (!scriptBody) fail("JSON-LD script is empty");

const structuredData = JSON.parse(scriptBody) as {
  "@context"?: unknown;
  mainEntity?: unknown;
};

if (structuredData["@context"] !== "https://schema.org") {
  fail("expected @context to be https://schema.org");
}

const mainEntity = structuredData.mainEntity;
const mainEntityItems: unknown[] = Array.isArray(mainEntity)
  ? mainEntity
  : fail("expected mainEntity to be an array");

const itemLists = mainEntityItems.filter(
  (entity): entity is ItemList =>
    Boolean(entity) &&
    typeof entity === "object" &&
    (entity as ItemList)["@type"] === "ItemList",
);

if (itemLists.length !== 2) {
  fail(`expected exactly two ItemList entries, found ${itemLists.length}`);
}

const archiveList =
  itemLists.find((list) => list.name === "Archive shows") ??
  fail('missing ItemList named "Archive shows"');
const playlistList =
  itemLists.find((list) => list.name === "Playlists") ??
  fail('missing ItemList named "Playlists"');

const showSources = readJson<unknown[]>(join("src", "data", "shows.generated.json"));
const playlistSources = readJson<unknown[]>(join("src", "data", "playlists.generated.json"));

const archiveItems: unknown[] = Array.isArray(archiveList.itemListElement)
  ? archiveList.itemListElement
  : fail("Archive shows itemListElement is not an array");
const playlistItems: unknown[] = Array.isArray(playlistList.itemListElement)
  ? playlistList.itemListElement
  : fail("Playlists itemListElement is not an array");

const expectedArchiveCount = showSources.length;
if (archiveItems.length !== expectedArchiveCount) {
  fail(`expected ${expectedArchiveCount} archive shows, found ${archiveItems.length}`);
}

if (playlistItems.length !== playlistSources.length) {
  fail(`expected ${playlistSources.length} playlists, found ${playlistItems.length}`);
}

const verifyPositions = (items: unknown[], listName: string) => {
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      fail(`${listName} item ${index + 1} is not an object`);
    }

    const position = (item as ListItem).position;
    if (position !== index + 1) {
      fail(`${listName} position ${String(position)} should be ${index + 1}`);
    }
  });
};

verifyPositions(archiveItems, "Archive shows");
verifyPositions(playlistItems, "Playlists");

console.log("Structured data verification passed");
