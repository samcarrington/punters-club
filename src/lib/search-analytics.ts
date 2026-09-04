import type { AnalyticsEvent } from "./cookie-consent";
import { normalizeSearchText } from "./track-search";

export type SearchTriggerVariant = "icon" | "label";
export type SearchErrorStage = "fetch" | "validate" | "render";
export type SearchCloseReason =
  | "button"
  | "escape"
  | "backdrop"
  | "menu_opened"
  | "navigation";

const SEARCH_LOCATION = "site_header" as const;

const queryMetrics = (query: string) => {
  const normalized = normalizeSearchText(query);

  return {
    query_length: normalized.length,
    query_token_count: normalized ? normalized.split(" ").length : 0,
  };
};

export const createSearchOpenEvent = (
  triggerVariant: SearchTriggerVariant,
): AnalyticsEvent => ({
  event: "track_search_open",
  search_location: SEARCH_LOCATION,
  trigger_variant: triggerVariant,
});

export const createSearchOutcomeEvent = (
  query: string,
  resultCount: number,
): AnalyticsEvent => ({
  event:
    resultCount > 0 ? "track_search_results" : "track_search_no_results",
  search_location: SEARCH_LOCATION,
  ...queryMetrics(query),
  result_count: Math.max(0, resultCount),
});

export const createSearchResultSelectEvent = ({
  resultRank,
  appearanceRank,
  appearanceCount,
  showPath,
  trackPosition,
}: {
  resultRank: number;
  appearanceRank: number;
  appearanceCount: number;
  showPath: string;
  trackPosition: number;
}): AnalyticsEvent => ({
  event: "track_search_result_select",
  search_location: SEARCH_LOCATION,
  result_rank: resultRank,
  appearance_rank: appearanceRank,
  appearance_count: appearanceCount,
  show_path: showPath,
  track_position: trackPosition,
});

export const createSearchErrorEvent = (
  errorStage: SearchErrorStage,
): AnalyticsEvent => ({
  event: "track_search_error",
  search_location: SEARCH_LOCATION,
  error_stage: errorStage,
});

export const createSearchCloseEvent = (
  closeReason: SearchCloseReason,
  query: string,
  resultCount: number,
): AnalyticsEvent => ({
  event: "track_search_close",
  search_location: SEARCH_LOCATION,
  close_reason: closeReason,
  query_length: queryMetrics(query).query_length,
  result_count: Math.max(0, resultCount),
});
