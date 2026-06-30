import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeShow, type Show, toApiUrl } from "../src/lib/mixcloud";

const sourcePath = resolve("src/data/show-sources.json");
const generatedPath = resolve("src/data/shows.generated.json");

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
};

const main = async () => {
  const sources = (await readJson<Show[]>(sourcePath)) ?? [];
  const previous = (await readJson<Show[]>(generatedPath)) ?? [];
  const previousByUrl = new Map(previous.map((show) => [show.url, show]));

  const enriched = await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await fetch(toApiUrl(source.url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const api = (await response.json()) as Record<string, unknown>;
        return normalizeShow(source, api);
      } catch {
        return previousByUrl.get(source.url) ?? normalizeShow(source);
      }
    }),
  );

  await writeFile(generatedPath, `${JSON.stringify(enriched, null, 2)}\n`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
