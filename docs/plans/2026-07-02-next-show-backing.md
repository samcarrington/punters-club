# Next Show Backing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Populate a "next show" module from the Radio Waters Events Calendar REST API, via a build-time enrichment script, a committed generated JSON artifact, and a daily scheduled GitHub Action that opens a PR when the next show changes.

**Architecture:** All parsing/matching/selection logic lives in a pure, unit-tested module `src/lib/next-show.ts`. A thin script `scripts/enrich-next-show.ts` does the network IO + file writes (resilient fallback, no-op-skip), mirroring `scripts/enrich-shows.ts`. A minimal `NextShow.astro` reads the generated JSON at build. A scheduled workflow regenerates and PRs on change. Visual/UX polish of the card and homepage placement are deferred TODOs (spec `[design-001]`/`[design-002]`).

**Tech Stack:** TypeScript, Astro 7 (static), pnpm, `tsx` for scripts, **vitest** (new, for the pure lib), The Events Calendar REST API (`/wp-json/tribe/events/v1/events`), GitHub Actions + `peter-evans/create-pull-request`.

**Reference spec:** `docs/superpowers/specs/2026-07-02-next-show-backing-design.md`

**Related issue:** [#13](https://github.com/samcarrington/punters-club/issues/13) — testing infrastructure. Any commit that adds or touches test tooling/tests (Task 0 and the TDD tasks 1–5) should reference `#13` in the commit message.

**Conscious deviation from spec to flag during review:** The spec's UTC rule has a middle "derive from `start_date` + `timezone`" branch. Converting a wall-clock time in an IANA zone to UTC without a timezone library is unreliable, and the live API **always** supplies `utc_start_date`. So this plan implements **prefer `utc_start_date`, else discard + warn** and omits the manual-derivation branch (YAGNI). If UTC ever proves unreliable upstream, revisit with a tz library. Update the spec to match once accepted.

---

## Task 0: Add vitest tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Add vitest as a dev dependency**

Run: `pnpm add -D vitest`
Expected: `vitest` appears in `devDependencies`, lockfile updates.

**Step 2: Add a test script to `package.json`**

In the `scripts` block, add:

```jsonc
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

**Step 4: Verify the runner starts (no tests yet)**

Run: `pnpm test`
Expected: vitest runs and reports "No test files found" (exit non-zero is fine at this stage) — confirms wiring.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest for utility testing (#13)"
```

---

## Task 1: Types + HTML decoding helpers in `src/lib/next-show.ts`

**Files:**
- Create: `src/lib/next-show.ts`
- Create: `src/lib/next-show.test.ts`

**Step 1: Write failing tests for decoding helpers**

Create `src/lib/next-show.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeEntities, stripHtml } from "./next-show";

describe("decodeEntities", () => {
  it("decodes numeric decimal entities (curly apostrophe, en dash)", () => {
    expect(decodeEntities("The Punters&#8217; Club &#8211; Summer")).toBe(
      "The Punters’ Club – Summer",
    );
  });
  it("decodes hex and common named entities", () => {
    expect(decodeEntities("Rock &amp; Roll &#x2019;s &quot;best&quot;")).toBe(
      'Rock & Roll ’s "best"',
    );
  });
  it("leaves plain text untouched", () => {
    expect(decodeEntities("Deep Bath with n_sonic")).toBe(
      "Deep Bath with n_sonic",
    );
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities, collapses whitespace", () => {
    expect(stripHtml("<p>Hello&#8230;  <b>world</b></p>")).toBe("Hello… world");
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — `decodeEntities`/`stripHtml` not exported.

**Step 3: Implement types + helpers**

Create `src/lib/next-show.ts`:

```ts
// ---------- Upstream + internal types ----------

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

// ---------- HTML decoding ----------

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
```

**Step 4: Run to verify pass**

Run: `pnpm test`
Expected: PASS (5 assertions).

**Step 5: Commit**

```bash
git add src/lib/next-show.ts src/lib/next-show.test.ts
git commit -m "feat: add next-show types and HTML decoding helpers (#13)"
```

---

## Task 2: Time + title-match helpers

**Files:**
- Modify: `src/lib/next-show.ts`
- Modify: `src/lib/next-show.test.ts`

**Step 1: Add failing tests**

Append to `src/lib/next-show.test.ts`:

```ts
import {
  isValidIanaZone,
  localDatePart,
  matchesTitle,
  utcWallTimeToIso,
} from "./next-show";

describe("utcWallTimeToIso", () => {
  it("parses TEC UTC wall time as ISO Z", () => {
    expect(utcWallTimeToIso("2026-08-22 18:00:00")).toBe(
      "2026-08-22T18:00:00.000Z",
    );
  });
  it("returns null for missing/invalid input", () => {
    expect(utcWallTimeToIso(undefined)).toBeNull();
    expect(utcWallTimeToIso("nonsense")).toBeNull();
  });
});

describe("localDatePart", () => {
  it("extracts the date from a local wall time", () => {
    expect(localDatePart("2026-08-22 19:00:00")).toBe("2026-08-22");
  });
  it("returns null when absent", () => {
    expect(localDatePart(undefined)).toBeNull();
  });
});

describe("isValidIanaZone", () => {
  it("accepts a real zone and rejects junk", () => {
    expect(isValidIanaZone("Europe/London")).toBe(true);
    expect(isValidIanaZone("Not/AZone")).toBe(false);
    expect(isValidIanaZone(undefined)).toBe(false);
  });
});

describe("matchesTitle", () => {
  const patterns = ["punters?['’]?\\s+club"];
  it("matches an HTML-encoded Punters' Club title", () => {
    expect(matchesTitle("The Punters&#8217; Club &#8211; Summer", patterns)).toBe(
      true,
    );
  });
  it("matches a straight-apostrophe variant", () => {
    expect(matchesTitle("The Punter's Club", patterns)).toBe(true);
  });
  it("does not match unrelated shows", () => {
    expect(matchesTitle("Deep Bath with n_sonic", patterns)).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — new functions not exported.

**Step 3: Implement**

Append to `src/lib/next-show.ts`:

```ts
// ---------- Time helpers ----------

/** Parse a TEC UTC wall time "YYYY-MM-DD HH:mm:ss" into an ISO-Z string. */
export const utcWallTimeToIso = (value?: string): string | null => {
  if (!value) return null;
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Extract the "YYYY-MM-DD" date part from a local wall time. */
export const localDatePart = (value?: string): string | null => {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
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

// ---------- Title matching ----------

export const matchesTitle = (
  rawTitle: string | undefined,
  patterns: string[],
): boolean => {
  if (!rawTitle) return false;
  const title = decodeEntities(rawTitle);
  return patterns.some((pattern) => new RegExp(pattern, "i").test(title));
};
```

**Step 4: Run to verify pass**

Run: `pnpm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/next-show.ts src/lib/next-show.test.ts
git commit -m "feat: add time and title-match helpers for next show (#13)"
```

---

## Task 3: `normalizeEvent` — raw event → internal NextShow

**Files:**
- Modify: `src/lib/next-show.ts`
- Modify: `src/lib/next-show.test.ts`

**Step 1: Add failing tests**

Append:

```ts
import { normalizeEvent } from "./next-show";

const augEvent = {
  title: "The Punters&#8217; Club &#8211; Summer Holiday Sounds",
  slug: "the-punters-club-summer-holiday-sounds",
  url: "https://www.radiowaters.co.uk/show/the-punters-club-summer-holiday-sounds/2026-08-22/",
  start_date: "2026-08-22 19:00:00",
  end_date: "2026-08-22 21:00:00",
  timezone: "Europe/London",
  utc_start_date: "2026-08-22 18:00:00",
  utc_end_date: "2026-08-22 20:00:00",
  description: "<p>Sundown &#8230; sounds</p>",
  image: { url: "https://www.radiowaters.co.uk/wp-content/uploads/poster.jpg" },
};

describe("normalizeEvent", () => {
  it("decodes title, strips description, resolves UTC + poster", () => {
    const show = normalizeEvent(augEvent, "title");
    expect(show).toEqual({
      title: "The Punters’ Club – Summer Holiday Sounds",
      slug: "the-punters-club-summer-holiday-sounds",
      url: augEvent.url,
      startsAtUtc: "2026-08-22T18:00:00.000Z",
      endsAtUtc: "2026-08-22T20:00:00.000Z",
      timezone: "Europe/London",
      description: "Sundown … sounds",
      posterUrl: "https://www.radiowaters.co.uk/wp-content/uploads/poster.jpg",
      matchedBy: "title",
    });
  });

  it("returns null when UTC start is missing (discard)", () => {
    expect(normalizeEvent({ ...augEvent, utc_start_date: undefined }, "title")).toBeNull();
  });

  it("returns null when the timezone is not a real IANA zone", () => {
    expect(normalizeEvent({ ...augEvent, timezone: "Not/AZone" }, "title")).toBeNull();
  });

  it("omits poster when image is false/absent", () => {
    const show = normalizeEvent({ ...augEvent, image: false }, "guest");
    expect(show?.posterUrl).toBeUndefined();
    expect(show?.matchedBy).toBe("guest");
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — `normalizeEvent` not exported.

**Step 3: Implement**

Append to `src/lib/next-show.ts`:

```ts
const posterFrom = (image: TribeEvent["image"]): string | undefined => {
  if (!image) return undefined;
  if (typeof image === "string") return image || undefined;
  return image.url || undefined;
};

/**
 * Convert a raw Tribe event into an internal NextShow.
 * Returns null (discard) when required fields are missing or the
 * UTC start / timezone cannot be trusted.
 */
export const normalizeEvent = (
  event: TribeEvent,
  matchedBy: NextShow["matchedBy"],
): NextShow | null => {
  const title = event.title ? decodeEntities(event.title).trim() : "";
  const startsAtUtc = utcWallTimeToIso(event.utc_start_date);
  if (!title || !event.slug || !event.url || !startsAtUtc) return null;
  if (!isValidIanaZone(event.timezone)) return null;

  const descriptionSource = event.description ?? event.excerpt ?? "";
  return {
    title,
    slug: event.slug,
    url: event.url,
    startsAtUtc,
    endsAtUtc: utcWallTimeToIso(event.utc_end_date) ?? undefined,
    timezone: event.timezone as string,
    description: stripHtml(descriptionSource),
    posterUrl: posterFrom(event.image),
    matchedBy,
  };
};
```

**Step 4: Run to verify pass**

Run: `pnpm test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/next-show.ts src/lib/next-show.test.ts
git commit -m "feat: add normalizeEvent for next show (#13)"
```

---

## Task 4: `selectNextShow` — candidate set, dedupe, sort, pick + warnings

**Files:**
- Modify: `src/lib/next-show.ts`
- Modify: `src/lib/next-show.test.ts`

**Step 1: Add failing tests**

Append:

```ts
import { selectNextShow } from "./next-show";

const config = {
  endpoint: "https://example.test",
  titlePatterns: ["punters?['’]?\\s+club"],
  guestAppearances: [{ slug: "saturday-night-in-with", date: "2026-07-04" }],
  lookaheadDays: 60,
};

const guestJul4 = {
  title: "Saturday Night In With…",
  slug: "saturday-night-in-with",
  url: "https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-07-04/",
  start_date: "2026-07-04 19:00:00",
  timezone: "Europe/London",
  utc_start_date: "2026-07-04 18:00:00",
  image: { url: "https://x/p.jpg" },
};
const guestAug29 = {
  ...guestJul4,
  url: "https://www.radiowaters.co.uk/show/saturday-night-in-with/2026-08-29/",
  start_date: "2026-08-29 19:00:00",
  utc_start_date: "2026-08-29 18:00:00",
};

describe("selectNextShow", () => {
  const now = new Date("2026-07-02T00:00:00Z");

  it("picks the soonest qualifying show (guest before later named)", () => {
    const { result } = selectNextShow([augEvent, guestJul4, guestAug29], config, now);
    expect(result.status).toBe("upcoming");
    if (result.status !== "upcoming") throw new Error("expected upcoming");
    expect(result.show.url).toBe(guestJul4.url); // Jul 4 beats Aug 22
    expect(result.show.matchedBy).toBe("guest");
  });

  it("resolves guest by slug AND date only (ignores wrong-date same slug)", () => {
    // No Jul 4 event present; Aug 29 shares slug but is NOT in overrides -> not guest.
    const { result } = selectNextShow([augEvent, guestAug29], config, now);
    if (result.status !== "upcoming") throw new Error("expected upcoming");
    expect(result.show.url).toBe(augEvent.url); // only the named Aug 22 show qualifies
  });

  it("drops past events", () => {
    const past = { ...augEvent, utc_start_date: "2026-06-01 18:00:00" };
    const { result } = selectNextShow([past], config, now);
    expect(result.status).toBe("none");
  });

  it("dedupes a show matched by both title and guest override", () => {
    const both = { ...augEvent, slug: "saturday-night-in-with" };
    const cfg = { ...config, guestAppearances: [{ slug: "saturday-night-in-with", date: "2026-08-22" }] };
    const { result } = selectNextShow([both], cfg, now);
    expect(result.status).toBe("upcoming");
  });

  it("warns about an unresolved future guest override", () => {
    const { warnings } = selectNextShow([augEvent], config, now); // Jul 4 override missing
    expect(warnings.some((w) => w.includes("saturday-night-in-with") && w.includes("2026-07-04"))).toBe(true);
  });

  it("returns none for an empty event list", () => {
    const { result } = selectNextShow([], config, now);
    expect(result).toEqual({ status: "none", source: "tribe/events/v1" });
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — `selectNextShow` not exported.

**Step 3: Implement**

Append to `src/lib/next-show.ts`:

```ts
const dayjsAdd = (now: Date, days: number): Date =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

/**
 * Choose the soonest upcoming qualifying show.
 * Qualifying = title matches config.titlePatterns, OR the event matches a
 * guestAppearances entry by slug AND local date. Returns the result plus any
 * warnings (e.g. unresolved future guest overrides) for CI/PR surfacing.
 */
export const selectNextShow = (
  events: TribeEvent[],
  config: NextShowConfig,
  now: Date = new Date(),
): { result: NextShowResult; warnings: string[] } => {
  const warnings: string[] = [];
  const candidates: NextShow[] = [];

  // Title-matched named shows.
  for (const event of events) {
    if (matchesTitle(event.title, config.titlePatterns)) {
      const show = normalizeEvent(event, "title");
      if (show) candidates.push(show);
    }
  }

  // Guest overrides: slug + local date.
  const horizon = dayjsAdd(now, config.lookaheadDays);
  for (const guest of config.guestAppearances) {
    const match = events.find(
      (e) => e.slug === guest.slug && localDatePart(e.start_date) === guest.date,
    );
    const show = match ? normalizeEvent(match, "guest") : null;
    if (show) {
      candidates.push(show);
    } else {
      const guestDate = new Date(`${guest.date}T00:00:00Z`);
      if (guestDate >= new Date(now.toISOString().slice(0, 10)) && guestDate <= horizon) {
        warnings.push(
          `Unresolved guest override: slug "${guest.slug}" on ${guest.date} did not match any event in the fetched window.`,
        );
      }
    }
  }

  // Dedupe by slug + startsAtUtc.
  const byKey = new Map<string, NextShow>();
  for (const show of candidates) {
    byKey.set(`${show.slug}__${show.startsAtUtc}`, show);
  }

  // Drop past, sort ascending, deterministic tiebreak on slug.
  const upcoming = [...byKey.values()]
    .filter((s) => new Date(s.startsAtUtc) >= now)
    .sort((a, b) => {
      const byTime = a.startsAtUtc.localeCompare(b.startsAtUtc);
      return byTime !== 0 ? byTime : a.slug.localeCompare(b.slug);
    });

  const next = upcoming[0];
  const result: NextShowResult = next
    ? { status: "upcoming", show: next, source: "tribe/events/v1" }
    : { status: "none", source: "tribe/events/v1" };
  return { result, warnings };
};
```

**Step 4: Run to verify pass**

Run: `pnpm test`
Expected: PASS (all `selectNextShow` cases).

**Step 5: Commit**

```bash
git add src/lib/next-show.ts src/lib/next-show.test.ts
git commit -m "feat: add selectNextShow selection logic (#13)"
```

---

## Task 5: `isSameShow` — semantic equality for no-op writes

**Files:**
- Modify: `src/lib/next-show.ts`
- Modify: `src/lib/next-show.test.ts`

**Step 1: Add failing tests**

Append:

```ts
import { isSameResult } from "./next-show";

describe("isSameResult", () => {
  const base = selectNextShow([augEvent], { ...config, guestAppearances: [] }, new Date("2026-07-02T00:00:00Z")).result;

  it("is true for identical results", () => {
    const again = selectNextShow([augEvent], { ...config, guestAppearances: [] }, new Date("2026-07-02T00:00:00Z")).result;
    expect(isSameResult(base, again)).toBe(true);
  });
  it("is false when the show changes", () => {
    const other = selectNextShow([guestJul4], config, new Date("2026-07-02T00:00:00Z")).result;
    expect(isSameResult(base, other)).toBe(false);
  });
  it("is false when status differs", () => {
    const none = selectNextShow([], config, new Date("2026-07-02T00:00:00Z")).result;
    expect(isSameResult(base, none)).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL — `isSameResult` not exported.

**Step 3: Implement**

Append to `src/lib/next-show.ts`:

```ts
/** Semantic equality so the enrich script can skip no-op writes. */
export const isSameResult = (a: NextShowResult, b: NextShowResult): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
```

> `NextShowResult` has no volatile fields (no timestamps), so a stable `JSON.stringify` compare is sufficient and simple.

**Step 4: Run to verify pass**

Run: `pnpm test`
Expected: PASS. Then run the whole suite: `pnpm test` — all green.

**Step 5: Commit**

```bash
git add src/lib/next-show.ts src/lib/next-show.test.ts
git commit -m "feat: add isSameResult for no-op write detection (#13)"
```

---

## Task 6: Committed config file

**Files:**
- Create: `src/data/next-show-config.json`

**Step 1: Create the config**

```json
{
  "endpoint": "https://www.radiowaters.co.uk/wp-json/tribe/events/v1/events",
  "titlePatterns": ["punters?['’]?\\s+club"],
  "guestAppearances": [{ "slug": "saturday-night-in-with", "date": "2026-07-04" }],
  "lookaheadDays": 60
}
```

**Step 2: Commit**

```bash
git add src/data/next-show-config.json
git commit -m "feat: add next-show source config"
```

---

## Task 7: Enrichment script `scripts/enrich-next-show.ts`

**Files:**
- Create: `scripts/enrich-next-show.ts`

**Step 1: Implement (mirrors `scripts/enrich-shows.ts` IO + fallback)**

```ts
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Fetch upcoming events across the lookahead window (paginated, guarded). */
const fetchEvents = async (config: NextShowConfig): Promise<TribeEvent[]> => {
  const now = new Date();
  const start = isoDate(now);
  const end = isoDate(new Date(now.getTime() + config.lookaheadDays * 86_400_000));
  const events: TribeEvent[] = [];
  const maxPages = 5; // window is < 1 month; guard runaway paging.
  for (let page = 1; page <= maxPages; page++) {
    const url = `${config.endpoint}?start_date=${start}&end_date=${end}&per_page=50&page=${page}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "punters-club-site/next-show" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as {
      events?: TribeEvent[];
      total_pages?: number;
    };
    events.push(...(body.events ?? []));
    if (!body.total_pages || page >= body.total_pages) break;
  }
  return events;
};

const staleFallback = (previous: NextShowResult | null): NextShowResult => {
  if (previous?.status === "upcoming") {
    const stillUpcoming = new Date(previous.show.startsAtUtc) >= new Date();
    if (stillUpcoming) return previous;
  }
  return { status: "none", source: "tribe/events/v1" };
};

const main = async () => {
  const config = await readJson<NextShowConfig>(configPath);
  if (!config) throw new Error("Missing or invalid next-show-config.json");
  const previous = await readJson<NextShowResult>(generatedPath);

  let result: NextShowResult;
  try {
    const events = await fetchEvents(config);
    const selected = selectNextShow(events, config, new Date());
    result = selected.result;
    for (const warning of selected.warnings) console.warn(`[next-show] ${warning}`);
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
    `[next-show] wrote ${generatedPath} (status=${result.status}` +
      (result.status === "upcoming" ? `, show=${result.show.url}` : "") +
      ")",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

**Step 2: Generate the initial artifact against live data**

Run: `pnpm exec tsx scripts/enrich-next-show.ts`
Expected: writes `src/data/next-show.generated.json`. Given today is before 2026-08-22 and the Jul-4 guest override is configured, the result should be the **Saturday Night In With…** guest show on 2026-07-04 (soonest), or the Aug 22 Punters' Club show if Jul 4 is already past when run.

**Step 3: Sanity-check the output**

Run: `cat src/data/next-show.generated.json`
Expected: valid JSON, `status: "upcoming"`, a decoded `title` (no `&#8217;`), a `startsAtUtc` ending in `Z`, `timezone: "Europe/London"`.

**Step 4: Commit**

```bash
git add scripts/enrich-next-show.ts src/data/next-show.generated.json
git commit -m "feat: add next-show enrichment script and initial data"
```

---

## Task 8: Wire into the build

**Files:**
- Modify: `package.json`

**Step 1: Add the script + extend the enrich chain**

In `scripts`, add `enrich:next-show` and append it to `enrich`:

```jsonc
"enrich:next-show": "tsx scripts/enrich-next-show.ts",
"enrich": "pnpm run enrich:shows && pnpm run enrich:playlists && pnpm run enrich:next-show",
```

**Step 2: Verify the full build still passes**

Run: `pnpm run build`
Expected: enrich runs all three, `astro build` succeeds.
> Per AGENTS.md, this may also refresh Mixcloud/Spotify generated data. If that churn is unrelated, `git checkout` those files before committing, or use `pnpm exec astro build` for UI-only checks.

**Step 3: Commit (config only, restoring unrelated generated churn)**

```bash
git add package.json
git checkout -- src/data/shows.generated.json src/data/playlists.generated.json 2>/dev/null || true
git commit -m "build: run next-show enrichment during build"
```

---

## Task 9: Minimal `NextShow.astro` consumer

> Visual/UX polish is deferred (`[design-001]`). This is a functional, low-styling consumer only.

**Files:**
- Create: `src/components/NextShow.astro`
- Modify: `src/pages/index.astro`

**Step 1: Create the component**

```astro
---
import type { NextShowResult } from "../lib/next-show";
import result from "../data/next-show.generated.json";

const data = result as NextShowResult;

const formatWhen = (startsAtUtc: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(startsAtUtc));
---

{/* TODO [design-001]: visual/UX polish — poster treatment, hierarchy, empty-state copy. */}
{
  data.status === "upcoming" ? (
    <article class="next-show-card">
      <p class="next-show-when">{formatWhen(data.show.startsAtUtc, data.show.timezone)}</p>
      <h3>{data.show.title}</h3>
      {data.show.description && <p>{data.show.description}</p>}
      <a href={data.show.url} target="_blank" rel="noreferrer" class="link-external">
        View on Radio Waters<span class="sr-only"> (opens in new tab)</span>
      </a>
    </article>
  ) : (
    <p class="next-show-empty">No show scheduled right now — check back soon.</p>
  )
}
```

**Step 2: Add the section to the homepage**

In `src/pages/index.astro`, add the import near the other component imports:

```ts
import NextShow from "../components/NextShow.astro";
```

And add a section immediately after the closing `</section>` of the hero (before `#latest-show`):

```astro
  <section id="next-show" class="band" aria-labelledby="next-show-title">
    <header class="band-header">
      <h2 id="next-show-title">Next show</h2>
    </header>
    <div class="band-content">
      <NextShow />
    </div>
  </section>
```

> TODO `[design-002]`: final placement, band vs panel treatment, and JSON-LD `Event` reconciliation are a separate @designer pass.

**Step 3: Verify build + render**

Run: `pnpm exec astro build`
Expected: build succeeds; `dist/index.html` contains the "Next show" heading and the decoded show title.

Run: `grep -o "Next show" dist/index.html | head -1`
Expected: `Next show`

**Step 4: Commit**

```bash
git add src/components/NextShow.astro src/pages/index.astro
git commit -m "feat: add minimal next-show module to homepage"
```

---

## Task 10: Scheduled refresh workflow

**Files:**
- Create: `.github/workflows/next-show-refresh.yml`

**Step 1: Create the workflow**

```yaml
name: Refresh next show

on:
  schedule:
    - cron: "0 7 * * *" # 07:00 UTC daily
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Enable pnpm
        run: |
          corepack enable
          corepack prepare pnpm@11.9.0 --activate

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Enrich next show
        run: pnpm run enrich:next-show 2>&1 | tee /tmp/next-show.log

      - name: Open PR on change
        uses: peter-evans/create-pull-request@v6
        with:
          branch: bot/next-show
          base: main
          title: "chore: refresh next show"
          commit-message: "chore: refresh next show data"
          body-path: /tmp/next-show.log
          add-paths: src/data/next-show.generated.json
          delete-branch: false
```

> Notes for the implementer:
> - The script's no-op-skip means an unchanged run leaves the file untouched, so `create-pull-request` finds no diff and does nothing — no PR churn. A changed run updates the single durable `bot/next-show` branch/PR.
> - `body-path` surfaces any `[next-show] Unresolved guest override…` warnings to the reviewer.
> - Per AGENTS.md working memory: if an enterprise EMU blocks third-party actions, replace the PR step with a `gh pr create`/`gh pr edit` script using the `GITHUB_TOKEN`. This personal repo should allow `peter-evans/create-pull-request`; confirm on first run.

**Step 2: Validate YAML locally (optional)**

Run: `pnpm exec astro build` is unaffected; there's no local runner for Actions. Confirm the file parses (no tabs, correct indentation) by eye or with `yamllint` if available.

**Step 3: Commit**

```bash
git add .github/workflows/next-show-refresh.yml
git commit -m "ci: add scheduled next-show refresh PR workflow"
```

**Step 4: First live run**

After merge to `main`, trigger `workflow_dispatch` once from the Actions tab. Confirm it either opens a `bot/next-show` PR with a sensible diff, or logs "no change; skipping write" and opens nothing.

---

## Task 11: Final verification

**Step 1: Full suite + build**

Run: `pnpm test && pnpm exec astro build`
Expected: all vitest tests pass; Astro build succeeds.

**Step 2: Confirm the live August show is selectable**

Run: `pnpm exec tsx scripts/enrich-next-show.ts && cat src/data/next-show.generated.json`
Expected: a valid upcoming result with a decoded Punters'/guest title, ISO-Z UTC start, `Europe/London` zone.

**Step 3: Restore any unrelated generated churn, then confirm clean status**

Run: `git status --short`
Expected: only intended files changed.

---

## Deferred (not in this plan — route to @designer)

- `[design-001]` NextShow card visual/UX: poster treatment, hierarchy, motion, empty-state copy, fit to the band/rail design language (PRODUCT.md).
- `[design-002]` Homepage placement + JSON-LD: final position relative to latest/archive, and adding an `Event` entity to the structured data, reconciled with `src/lib/structured-data.ts`.
