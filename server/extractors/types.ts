export type ExtractedFormat = {
  id: string;
  url: string;
  ext: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  tbr?: number;
  vcodec?: string;
  acodec?: string;
  protocol?: string;
  formatNote?: string;
  httpHeaders?: Record<string, string>;
};

export type PlaylistItem = {
  id: string;
  title: string;
  url: string;
  duration?: string;
  thumbnailUrl?: string;
};

export type ExtractedMedia = {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number; id?: string }>;
  webpageUrl?: string;
  platform?: string;
  isPlaylist?: boolean;
  playlistItems?: PlaylistItem[];
  formats: ExtractedFormat[];
};
