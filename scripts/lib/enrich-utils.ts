import { readFile, writeFile } from "node:fs/promises";

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isEnoent = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";

/**
 * Reads and parses a JSON file. Returns null (silently) when the file does
 * not exist yet - expected on a first run - but warns when the file exists
 * and fails to parse, since that usually means a hand-edit went bad.
 */
export const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (!isEnoent(error)) {
      console.warn(
        `[enrich] failed to read/parse ${path}: ${describeError(error)}`,
      );
    }
    return null;
  }
};

export const writeJson = async (path: string, data: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
};

type FetchWithFallbackOptions<TResult> = {
  /** Log prefix identifying which enrich script emitted the warning, e.g. "enrich-shows". */
  label: string;
  /** Human-readable identifier for the item being enriched, used in the warning message. */
  identify: string;
  fetchAndNormalize: () => Promise<TResult>;
  fallback: () => TResult;
};

/**
 * Runs a fetch-and-normalize step, warning with context and falling back to
 * stale data on any failure (HTTP error, network error, malformed response).
 */
export const fetchWithFallback = async <TResult>({
  label,
  identify,
  fetchAndNormalize,
  fallback,
}: FetchWithFallbackOptions<TResult>): Promise<TResult> => {
  try {
    return await fetchAndNormalize();
  } catch (error) {
    console.warn(
      `[${label}] fetch failed for ${identify}, using stale fallback: ${describeError(error)}`,
    );
    return fallback();
  }
};
