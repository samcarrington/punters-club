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

export type GuestAppearance = { slug: string; date: string };

export type NextShowConfig = {
  endpoint: string;
  titlePatterns: string[];
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
