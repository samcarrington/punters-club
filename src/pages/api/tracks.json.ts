import type { APIRoute } from "astro";
import generatedShowsData from "../../data/shows.generated.json";
import type { Show } from "../../lib/mixcloud";
import { assertValidShowSlugs, sortShows } from "../../lib/shows";
import {
  buildTrackSearchIndex,
  type TrackSearchResponse,
} from "../../lib/track-search";

export const prerender = true;

export const GET: APIRoute = () => {
  const shows = generatedShowsData as Show[];
  assertValidShowSlugs(shows);

  const body: TrackSearchResponse = {
    version: 1,
    entries: buildTrackSearchIndex(sortShows(shows, "newest")),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
