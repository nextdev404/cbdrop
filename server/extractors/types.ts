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

export type ExtractedMedia = {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url: string; width?: number; height?: number; id?: string }>;
  webpageUrl?: string;
  platform?: string;
  formats: ExtractedFormat[];
};
