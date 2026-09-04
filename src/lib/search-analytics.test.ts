import { describe, expect, it } from "vitest";
import {
  createSearchCloseEvent,
  createSearchErrorEvent,
  createSearchOpenEvent,
  createSearchOutcomeEvent,
  createSearchResultSelectEvent,
} from "./search-analytics";

describe("search analytics", () => {
  it("describes an overlay opening without content data", () => {
    expect(createSearchOpenEvent("icon")).toEqual({
      event: "track_search_open",
      search_location: "site_header",
      trigger_variant: "icon",
    });
  });

  it("reports normalized query metrics without reporting the query", () => {
    const event = createSearchOutcomeEvent("  Sísý   Ey ", 2);

    expect(event).toEqual({
      event: "track_search_results",
      search_location: "site_header",
      query_length: 7,
      query_token_count: 2,
      result_count: 2,
    });
    expect(JSON.stringify(event)).not.toMatch(/sísý|sisy|artist|title/i);
  });

  it("uses the no-results event for an empty result set", () => {
    expect(createSearchOutcomeEvent("missing tune", 0)).toEqual({
      event: "track_search_no_results",
      search_location: "site_header",
      query_length: 12,
      query_token_count: 2,
      result_count: 0,
    });
  });

  it("reports bounded selection metadata with one-based ranks", () => {
    expect(
      createSearchResultSelectEvent({
        resultRank: 2,
        appearanceRank: 1,
        appearanceCount: 3,
        showPath: "/shows/night-show/",
        trackPosition: 12,
      }),
    ).toEqual({
      event: "track_search_result_select",
      search_location: "site_header",
      result_rank: 2,
      appearance_rank: 1,
      appearance_count: 3,
      show_path: "/shows/night-show/",
      track_position: 12,
    });
  });

  it("reports only the stable error stage", () => {
    expect(createSearchErrorEvent("validate")).toEqual({
      event: "track_search_error",
      search_location: "site_header",
      error_stage: "validate",
    });
  });

  it("reports close context without reporting the query", () => {
    expect(createSearchCloseEvent("escape", "Four Tet", 4)).toEqual({
      event: "track_search_close",
      search_location: "site_header",
      close_reason: "escape",
      query_length: 8,
      result_count: 4,
    });
  });
});
