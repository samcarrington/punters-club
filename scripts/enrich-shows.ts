import { resolve } from "node:path";
import { normalizeShow, type Show, toApiUrl } from "../src/lib/mixcloud";
import { fetchWithFallback, readJson, writeJson } from "./lib/enrich-utils";

const sourcePath = resolve("src/data/show-sources.json");
const generatedPath = resolve("src/data/shows.generated.json");

const main = async () => {
  const sources = (await readJson<Show[]>(sourcePath)) ?? [];
  const previous = (await readJson<Show[]>(generatedPath)) ?? [];
  const previousByUrl = new Map(previous.map((show) => [show.url, show]));

  const enriched = await Promise.all(
    sources.map((source) =>
      fetchWithFallback({
        label: "enrich-shows",
        identify: source.url,
        fetchAndNormalize: async () => {
          const response = await fetch(toApiUrl(source.url));
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const api = (await response.json()) as Record<string, unknown>;
          return normalizeShow(source, api);
        },
        fallback: () => {
          const previous =
            previousByUrl.get(source.url) ?? normalizeShow(source);
          return {
            ...previous,
            title: source.title || previous.title,
            description:
              source.localDescription ??
              source.description ??
              previous.description,
            tracklist: source.tracklist,
          };
        },
      }),
    ),
  );

  await writeJson(generatedPath, enriched);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
