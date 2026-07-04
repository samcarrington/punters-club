/** Raw event as returned by /wp-json/tribe/events/v1/events. */
export type TribeEvent = {
  title?: string;
  slug?: string;
  url?: string;
  /** Local wall time, e.g. "2026-08-22 19:00:00". */
  start_date?: string;
  end_date?: string;
  /** IANA zone, e.g. "Europe/London". */
  timezone?: string;
  /** UTC wall time, e.g. "2026-08-22 18:00:00". */
  utc_start_date?: string;
  utc_end_date?: string;
  description?: string;
  excerpt?: string;
  image?: { url?: string } | string | false | null;
};

export type GuestAppearance = { slug: string; date?: string };

export type NextShowConfig = {
  endpoint: string;
  titlePatterns: string[];
  knownEventSlugs?: string[];
  organizerSlugs?: string[];
  guestAppearances: GuestAppearance[];
  lookaheadDays: number;
};

export type NextShow = {
  title: string;
  slug: string;
  url: string;
  /** ISO 8601 UTC, e.g. "2026-08-22T18:00:00Z". */
  startsAtUtc: string;
  endsAtUtc?: string;
  timezone: string;
  description: string;
  posterUrl?: string;
  matchedBy: "title" | "guest";
};

export type NextShowResult =
  | { status: "upcoming"; show: NextShow; source: "tribe/events/v1" }
  | { status: "none"; source: "tribe/events/v1" };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export const decodeEntities = (input: string): string =>
  input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isNaN(code) ? whole : String.fromCodePoint(code);
    }

    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? whole : String.fromCodePoint(code);
    }

    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });

export const stripHtml = (input: string): string =>
  decodeEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** Parse a TEC UTC wall time "YYYY-MM-DD HH:mm:ss" into an ISO-Z string. */
export const utcWallTimeToIso = (value?: string): string | null => {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Extract the "YYYY-MM-DD" date part from a local wall time. */
export const localDatePart = (value?: string): string | null => {
  if (!value) return null;

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

export const isValidIanaZone = (tz?: string): boolean => {
  if (!tz) return false;

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const matchesTitle = (
  rawTitle: string | undefined,
  patterns: string[],
): boolean => {
  if (!rawTitle) return false;

  const title = decodeEntities(rawTitle);
  const variants = [title, title.replace(/([A-Za-z])['’]s\b/g, "$1s")];

  return patterns.some((pattern) => {
    const regex = new RegExp(pattern, "i");
    return variants.some((variant) => regex.test(variant));
  });
};

const posterFrom = (image: TribeEvent["image"]): string | undefined => {
  if (!image) return undefined;
  if (typeof image === "string") return image || undefined;
  return image.url || undefined;
};

export const normalizeEvent = (
  event: TribeEvent,
  matchedBy: NextShow["matchedBy"],
): NextShow | null => {
  const title = event.title ? decodeEntities(event.title).trim() : "";
  const startsAtUtc = utcWallTimeToIso(event.utc_start_date);

  if (!title || !event.slug || !event.url || !startsAtUtc) {
    return null;
  }

  if (!event.timezone || !isValidIanaZone(event.timezone)) {
    return null;
  }

  const descriptionSource = event.description ?? event.excerpt ?? "";
  const timezone = event.timezone!;

  return {
    title,
    slug: event.slug,
    url: event.url,
    startsAtUtc,
    endsAtUtc: utcWallTimeToIso(event.utc_end_date) ?? undefined,
    timezone,
    description: stripHtml(descriptionSource),
    posterUrl: posterFrom(event.image),
    matchedBy,
  };
};

const addDays = (now: Date, days: number): Date =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

const utcDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export const selectNextShow = (
  events: TribeEvent[],
  config: NextShowConfig,
  now: Date = new Date(),
): { result: NextShowResult; warnings: string[] } => {
  const warnings: string[] = [];
  const candidates: NextShow[] = [];

  for (const event of events) {
    if (!matchesTitle(event.title, config.titlePatterns)) continue;

    const show = normalizeEvent(event, "title");
    if (show) candidates.push(show);
  }

  const horizon = addDays(now, config.lookaheadDays);
  const todayUtc = new Date(`${utcDateOnly(now)}T00:00:00.000Z`);

  for (const guest of config.guestAppearances) {
    const guestMatches = events.filter((event) => event.slug === guest.slug);
    const datedMatch = guest.date
      ? guestMatches.find(
          (event) => localDatePart(event.start_date) === guest.date,
        )
      : null;

    const slugOnlyMatch = guest.date
      ? null
      : guestMatches
          .map((event) => normalizeEvent(event, "guest"))
          .filter((show): show is NextShow => show !== null)
          .filter((show) => new Date(show.startsAtUtc) >= now)
          .sort((a, b) => {
            const byStart = a.startsAtUtc.localeCompare(b.startsAtUtc);
            return byStart !== 0 ? byStart : a.slug.localeCompare(b.slug);
          })[0] ?? null;

    const show: NextShow | null = guest.date
      ? datedMatch
        ? normalizeEvent(datedMatch, "guest")
        : null
      : slugOnlyMatch;

    if (show) {
      candidates.push(show);
      continue;
    }

    if (!guest.date) {
      warnings.push(
        guestMatches.length === 0
          ? `Unresolved guest override: slug "${guest.slug}" did not match any event in the fetched window.`
          : `Unresolved guest override: slug "${guest.slug}" matched events, but none were upcoming or usable.`,
      );
      continue;
    }

    const guestDate = new Date(`${guest.date}T00:00:00.000Z`);
    if (guestDate >= todayUtc && guestDate <= horizon) {
      warnings.push(
        `Unresolved guest override: slug "${guest.slug}" on ${guest.date} did not match any event in the fetched window.`,
      );
    }
  }

  const deduped = new Map<string, NextShow>();
  for (const show of candidates) {
    deduped.set(`${show.slug}__${show.startsAtUtc}`, show);
  }

  const nextShow = [...deduped.values()]
    .filter((show) => new Date(show.startsAtUtc) >= now)
    .sort((a, b) => {
      const byStart = a.startsAtUtc.localeCompare(b.startsAtUtc);
      return byStart !== 0 ? byStart : a.slug.localeCompare(b.slug);
    })[0];

  return {
    result: nextShow
      ? { status: "upcoming", show: nextShow, source: "tribe/events/v1" }
      : { status: "none", source: "tribe/events/v1" },
    warnings,
  };
};

/** Semantic equality so the enrich script can skip no-op writes. */
export const isSameResult = (a: NextShowResult, b: NextShowResult): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
