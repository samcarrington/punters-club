import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  isSameResult,
  type NextShowConfig,
  type NextShowResult,
  selectNextShow,
  type TribeEvent,
} from "../src/lib/next-show";

const configPath = resolve("src/data/next-show-config.json");
const generatedPath = resolve("src/data/next-show.generated.json");

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
};

const isoDate = (date: Date): string => date.toISOString().slice(0, 10);

const fetchEvents = async (config: NextShowConfig): Promise<TribeEvent[]> => {
  const today = new Date();
  const start = isoDate(today);
  const end = isoDate(
    new Date(today.getTime() + config.lookaheadDays * 24 * 60 * 60 * 1000),
  );
  const events: TribeEvent[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page++) {
    const url = `${config.endpoint}?start_date=${start}&end_date=${end}&per_page=50&page=${page}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "punters-club-site/next-show",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      events?: TribeEvent[];
      total_pages?: number;
    };

    events.push(...(body.events ?? []));

    if (!body.total_pages || page >= body.total_pages) {
      break;
    }
  }

  return events;
};

const staleFallback = (previous: NextShowResult | null): NextShowResult => {
  if (previous?.status === "upcoming") {
    const stillFuture = new Date(previous.show.startsAtUtc) >= new Date();
    if (stillFuture) {
      return previous;
    }
  }

  return { status: "none", source: "tribe/events/v1" };
};

const main = async () => {
  const config = await readJson<NextShowConfig>(configPath);
  if (!config) {
    throw new Error("Missing or invalid next-show-config.json");
  }

  const previous = await readJson<NextShowResult>(generatedPath);

  let result: NextShowResult;
  try {
    const events = await fetchEvents(config);
    const selected = selectNextShow(events, config, new Date());
    result = selected.result;

    for (const warning of selected.warnings) {
      console.warn(`[next-show] ${warning}`);
    }
  } catch (error) {
    console.warn(`[next-show] fetch failed, using fallback: ${String(error)}`);
    result = staleFallback(previous);
  }

  if (previous && isSameResult(previous, result)) {
    console.log("[next-show] no change; skipping write.");
    return;
  }

  await writeFile(generatedPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `[next-show] wrote ${generatedPath} (status=${result.status}${result.status === "upcoming" ? `, show=${result.show.url}` : ""})`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
