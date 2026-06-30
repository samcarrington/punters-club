export type PlaylistSource = {
  title: string;
  description?: string;
  url: string;
};

export type Playlist = PlaylistSource & {
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
};
