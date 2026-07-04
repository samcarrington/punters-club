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

const requestHeaders = {
  "User-Agent": "punters-club-site/next-show",
};

const dedupeEventKey = (event: TribeEvent): string | null => {
  if (event.slug && event.utc_start_date) {
    return `${event.slug}__${event.utc_start_date}`;
  }

  if (event.url) {
    return event.url;
  }

  return null;
};

const bySlugEndpoint = (endpoint: string, slug: string): string =>
  `${endpoint.replace(/\/$/, "")}/by-slug/${encodeURIComponent(slug)}`;

const organizerPageUrl = (endpoint: string, organizerSlug: string): string => {
  const url = new URL(endpoint);
  return new URL(`/dj/${organizerSlug}/`, url.origin).toString();
};

const extractShowSlugsFromHtml = (html: string, limit = 20): string[] => {
  const matches = html.matchAll(/\/show\/([^/"'#?]+)(?:\/\d{4}-\d{2}-\d{2})?\//g);
  const slugs = new Set<string>();

  for (const match of matches) {
    const slug = match[1];
    if (!slug) continue;
    slugs.add(slug);
    if (slugs.size >= limit) break;
  }

  return [...slugs];
};

const isTribeEvent = (value: unknown): value is TribeEvent =>
  !!value && typeof value === "object";

const bySlugResponseToEvent = (body: unknown): TribeEvent | undefined => {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  if ("event" in body) {
    const nested = body.event;
    return isTribeEvent(nested) ? nested : undefined;
  }

  return isTribeEvent(body) ? body : undefined;
};

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
    const response = await fetch(url, { headers: requestHeaders });

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

  const organizerDiscoveredSlugs = new Set<string>();
  for (const organizerSlug of config.organizerSlugs ?? []) {
    const response = await fetch(organizerPageUrl(config.endpoint, organizerSlug), {
      headers: requestHeaders,
    });

    if (!response.ok) {
      console.warn(
        `[next-show] organizer discovery skipped for "${organizerSlug}": HTTP ${response.status}`,
      );
      continue;
    }

    const html = await response.text();
    for (const slug of extractShowSlugsFromHtml(html)) {
      organizerDiscoveredSlugs.add(slug);
    }
  }

  const supplementalSlugs = new Set<string>([
    ...config.guestAppearances.map((guest) => guest.slug),
    ...organizerDiscoveredSlugs,
    ...(config.knownEventSlugs ?? []),
  ]);

  for (const slug of supplementalSlugs) {
    const response = await fetch(bySlugEndpoint(config.endpoint, slug), {
      headers: requestHeaders,
    });

    if (!response.ok) {
      console.warn(
        `[next-show] by-slug fetch skipped for "${slug}": HTTP ${response.status}`,
      );
      continue;
    }

    const body = await response.json();
    const event = bySlugResponseToEvent(body);

    if (event?.slug === slug) {
      events.push(event);
    }
  }

  const deduped = new Map<string, TribeEvent>();
  for (const event of events) {
    const key = dedupeEventKey(event);
    if (!key) continue;
    deduped.set(key, event);
  }

  return [...deduped.values()];
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
