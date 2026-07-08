import { describe, expect, it } from "vitest";

import config from "../data/next-show-config.json";
import type { NextShowConfig, TribeEvent } from "./next-show";

const runRemoteTests = process.env.RUN_REMOTE_TESTS === "1";
const describeRemote = runRemoteTests ? describe : describe.skip;

const requestHeaders = {
  "User-Agent": "punters-club-site/next-show-remote-test",
};

const timeoutMs = 10_000;

const withTimeout = async <T>(operation: (signal: AbortSignal) => Promise<T>) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const bySlugEndpoint = (endpoint: string, slug: string): string =>
  `${endpoint.replace(/\/$/, "")}/by-slug/${encodeURIComponent(slug)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

const eventFromBySlugResponse = (body: unknown): TribeEvent | null => {
  if (!isRecord(body)) return null;
  const event = "event" in body ? body.event : body;
  return isRecord(event) ? (event as TribeEvent) : null;
};

const assertEventShape = (event: TribeEvent) => {
  expect(event.title, "event.title").toEqual(expect.any(String));
  expect(event.slug, "event.slug").toEqual(expect.any(String));
  expect(event.url, "event.url").toEqual(expect.stringContaining("/show/"));
  expect(event.utc_start_date, "event.utc_start_date").toEqual(
    expect.any(String),
  );
  expect(event.timezone, "event.timezone").toEqual(expect.any(String));
};

describeRemote("Radio Waters next-show remote endpoint", () => {
  const remoteConfig = config as NextShowConfig;

  it("returns a valid Tribe events response for the build-time enrichment window", async () => {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(
      now.getTime() + remoteConfig.lookaheadDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const url = new URL(remoteConfig.endpoint);
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("page", "1");

    const response = await withTimeout((signal) =>
      fetch(url, { headers: requestHeaders, signal }),
    );
    expect(response.ok, `${url.toString()} HTTP ${response.status}`).toBe(true);

    const body = (await response.json()) as { events?: TribeEvent[] };
    expect(Array.isArray(body.events)).toBe(true);

    if (body.events?.length) {
      assertEventShape(body.events[0]);
    }
  });

  it("returns valid event data for configured supplemental by-slug lookups", async () => {
    const supplementalSlugs = [
      ...remoteConfig.guestAppearances.map((guest) => guest.slug),
      ...(remoteConfig.knownEventSlugs ?? []),
    ];
    expect(supplementalSlugs.length).toBeGreaterThan(0);

    for (const slug of supplementalSlugs) {
      const url = bySlugEndpoint(remoteConfig.endpoint, slug);
      const response = await withTimeout((signal) =>
        fetch(url, { headers: requestHeaders, signal }),
      );
      expect(response.ok, `${url} HTTP ${response.status}`).toBe(true);

      const event = eventFromBySlugResponse(await response.json());
      expect(event, `${slug} event payload`).not.toBeNull();
      expect(event?.slug).toBe(slug);
      assertEventShape(event!);
    }
  });
});
