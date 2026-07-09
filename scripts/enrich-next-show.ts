import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NEXT_SHOW } from "../src/lib/constants";
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

const viewsV2Endpoint = (endpoint: string): string => {
  const url = new URL(endpoint);
  return new URL("/wp-json/tribe/views/v2/html", url.origin).toString();
};

const organizerPageUrl = (endpoint: string, organizerSlug: string): string => {
  const url = new URL(endpoint);
  return new URL(`/dj/${organizerSlug}/`, url.origin).toString();
};

const monthSeedPath = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `/shows/month/${year}-${month}/`;
};

const monthSeedPaths = (today: Date, lookaheadDays: number): string[] => {
  const paths = new Set<string>();
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const horizon = new Date(today.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const horizonMonth = new Date(
    Date.UTC(horizon.getUTCFullYear(), horizon.getUTCMonth(), 1),
  );

  while (cursor <= horizonMonth) {
    paths.add(monthSeedPath(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return [...paths];
};

const extractViewsTokens = (html: string): { tvn1: string; tvn2: string } | null => {
  const tvn1 = html.match(/"tvn1":"([^"]*)"/);
  const tvn2 = html.match(/"tvn2":"([^"]*)"/);

  if (!tvn1 || !tvn2) {
    return null;
  }

  return { tvn1: tvn1[1], tvn2: tvn2[1] };
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

const fetchText = async (url: string): Promise<string | null> => {
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) {
    return null;
  }

  return response.text();
};

const discoverOrganizerSlugsFromViews = async (
  config: NextShowConfig,
  today: Date,
): Promise<Set<string>> => {
  const discovered = new Set<string>();
  const organizerSlugs = config.organizerSlugs ?? [];
  if (organizerSlugs.length === 0) {
    return discovered;
  }

  let tokens: { tvn1: string; tvn2: string } | null = null;
  for (const organizerSlug of organizerSlugs) {
    const html = await fetchText(organizerPageUrl(config.endpoint, organizerSlug));
    if (!html) {
      console.warn(
        `[next-show] organizer seed fetch skipped for "${organizerSlug}" when extracting TEC tokens.`,
      );
      continue;
    }

    tokens = extractViewsTokens(html);
    if (tokens) {
      break;
    }
  }

  if (!tokens) {
    return discovered;
  }

  for (const monthPath of monthSeedPaths(today, config.lookaheadDays)) {
    const url = new URL(viewsV2Endpoint(config.endpoint));
    url.searchParams.set("u", monthPath);
    url.searchParams.set("smu", "true");
    url.searchParams.set("tvn1", tokens.tvn1);
    url.searchParams.set("tvn2", tokens.tvn2);

    const response = await fetch(url, { headers: requestHeaders });
    if (!response.ok) {
      console.warn(
        `[next-show] views-v2 discovery skipped for "${monthPath}": HTTP ${response.status}`,
      );
      continue;
    }

    const body = (await response.json()) as { html?: string };
    for (const slug of extractShowSlugsFromHtml(body.html ?? "")) {
      discovered.add(slug);
    }
  }

  return discovered;
};

const discoverOrganizerSlugsFromPages = async (
  config: NextShowConfig,
): Promise<Set<string>> => {
  const discovered = new Set<string>();

  for (const organizerSlug of config.organizerSlugs ?? []) {
    const html = await fetchText(organizerPageUrl(config.endpoint, organizerSlug));
    if (!html) {
      console.warn(
        `[next-show] organizer discovery skipped for "${organizerSlug}": page unavailable.`,
      );
      continue;
    }

    for (const slug of extractShowSlugsFromHtml(html)) {
      discovered.add(slug);
    }
  }

  return discovered;
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

  let organizerDiscoveredSlugs = await discoverOrganizerSlugsFromViews(config, today);
  if (organizerDiscoveredSlugs.size === 0) {
    organizerDiscoveredSlugs = await discoverOrganizerSlugsFromPages(config);
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
  if (previous?.status === NEXT_SHOW.upcomingStatus) {
    const stillFuture = new Date(previous.show.startsAtUtc) >= new Date();
    if (stillFuture) {
      return previous;
    }
  }

  return { status: NEXT_SHOW.noneStatus, source: NEXT_SHOW.source };
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
    `[next-show] wrote ${generatedPath} (status=${result.status}${result.status === NEXT_SHOW.upcomingStatus ? `, show=${result.show.url}` : ""})`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
