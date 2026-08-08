/**
 * Shared shape for provider normalizers (Mixcloud shows, Spotify/Tidal
 * playlists): take a hand-authored source record plus optional data fetched
 * from that provider, and return the fully-populated domain type. `TApiData`
 * varies per provider - a raw API response record, a scraped value, etc. -
 * since each provider surfaces enrichment data differently.
 */
export type Normalizer<TSource, TApiData, TResult> = (
  source: TSource,
  apiData?: TApiData,
) => TResult;
