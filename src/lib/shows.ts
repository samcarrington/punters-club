import type { Show } from "./mixcloud";

export type ShowSort = "newest" | "oldest" | "listens-high" | "listens-low";

const compareText = (left?: string, right?: string) =>
  (left ?? "").localeCompare(right ?? "");

const compareNumber = (
  left: number | undefined,
  right: number | undefined,
  direction: "asc" | "desc",
) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
};

const compareDate = (
  left: string | undefined,
  right: string | undefined,
  direction: "asc" | "desc",
) => {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;

  return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
};

export const sortShows = (shows: Show[], sort: ShowSort): Show[] => {
  const sorted = [...shows];

  sorted.sort((left, right) => {
    const primary =
      sort === "newest"
        ? compareDate(left.publishedAt, right.publishedAt, "desc")
        : sort === "oldest"
          ? compareDate(left.publishedAt, right.publishedAt, "asc")
          : sort === "listens-high"
            ? compareNumber(left.playCount, right.playCount, "desc")
            : compareNumber(left.playCount, right.playCount, "asc");

    if (primary !== 0) return primary;

    const byDate = compareDate(left.publishedAt, right.publishedAt, "desc");
    if (byDate !== 0) return byDate;

    return compareText(
      left.slug ?? left.url ?? left.title,
      right.slug ?? right.url ?? right.title,
    );
  });

  return sorted;
};

export const assertValidShowSlugs = (shows: Show[]): void => {
  const seen = new Map<string, string>();

  for (const show of shows) {
    const trimmedSlug = show.slug?.trim();
    if (!trimmedSlug) {
      throw new Error(
        `Generated show is missing a slug: ${show.title} (${show.url})`,
      );
    }

    const normalizedSlug = trimmedSlug.toLowerCase();
    const existingUrl = seen.get(normalizedSlug);
    if (existingUrl) {
      throw new Error(
        `Duplicate generated show slug "${show.slug}" for URLs ${existingUrl} and ${show.url}`,
      );
    }

    seen.set(normalizedSlug, show.url);
  }
};
