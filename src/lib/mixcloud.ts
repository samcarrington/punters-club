export type ShowSource = {
  title: string;
  url: string;
  description?: string;
  localDescription?: string;
};

export type Show = ShowSource & {
  key?: string;
  slug?: string;
  publishedAt?: string;
  durationSeconds?: number;
  playCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  tags?: Array<{ name: string; url?: string; key?: string }>;
  pictures?: Record<string, string>;
  artwork?: string;
  user?: { username?: string; name?: string; url?: string };
};

export const toApiUrl = (url: string) => url.replace('www.mixcloud.com', 'api.mixcloud.com');

export const widgetUrl = (showUrl: string) =>
  `https://www.mixcloud.com/widget/iframe/?mini=1&hide_cover=1&hide_tracklist=1&feed=${encodeURIComponent(showUrl)}`;

export const normalizeShow = (source: ShowSource, api?: Record<string, unknown>): Show => {
  const show = api ?? {};
  const pictures = typeof show.pictures === 'object' && show.pictures ? (show.pictures as Record<string, string>) : undefined;
  const artwork =
    pictures?.large ??
    pictures?.['320wx320h'] ??
    pictures?.medium ??
    pictures?.thumbnail ??
    (typeof show.picture_url === 'string' ? show.picture_url : undefined);

  const tags = Array.isArray(show.tags)
    ? show.tags
        .map((tag) => {
          if (typeof tag === 'string') return { name: tag };
          if (!tag || typeof tag !== 'object') return null;
          const tagRecord = tag as Record<string, unknown>;
          const name = typeof tagRecord.name === 'string' ? tagRecord.name : undefined;
          if (!name) return null;
          return {
            name,
            url: typeof tagRecord.url === 'string' ? tagRecord.url : undefined,
            key: typeof tagRecord.key === 'string' ? tagRecord.key : undefined,
          };
        })
        .filter((tag): tag is { name: string; url?: string; key?: string } => tag !== null)
    : undefined;

  return {
    ...source,
    title: (show.name as string | undefined) ?? source.title,
    url: (show.url as string | undefined) ?? source.url,
    description: source.localDescription ?? source.description ?? (show.description as string | undefined),
    key: typeof show.key === 'string' ? show.key : undefined,
    slug: typeof show.slug === 'string' ? show.slug : undefined,
    publishedAt:
      typeof show.published_time === 'string'
        ? show.published_time
        : typeof show.created_time === 'string'
          ? show.created_time
          : undefined,
    durationSeconds:
      typeof show.audio_length === 'number'
        ? show.audio_length
        : typeof show.duration === 'number'
          ? show.duration
          : undefined,
    playCount: typeof show.play_count === 'number' ? show.play_count : undefined,
    favoriteCount: typeof show.favorite_count === 'number' ? show.favorite_count : undefined,
    commentCount: typeof show.comment_count === 'number' ? show.comment_count : undefined,
    tags,
    pictures,
    artwork,
    user: typeof show.user === 'object' && show.user ? (show.user as Show['user']) : undefined,
  };
};
