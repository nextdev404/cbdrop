import { createHash, randomBytes } from "node:crypto";

const nanoid = (len = 10) => randomBytes(Math.ceil(len * 0.75)).toString("base64url").slice(0, len);
import { detectExtractorPlatform, extractWithYtDlp, parseFacebookHtml, isInstagramHtml, parseInstagramHtml } from "../extractors/ytdlp";
import { extractYouTubeWithYtUltra } from "../extractors/youtube";
import type { ExtractedMedia, ExtractedFormat } from "../extractors/types";
import { createDownloadProxyUrl, createZipDownloadUrl } from "./downloadProxy";

export type MediaFormat = {
  id: string;
  container: string;
  quality: string;
  type: "video" | "audio" | "image";
  available: boolean;
  size: string;
  filesize?: number;
  note: string;
  downloadUrl?: string;
  httpHeaders?: Record<string, string>;
  /** Secondary audio-only URL to merge with video using ffmpeg */
  audioUrl?: string;
  audioHeaders?: Record<string, string>;
};

export type MediaAnalysis = {
  id: string;
  platform: string;
  title: string;
  creator: string;
  duration: string;
  thumbnailUrl?: string;
  source: "approved-provider" | "extractor" | "demo";
  ready: boolean;
  formats: MediaFormat[];
};

export type DownloadJob = {
  jobId: string;
  status: "queued" | "processing" | "completed";
  filename: string;
  downloadUrl?: string;
  expiresAt?: string;
};

type CloudflareVideo = {
  uid: string;
  readyToStream?: boolean;
  thumbnail?: string;
  duration?: number;
  size?: number;
  meta?: Record<string, string>;
  status?: { state?: string; pctComplete?: number; errorReasonText?: string };
  input?: { width?: number; height?: number };
  playback?: { hls?: string; dash?: string };
};

type CloudflareDownload = { status?: "inprogress" | "ready" | "error"; url?: string; percentComplete?: number };
type CloudflareDownloads = { default?: CloudflareDownload; audio?: CloudflareDownload };

const supportedHosts = new Map<string, string>([
  ["youtube.com", "YouTube"], ["youtu.be", "YouTube"],
  ["tiktok.com", "TikTok"],
  ["facebook.com", "Facebook"], ["fb.watch", "Facebook"], ["fb.com", "Facebook"],
  ["instagram.com", "Instagram"], ["instagr.am", "Instagram"],
  ["snapchat.com", "Snapchat"],
  ["x.com", "X"], ["twitter.com", "X"], ["t.co", "X"],
]);

const analysisCache = new Map<string, { media: MediaAnalysis; timestamp: number }>();

export function cacheMedia(media: MediaAnalysis) {
  const now = Date.now();
  for (const [key, value] of analysisCache.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) analysisCache.delete(key);
  }
  analysisCache.set(media.id, { media, timestamp: now });
}

function cloudflareConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  return accountId && apiToken ? { accountId, apiToken } : null;
}

async function cloudflareRequest<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const config = cloudflareConfig();
  if (!config) throw new Error("Cloudflare Stream is not configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in project secrets.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream${path}`, {
      method,
      headers: { authorization: `Bearer ${config.apiToken}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json() as { success?: boolean; result?: T; errors?: Array<{ message?: string }> };
    if (!response.ok || payload.success === false || payload.result === undefined) throw new Error(payload.errors?.map((item) => item.message).filter(Boolean).join("; ") || `Cloudflare Stream returned ${response.status}.`);
    return payload.result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Cloudflare Stream timed out. Please try again.");
    throw error;
  } finally { clearTimeout(timeout); }
}

function getPlatform(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  for (const [supportedHost, platform] of Array.from(supportedHosts.entries())) if (host === supportedHost || host.endsWith(`.${supportedHost}`)) return platform;
  return null;
}

export function isFacebookHtml(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  const s = content.trim();
  const lower = s.toLowerCase();
  if (
    lower.startsWith("<") ||
    lower.startsWith("view-source:") ||
    lower.includes("playable_url") ||
    lower.includes("viewer_image") ||
    lower.includes("photo_image") ||
    lower.includes("unified_stories")
  ) {
    return (
      lower.includes("facebook") ||
      lower.includes("fbcdn.net") ||
      lower.includes("fbsbx.com") ||
      lower.includes("playable_url") ||
      lower.includes("viewer_image") ||
      lower.includes("photo_image") ||
      lower.includes("unified_stories")
    );
  }
  return false;
}

export function detectPlatform(sourceUrl: string) {
  if (!sourceUrl || typeof sourceUrl !== "string") return null;
  if (isFacebookHtml(sourceUrl)) return "Facebook";
  if (isInstagramHtml(sourceUrl)) return "Instagram";
  let cleanUrl = sourceUrl.trim();
  if (cleanUrl.toLowerCase().startsWith("view-source:")) {
    cleanUrl = cleanUrl.replace(/^view-source:\s*/i, "").trim();
  }
  try {
    const parsed = new URL(cleanUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const platform = getPlatform(parsed.hostname);
    if (platform) return platform;
    if (/\.(mp4|mov|m4v|webm|mkv)(?:$|\?)/i.test(parsed.pathname)) return "Direct video";
    if (/\.(jpg|jpeg|png|webp|gif)(?:$|\?)/i.test(parsed.pathname)) return "Direct image";
    return null;
  } catch { return null; }
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function isDirectVideoUrl(sourceUrl: string) {
  try { return /^https:\/\//i.test(sourceUrl) && /\.(mp4|mov|m4v|webm|mkv)(?:$|\?)/i.test(new URL(sourceUrl).pathname); }
  catch { return false; }
}

function directMedia(sourceUrl: string): MediaAnalysis {
  const parsed = new URL(sourceUrl);
  const extension = (parsed.pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "mp4").toLowerCase();
  const container = extension === "m4v" ? "mp4" : extension;
  const title = decodeURIComponent(parsed.pathname.split("/").pop() || "authorized-video").replace(/\.[a-z0-9]+$/i, "") || "Authorized video";
  const id = `direct_${createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24)}`;
  return { id, platform: "Direct video", title, creator: "Authorized source", duration: "—", source: "approved-provider", ready: true, formats: [{ id: "direct-video", container, quality: "source", type: "video", available: true, size: "Direct file", note: "Original authorized file", downloadUrl: sourceUrl }] };
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "Size varies";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDirectImageUrl(sourceUrl: string) {
  try { return /^https:\/\//i.test(sourceUrl) && /\.(jpg|jpeg|png|webp|gif)(?:$|\?)/i.test(new URL(sourceUrl).pathname); }
  catch { return false; }
}

function directImageMedia(sourceUrl: string): MediaAnalysis {
  const parsed = new URL(sourceUrl);
  const extension = (parsed.pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "jpg").toLowerCase();
  const container = extension === "jpeg" ? "jpg" : extension;
  const title = decodeURIComponent(parsed.pathname.split("/").pop() || "image").replace(/\.[a-z0-9]+$/i, "") || "Image";
  const id = `direct_${createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24)}`;
  return { id, platform: "Direct image", title, creator: "Authorized source", duration: "—", source: "approved-provider", ready: true, thumbnailUrl: sourceUrl, formats: [{ id: "direct-image", container, quality: "original", type: "image", available: true, size: "Direct file", note: "Original image file", downloadUrl: sourceUrl }] };
}

function resolveFormatHeaders(url?: string, existing?: Record<string, string>, platform?: string): Record<string, string> | undefined {
  const headers: Record<string, string> = { ...existing };
  const host = url ? (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })() : "";

  if (platform === "Snapchat" || host.includes("sc-cdn.net") || host.includes("snapchat.com")) {
    headers["Referer"] = "https://www.snapchat.com/";
    headers["Origin"] = "https://www.snapchat.com";
  } else if (platform === "Instagram" || host.includes("cdninstagram.com") || host.includes("instagram.com")) {
    headers["Referer"] = "https://www.instagram.com/";
  } else if (platform === "Facebook" || host.includes("fbcdn.net") || host.includes("facebook.com") || host.includes("fbsbx.com")) {
    headers["Referer"] = "https://www.facebook.com/";
    if (host.includes("lookaside.fbsbx.com")) {
      headers["User-Agent"] = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
    }
  } else if (platform === "X" || host.includes("twimg.com") || host.includes("twitter.com") || host.includes("x.com")) {
    headers["Referer"] = "https://x.com/";
  } else if (platform === "TikTok" || host.includes("byteoversea.com") || host.includes("ibytedtos.com") || host.includes("tiktokcdn.com") || host.includes("tiktok.com")) {
    headers["Referer"] = headers["Referer"] || "https://www.tiktok.com/";
  } else if (platform === "YouTube" || host.includes("ytimg.com") || host.includes("googlevideo.com") || host.includes("ggpht.com") || host.includes("youtube.com")) {
    headers["Referer"] = "https://www.youtube.com/";
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

export function extractedToMedia(sourceUrl: string, extracted: ExtractedMedia): MediaAnalysis {
  const platform = detectExtractorPlatform(sourceUrl) || extracted.platform || "Social video";

  // Separate progressive (audio+video in single file), video-only, audio-only, and manifests
  const validFormats = extracted.formats.filter((f) => f.url && f.ext);

  const isImageFormat = (f: { vcodec?: string; acodec?: string; ext?: string }) => {
    const ext = (f.ext || "").toLowerCase();
    if (!IMAGE_EXTS.has(ext)) return false;
    return f.vcodec === "none" || (!f.vcodec && !f.acodec);
  };

  const isStoryboard = (f: { ext?: string; id?: string; formatNote?: string }) => {
    const ext = (f.ext || "").toLowerCase();
    if (ext === "mhtml") return true;
    if (f.id && /^sb\d+/i.test(f.id)) return true;
    if (f.formatNote && /storyboard/i.test(f.formatNote)) return true;
    return false;
  };

  const extractedImageFormats = validFormats.filter(f => isImageFormat(f) && !isStoryboard(f));
  const mediaStreamFormats = validFormats.filter((f) => !isImageFormat(f) && !isStoryboard(f));

  const AUDIO_EXTS = new Set(["m4a", "mp3", "wav", "aac", "opus", "oga", "ogg", "flac", "weba", "m4b"]);
  const isAudioStream = (f: { ext?: string; vcodec?: string; acodec?: string; height?: number; width?: number }) => {
    const ext = (f.ext || "").toLowerCase();
    if (AUDIO_EXTS.has(ext)) return true;
    if (f.vcodec === "none") return true;
    if (f.acodec && !f.vcodec && !f.height && !f.width) return true;
    return false;
  };

  const progressive = mediaStreamFormats.filter((f) => {
    if (f.protocol && (f.protocol.startsWith("m3u8") || f.protocol.startsWith("http_dash"))) return false;
    if (isAudioStream(f)) return false;
    const hasV = !f.vcodec || f.vcodec !== "none";
    const hasA = !f.acodec || f.acodec !== "none";
    return hasV && hasA;
  });

  const videoOnly = mediaStreamFormats.filter((f) => {
    if (f.protocol && (f.protocol.startsWith("m3u8") || f.protocol.startsWith("http_dash"))) return false;
    if (isAudioStream(f)) return false;
    const hasV = f.vcodec && f.vcodec !== "none";
    const hasA = f.acodec === "none";
    return hasV && hasA;
  });

  const audioOnly = mediaStreamFormats.filter((f) => {
    if (f.protocol && (f.protocol.startsWith("m3u8") || f.protocol.startsWith("http_dash"))) return false;
    return isAudioStream(f);
  });

  const manifestVideo = mediaStreamFormats.filter((f) => {
    const isManifest = f.protocol && (f.protocol.startsWith("m3u8") || f.protocol.startsWith("http_dash"));
    return isManifest && !isAudioStream(f) && (!f.vcodec || f.vcodec !== "none");
  });

  // Best audio stream to pair with video (prefer original non-dubbed m4a/aac for widest compatibility)
  const bestAudio = [...audioOnly].sort((a, b) => {
    // Deprioritize dubbed/translated audio (formatNote often has language names)
    const aIsDubbed = /dubbed|auto-translated|\b(de|fr|es|it|pt|ru|ko|ja|zh|ar)\b/i.test(a.formatNote || "") ? -1 : 0;
    const bIsDubbed = /dubbed|auto-translated|\b(de|fr|es|it|pt|ru|ko|ja|zh|ar)\b/i.test(b.formatNote || "") ? -1 : 0;
    if (aIsDubbed !== bIsDubbed) return bIsDubbed - aIsDubbed;
    // Prefer m4a/aac
    const aIsAac = (a.acodec || "").includes("mp4a") || a.ext === "m4a" ? 1 : 0;
    const bIsAac = (b.acodec || "").includes("mp4a") || b.ext === "m4a" ? 1 : 0;
    return bIsAac - aIsAac || (b.tbr || 0) - (a.tbr || 0);
  })[0];

  const formats: MediaFormat[] = [];
  const seenVideoHeights = new Set<number>();

  // 1. Adaptive video streams (Full HD 1080p, HD 720p, 4K, 2K, 480p, etc.)
  if (videoOnly.length > 0) {
    const sorted = [...videoOnly].sort((a, b) => {
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      const getCodecScore = (f: ExtractedFormat) => {
        const v = (f.vcodec || "").toLowerCase();
        const ext = (f.ext || "").toLowerCase();
        if (ext === "mp4" || v.startsWith("avc") || v.startsWith("h264")) return 3;
        if (v.startsWith("vp9") || v.startsWith("vp09")) return 2;
        if (v.startsWith("av01") || v.startsWith("av1")) return 1;
        return 0;
      };
      const scoreDiff = getCodecScore(b) - getCodecScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return (b.tbr || 0) - (a.tbr || 0);
    });

    for (const f of sorted) {
      const h = f.height || 0;
      if (h > 0 && seenVideoHeights.has(h)) continue;
      if (h > 0) seenVideoHeights.add(h);

      const videoBits = f.tbr && extracted.duration ? Math.round((f.tbr * 1000 / 8) * extracted.duration) : undefined;
      const audioBits = bestAudio ? (bestAudio.filesize || (bestAudio.tbr && extracted.duration ? Math.round((bestAudio.tbr * 1000 / 8) * extracted.duration) : undefined)) : undefined;
      const totalBytes = videoBits && audioBits ? videoBits + audioBits : f.filesize || videoBits;
      const container = f.ext || "mp4";
      let noteLabel = "HD video";
      if (h >= 2160) noteLabel = "4K Ultra HD";
      else if (h >= 1440) noteLabel = "2K Quad HD";
      else if (h >= 1080) noteLabel = "Full HD";
      else if (h >= 720) noteLabel = "HD video";
      else if (h > 0) noteLabel = `${h}p video`;

      // For 4K (2160p) and 2K (1440p) or webm, also offer direct resumable stream
      if (h >= 1440 || container === "webm" || !bestAudio) {
        formats.push({
          id: `extractor-${f.id}-direct`,
          container,
          quality: h ? `${h}p` : "source",
          type: "video",
          available: true,
          size: formatBytes(f.filesize || videoBits),
          filesize: f.filesize || videoBits,
          note: `${noteLabel} · direct (resumable)`,
          downloadUrl: f.url,
          httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
        });
      }

      // If format is WebM, also provide MP4 option for maximum device compatibility
      if (h >= 1440 && container === "webm") {
        formats.push({
          id: `extractor-${f.id}-mp4`,
          container: "mp4",
          quality: h ? `${h}p` : "source",
          type: "video",
          available: true,
          size: formatBytes(totalBytes),
          filesize: totalBytes,
          note: `${noteLabel} · MP4`,
          downloadUrl: f.url,
          httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
          audioUrl: bestAudio?.url,
          audioHeaders: resolveFormatHeaders(bestAudio?.url, bestAudio?.httpHeaders, platform),
        });
      }

      formats.push({
        id: `extractor-${f.id}`,
        container,
        quality: h ? `${h}p` : "source",
        type: "video",
        available: true,
        size: formatBytes(totalBytes),
        filesize: totalBytes,
        note: bestAudio ? `${noteLabel} · merged` : `${noteLabel} · direct`,
        downloadUrl: f.url,
        httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
        audioUrl: bestAudio?.url,
        audioHeaders: resolveFormatHeaders(bestAudio?.url, bestAudio?.httpHeaders, platform),
      });
      if (formats.filter(f => f.type === "video").length >= 8) break;
    }
  }

  // 2. Progressive formats (e.g. 360p direct, or standalone video+audio files)
  if (progressive.length > 0) {
    const sorted = [...progressive].sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
    for (const f of sorted) {
      const h = f.height || 0;
      if (h > 0 && seenVideoHeights.has(h) && formats.filter(f => f.type === "video").length >= 4) continue;
      if (h > 0) seenVideoHeights.add(h);

      const bytes = f.filesize || (f.tbr && extracted.duration ? Math.round((f.tbr * 1000 / 8) * extracted.duration) : undefined);
      formats.push({
        id: `extractor-${f.id}`,
        container: f.ext || "mp4",
        quality: f.height ? `${f.height}p` : "source",
        type: "video",
        available: true,
        size: formatBytes(bytes),
        filesize: bytes,
        note: `${f.formatNote || "Video"} · direct`,
        downloadUrl: f.url,
        httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, extracted.platform),
      });
      if (formats.filter(f => f.type === "video").length >= 10) break;
    }
  }

  // 3. Fallback to HLS/DASH manifest streams if no direct streams found
  if (formats.filter(f => f.type === "video").length === 0 && manifestVideo.length > 0) {
    // HLS/DASH fallback
    const sorted = [...manifestVideo].sort((a, b) => (b.height || 0) - (a.height || 0)).slice(0, 3);
    for (const f of sorted) {
      const isM3u8 = f.protocol?.startsWith("m3u8") || f.ext === "m3u8";
      const container = isM3u8 ? "hls" : "dash";
      const bytes = f.tbr && extracted.duration ? Math.round((f.tbr * 1000 / 8) * extracted.duration) : undefined;
      formats.push({
        id: `extractor-${f.id}`,
        container,
        quality: f.height ? `${f.height}p` : "adaptive",
        type: "video",
        available: true,
        size: formatBytes(bytes),
        filesize: bytes,
        note: `${f.formatNote || "Adaptive stream"} · stream`,
        downloadUrl: f.url,
        httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
      });
    }
  }

  // Fallback: if no video formats were collected yet, add any valid non-audio video formats directly
  const hasVideoFormat = formats.some((f) => f.type === "video");
  if (!hasVideoFormat && mediaStreamFormats.length > 0) {
    const candidateFormats = mediaStreamFormats.filter((f) => !isAudioStream(f));
    if (candidateFormats.length > 0) {
      for (const f of candidateFormats.slice(0, 5)) {
        const bytes = f.filesize || (f.tbr && extracted.duration ? Math.round((f.tbr * 1000 / 8) * extracted.duration) : undefined);
        formats.push({
          id: `extractor-${f.id}`,
          container: f.ext || "mp4",
          quality: f.height ? `${f.height}p` : "HD",
          type: "video",
          available: true,
          size: formatBytes(bytes),
          filesize: bytes || f.filesize,
          note: `${f.formatNote || "Direct video"} · direct`,
          downloadUrl: f.url,
          httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
        });
      }
    }
  }

  // Best audio-only options
  if (audioOnly.length > 0) {
    const sortedAudio = [...audioOnly].sort((a, b) => {
      const aIsM4a = (a.ext || "").toLowerCase() === "m4a" || (a.acodec || "").includes("mp4a") ? 1 : 0;
      const bIsM4a = (b.ext || "").toLowerCase() === "m4a" || (b.acodec || "").includes("mp4a") ? 1 : 0;
      if (aIsM4a !== bIsM4a) return bIsM4a - aIsM4a;
      return (b.tbr || 0) - (a.tbr || 0);
    });

    const topAudio = sortedAudio.slice(0, 2);
    for (const f of topAudio) {
      const bytes = f.filesize || (f.tbr && extracted.duration ? Math.round((f.tbr * 1000 / 8) * extracted.duration) : undefined);
      const rawExt = (f.ext || "m4a").toLowerCase();
      const container = rawExt === "webm" ? "weba" : rawExt;
      formats.push({
        id: `extractor-${f.id}`,
        container,
        quality: "audio",
        type: "audio",
        available: true,
        size: formatBytes(bytes),
        filesize: bytes || f.filesize,
        note: `${f.formatNote || "Audio track"} · direct`,
        downloadUrl: f.url,
        httpHeaders: f.httpHeaders,
      });
    }
  }

  // Image formats: direct photos and high-resolution cover images/thumbnails
  const getSlideIndex = (id: string, note?: string) => {
    const combined = `${id} ${note || ""}`;
    const m = combined.match(/(?:photo|item|slide|image|img|pic)[^\d]*(\d+)/i)
      || combined.match(/(?:^|[-_#])(\d+)(?:[^\d]|$)/);
    return m ? parseInt(m[1], 10) : 9999;
  };

  const getFormatScore = (f: ExtractedFormat): number => {
    const pixels = (f.width || 0) * (f.height || 0);
    if (pixels > 0) return pixels;
    if (f.filesize && f.filesize > 0) return f.filesize;
    if (f.tbr && f.tbr > 0) return f.tbr;
    const text = `${f.id} ${f.formatNote || ""}`.toLowerCase();
    if (text.includes("orig")) return 1000;
    if (text.includes("large") || text.includes("high")) return 500;
    if (text.includes("medium")) return 200;
    if (text.includes("small") || text.includes("thumb")) return 50;
    return 100;
  };

  const getThumbnailScore = (t: { url: string; width?: number; height?: number; id?: string }) => {
    let score = (t.width || 0) * (t.height || 0);
    const u = (t.url || "").toLowerCase();
    const id = (t.id || "").toLowerCase();
    if (u.includes("maxresdefault") || id.includes("maxres")) return Math.max(score, 1920 * 1080);
    if (u.includes("sddefault") || id.includes("sddefault")) return Math.max(score, 640 * 480);
    if (u.includes("hqdefault") || id.includes("hqdefault")) return Math.max(score, 480 * 360);
    if (u.includes("mqdefault") || id.includes("mqdefault")) return Math.max(score, 320 * 180);
    if (u.includes(":orig") || u.includes("name=orig")) return Math.max(score, 2048 * 2048);
    if (u.includes("name=large") || u.includes(":large")) return Math.max(score, 1200 * 1200);
    return score;
  };

  const getImageGroupKey = (f: ExtractedFormat): string => {
    const slideNum = getSlideIndex(f.id, f.formatNote);
    if (slideNum < 9999) {
      return `slide-${slideNum}`;
    }
    try {
      const u = new URL(f.url);
      const SIZING_PARAMS = new Set(["name", "w", "h", "width", "height", "size", "quality", "q", "format", "ext"]);
      const cleanParams = new URLSearchParams();
      for (const [k, v] of u.searchParams.entries()) {
        if (!SIZING_PARAMS.has(k.toLowerCase())) {
          cleanParams.append(k, v);
        }
      }
      const search = cleanParams.toString() ? `?${cleanParams.toString()}` : "";
      return `url-${u.origin}${u.pathname}${search}`;
    } catch {
      return `url-${f.url.split("?")[0]}`;
    }
  };

  // Group formats by photo item, selecting the highest-resolution format for each
  const groupedImages = new Map<string, ExtractedFormat>();
  for (const f of extractedImageFormats) {
    if (!f.url) continue;
    const key = getImageGroupKey(f);
    const existing = groupedImages.get(key);
    if (!existing) {
      groupedImages.set(key, f);
    } else {
      if (getFormatScore(f) > getFormatScore(existing)) {
        groupedImages.set(key, f);
      }
    }
  }

  // Sort unique photo items in slide / carousel order
  const sortedImageFormats = Array.from(groupedImages.values()).sort((a, b) => {
    const slideA = getSlideIndex(a.id, a.formatNote);
    const slideB = getSlideIndex(b.id, b.formatNote);
    if (slideA !== slideB) return slideA - slideB;
    return 0;
  });

  const seenImageUrls = new Set<string>();
  const seenFormatIds = new Set<string>();
  for (const [idx, f] of sortedImageFormats.entries()) {
    if (!f.url || seenImageUrls.has(f.url)) continue;
    seenImageUrls.add(f.url);
    const ext = f.ext === "jpeg" ? "jpg" : f.ext;
    const quality = f.width && f.height ? `${f.width}x${f.height}` : "HD";
    const displayNum = idx + 1;
    let formatId = `extractor-${f.id}`;
    if (seenFormatIds.has(formatId)) {
      formatId = `${formatId}-${displayNum}`;
    }
    seenFormatIds.add(formatId);
    formats.push({
      id: formatId,
      container: ext,
      quality,
      type: "image",
      available: true,
      size: "Image",
      note: `${sortedImageFormats.length > 1 ? `Photo ${displayNum}` : "Photo"} · direct`,
      downloadUrl: f.url,
      httpHeaders: resolveFormatHeaders(f.url, f.httpHeaders, platform),
    });
  }

  if (extracted.thumbnails && extracted.thumbnails.length > 0) {
    const validThumbnails = extracted.thumbnails
      .filter((t) => t.url && t.url.startsWith("http") && !seenImageUrls.has(t.url));

    const isPhotoPost = formats.filter((f) => f.type === "video").length === 0;

    if (isPhotoPost) {
      const existingImageFormats = formats.filter((f) => f.type === "image");
      // If we don't have direct photo formats yet, fall back to thumbnails
      if (existingImageFormats.length === 0) {
        const isMultiItem = validThumbnails.some((t) => t.id && /^(?:item|photo|slide)/i.test(t.id));
        if (isMultiItem) {
          // Group thumbnails by item (e.g. item-1, item-2) and pick highest resolution for each
          const itemMap = new Map<string, (typeof validThumbnails)[0]>();
          for (const t of validThumbnails) {
            const m = t.id?.match(/^(?:item|photo|slide)[-_]?(\d+)/i);
            const key = m ? `item-${m[1]}` : (t.id || t.url);
            const current = itemMap.get(key);
            if (!current) {
              itemMap.set(key, t);
            } else {
              const currentRes = (current.width || 0) * (current.height || 0);
              const newRes = (t.width || 0) * (t.height || 0);
              if (newRes > currentRes) {
                itemMap.set(key, t);
              }
            }
          }

          const sortedThumbnails = Array.from(itemMap.values()).sort((a, b) => {
            const getIndex = (id?: string) => {
              const m = id?.match(/(?:item|photo|slide)[^\d]*(\d+)/i);
              return m ? parseInt(m[1], 10) : 9999;
            };
            return getIndex(a.id) - getIndex(b.id);
          });

          for (const [idx, t] of sortedThumbnails.entries()) {
            if (seenImageUrls.has(t.url)) continue;
            seenImageUrls.add(t.url);
            const ext = (t.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
            const container = ext === "jpeg" ? "jpg" : (IMAGE_EXTS.has(ext) ? ext : "jpg");
            const quality = t.width && t.height ? `${t.width}x${t.height}` : "HD";
            const label = sortedThumbnails.length > 1 ? `Photo ${idx + 1}` : "Photo";
            formats.push({
              id: `extractor-img-${t.id || idx + 1}`,
              container,
              quality,
              type: "image",
              available: true,
              size: "Image",
              note: `${label} · direct`,
              downloadUrl: t.url,
              httpHeaders: resolveFormatHeaders(t.url, undefined, platform),
            });
          }
        } else {
          // Single photo post with multiple thumbnail sizes: pick the single highest resolution
          const best = [...validThumbnails].sort((a, b) => getThumbnailScore(b) - getThumbnailScore(a))[0];
          if (best && !seenImageUrls.has(best.url)) {
            seenImageUrls.add(best.url);
            const ext = (best.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
            const container = ext === "jpeg" ? "jpg" : (IMAGE_EXTS.has(ext) ? ext : "jpg");
            let quality = best.width && best.height ? `${best.width}x${best.height}` : "HD";
            if (quality === "HD" && (best.url.includes("maxresdefault") || best.id === "maxresdefault")) {
              quality = "1920x1080";
            }
            formats.push({
              id: "extractor-img-1",
              container,
              quality,
              type: "image",
              available: true,
              size: "Image",
              note: "Photo · direct",
              downloadUrl: best.url,
              httpHeaders: resolveFormatHeaders(best.url, undefined, platform),
            });
          }
        }
      }
    } else {
      // For video posts: include top 2 highest resolution cover images/thumbnails
      const sorted = [...validThumbnails]
        .sort((a, b) => getThumbnailScore(b) - getThumbnailScore(a));
      const seenDims = new Set<string>();
      for (const t of sorted) {
        let quality = t.width && t.height ? `${t.width}x${t.height}` : "HD";
        if (quality === "HD" && (t.url.includes("maxresdefault") || t.id === "maxresdefault")) {
          quality = "1920x1080";
        }
        const key = `${quality}-${t.url.split("?")[0]}`;
        if (seenDims.has(key)) continue;
        seenDims.add(key);
        seenImageUrls.add(t.url);
        const ext = (t.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || "jpg").toLowerCase();
        const container = ext === "jpeg" ? "jpg" : (IMAGE_EXTS.has(ext) ? ext : "jpg");
        formats.push({
          id: `extractor-img-${t.id || seenDims.size}`,
          container,
          quality,
          type: "image",
          available: true,
          size: "Image",
          note: `${quality !== "HD" ? quality + " " : ""}Cover image · direct`,
          downloadUrl: t.url,
          httpHeaders: resolveFormatHeaders(t.url, undefined, platform),
        });
        if (seenDims.size >= 2) break;
      }
    }
  }

  if (!formats.length) throw new Error("We couldn't extract downloadable media from this post. Check that it is public and the URL is correct.");
  const proxyThumbnailUrl = extracted.thumbnail
    ? `/api/thumbnail-proxy?url=${encodeURIComponent(extracted.thumbnail)}`
    : undefined;

  return {
    id: `extractor_${extracted.id}`,
    platform,
    title: extracted.title,
    creator: extracted.uploader || "Public post",
    duration: formatDuration(extracted.duration),
    thumbnailUrl: proxyThumbnailUrl,
    source: "extractor",
    ready: true,
    formats,
  };
}


function cloudflareFormats(uid: string, downloads: CloudflareDownloads = {}, ready: boolean): MediaFormat[] {
  const mp4 = downloads.default;
  const audio = downloads.audio;
  const formats: MediaFormat[] = [
    { id: "mp4", container: "mp4", quality: "source", type: "video", available: ready, size: "Cloudflare Stream", note: ready ? "MP4 download" : "Available after processing", ...(mp4?.url && { downloadUrl: mp4.url }) },
    { id: "m4a", container: "m4a", quality: "audio", type: "audio", available: ready, size: "Cloudflare Stream", note: ready ? "M4A audio download" : "Available after processing", ...(audio?.url && { downloadUrl: audio.url }) },
  ];
  return formats;
}

function fromCloudflare(video: CloudflareVideo, downloads: CloudflareDownloads = {}): MediaAnalysis {
  const ready = Boolean(video.readyToStream && video.status?.state !== "error");
  const platform = video.meta?.platform || "Direct video";
  const title = video.meta?.name || `Cloudflare video ${video.uid.slice(0, 8)}`;
  return { id: `cf_${video.uid}`, platform, title, creator: video.meta?.creator || "Authorized source", duration: formatDuration(video.duration), thumbnailUrl: video.thumbnail, source: "approved-provider", ready, formats: cloudflareFormats(video.uid, downloads, ready) };
}

function demoMedia(sourceUrl: string): MediaAnalysis {
  const platform = getPlatform(new URL(sourceUrl).hostname) || "YouTube";
  return { id: `media_${platform.toLowerCase()}_demo`, platform, title: "A clean little moment on the internet", creator: "CBdrop demo source", duration: "02:18", source: "demo", ready: true, formats: [
    { id: "mp4-720", container: "mp4", quality: "720p", type: "video", available: true, size: "18.4 MB", note: "HD video · 30 fps" },
    { id: "mp4-480", container: "mp4", quality: "480p", type: "video", available: true, size: "10.2 MB", note: "Balanced · 30 fps" },
    { id: "audio", container: "mp3", quality: "audio", type: "audio", available: true, size: "3.8 MB", note: "Audio only · 128 kbps" },
  ] };
}

export async function resolveMedia(sourceUrl: string): Promise<MediaAnalysis> {
  const platform = detectPlatform(sourceUrl);
  if (!platform) {
    throw new Error("Unsupported or invalid URL. Use a supported platform (YouTube, TikTok, Facebook, Instagram, Snapchat, X) or a direct video/image URL.");
  }

  // Direct Facebook page source HTML extraction
  if (isFacebookHtml(sourceUrl)) {
    const rawHtml = sourceUrl.replace(/^view-source:\s*/i, "").trim();
    const extracted = parseFacebookHtml(rawHtml);
    if (!extracted || extracted.formats.length === 0) {
      throw new Error(
        "Could not find downloadable videos or photos in the provided Facebook page source. Ensure you copied the entire page source (Ctrl+A / Cmd+A) while viewing the story or post."
      );
    }
    const media = extractedToMedia("https://www.facebook.com/stories/", extracted);
    cacheMedia(media);
    return media;
  }

  // Direct Instagram page source HTML extraction
  if (isInstagramHtml(sourceUrl)) {
    const rawHtml = sourceUrl.replace(/^view-source:\s*/i, "").trim();
    const extracted = parseInstagramHtml(rawHtml);
    if (!extracted || extracted.formats.length === 0) {
      throw new Error(
        "Could not find downloadable videos or photos in the provided Instagram page source. Ensure you copied the entire page source (Ctrl+A / Cmd+A) while viewing the reel or post."
      );
    }
    const media = extractedToMedia("https://www.instagram.com/", extracted);
    cacheMedia(media);
    return media;
  }

  let cleanUrl = sourceUrl.trim();
  if (cleanUrl.toLowerCase().startsWith("view-source:")) {
    cleanUrl = cleanUrl.replace(/^view-source:\s*/i, "").trim();
  }

  if (cleanUrl.includes("cbdrop-demo")) {
    return demoMedia(cleanUrl);
  }
  if (isDirectImageUrl(cleanUrl)) {
    return directImageMedia(cleanUrl);
  }
  if (isDirectVideoUrl(cleanUrl)) {
    if (cloudflareConfig()) {
      const video = await cloudflareRequest<CloudflareVideo>("/copy", "POST", {
        url: cleanUrl,
        meta: { name: "CBdrop authorized media", source_url: cleanUrl, platform: "Direct video" },
      });
      return fromCloudflare(video);
    }
    return directMedia(cleanUrl);
  }

  // Social platform media extraction
  let extracted: ExtractedMedia | null = null;
  if (platform === "YouTube") {
    try {
      extracted = await extractYouTubeWithYtUltra(cleanUrl);
    } catch (ytUltraError) {
      console.warn("[resolveMedia] ytultra failed on YouTube, trying yt-dlp fallback:", ytUltraError);
    }
    if (!extracted || !extracted.formats.length) {
      extracted = await extractWithYtDlp(cleanUrl);
    }
  } else {
    extracted = await extractWithYtDlp(cleanUrl);
  }
  const media = extractedToMedia(cleanUrl, extracted);
  cacheMedia(media);
  return media;
}

export const analyzeMedia = resolveMedia;

export async function refreshMedia(mediaId: string): Promise<MediaAnalysis> {
  if (!mediaId.startsWith("cf_")) throw new Error("This media job cannot be refreshed.");
  const video = await cloudflareRequest<CloudflareVideo>(`/${mediaId.slice(3)}`, "GET");
  const downloads = video.readyToStream ? await cloudflareRequest<CloudflareDownloads>(`/${mediaId.slice(3)}/downloads`, "GET") : {};
  return fromCloudflare(video, downloads);
}

export async function prepareDownload(sourceUrl: string, mediaId: string, formatId: string): Promise<DownloadJob & { format: MediaFormat; media: MediaAnalysis }> {
  if (mediaId.startsWith("cf_")) {
    const media = await refreshMedia(mediaId);
    const format = media.formats.find((item) => item.id === formatId);
    if (!format) throw new Error("That format is not available yet. Wait for Cloudflare Stream to finish processing and try again.");
    const uid = mediaId.slice(3);
    const type = formatId === "m4a" ? "audio" : "default";
    const current = await cloudflareRequest<CloudflareDownloads>(`/${uid}/downloads`, "GET");
    let download = type === "audio" ? current.audio : current.default;
    if (!download || download.status === "error") download = await cloudflareRequest<CloudflareDownloads>(`/${uid}/downloads${type === "audio" ? "/audio" : ""}`, "POST").then((result) => type === "audio" ? result.audio : result.default);
    const url = download?.url;
    if (url && !url.startsWith("https://")) throw new Error("Cloudflare returned an unsafe download URL.");
    const ready = download?.status === "ready";
    const filename = `cbdrop-${uid.slice(0, 8)}.${format.container}`;
    const proxyUrl = ready && url ? createDownloadProxyUrl(url, filename, format.container) : undefined;
    return { jobId: `cf_${uid}_${formatId}`, status: ready ? "completed" : "processing", filename, downloadUrl: proxyUrl, format: { ...format, ...(proxyUrl && { downloadUrl: proxyUrl }) }, media, expiresAt: undefined };
  }
  if (mediaId.startsWith("extractor_")) {
    const cached = analysisCache.get(mediaId)?.media;
    const media = cached || (await resolveMedia(sourceUrl));
    const format = media.formats.find((item) => item.id === formatId && item.downloadUrl);
    if (!format?.downloadUrl) throw new Error("That extracted format is no longer available. Please analyze the post again.");
    let filename: string;
    if (format.type === "image") {
      const imageFormats = media.formats.filter((f) => f.type === "image");
      const imgIdx = imageFormats.findIndex((f) => f.id === formatId);
      const rawExt = (format.container === "jpeg" ? "jpg" : format.container) || "jpg";
      const ext = IMAGE_EXTS.has(rawExt) ? rawExt : "jpg";
      const isVideoPost = media.formats.some((f) => f.type === "video");
      if (isVideoPost) {
        filename = imgIdx > 0 ? `cover-${imgIdx + 1}.${ext}` : `cover.${ext}`;
      } else {
        filename = imageFormats.length > 1 && imgIdx >= 0
          ? `image-${imgIdx + 1}.${ext}`
          : `image.${ext}`;
      }
    } else {
      const ext = format.container === "jpeg" ? "jpg" : (format.container || "mp4");
      filename = `cbdrop-${nanoid(6)}.${ext}`;
    }
    const rawFormatId = format.id ? format.id.replace(/^extractor-/, "") : undefined;
    const effectiveContainer = format.type === "image" ? (format.container === "jpeg" ? "jpg" : (IMAGE_EXTS.has(format.container) ? format.container : "jpg")) : format.container;
    const proxyUrl = createDownloadProxyUrl(
      format.downloadUrl,
      filename,
      effectiveContainer,
      format.httpHeaders,
      format.audioUrl,
      format.audioHeaders,
      sourceUrl,
      rawFormatId,
      format.filesize
    );
    return { jobId: `job_${nanoid(10)}`, status: "completed", filename, downloadUrl: proxyUrl, format, media };
  }
  if (mediaId.startsWith("direct_")) {
    const media = isDirectImageUrl(sourceUrl) ? directImageMedia(sourceUrl) : directMedia(sourceUrl);
    if (media.id !== mediaId) throw new Error("This direct-file analysis expired. Please analyze the URL again.");
    const format = media.formats.find((item) => item.id === formatId);
    if (!format?.downloadUrl) throw new Error("That direct file is no longer available.");
    const filename = format.type === "image" ? `image.${format.container}` : `${media.title}.${format.container}`;
    const proxyUrl = createDownloadProxyUrl(
      format.downloadUrl,
      filename,
      format.container,
      undefined,
      undefined,
      undefined,
      sourceUrl,
      undefined,
      format.filesize
    );
    return { jobId: `job_${nanoid(10)}`, status: "completed", filename, downloadUrl: proxyUrl, format, media };
  }
  const media = await resolveMedia(sourceUrl);
  const format = media.formats.find((item) => item.id === formatId && item.available);
  if (!format) throw new Error("That format is no longer available. Please choose another format.");
  return { jobId: `job_${nanoid(10)}`, status: "completed", filename: `cbdrop-${format.quality}.${format.container}.txt`, format, media };
}

export async function refreshDownload(jobId: string, formatId: string): Promise<DownloadJob> {
  const parts = jobId.split("_");
  if (parts.length < 3 || parts[0] !== "cf") throw new Error("This download job cannot be refreshed.");
  const uid = parts[1];
  const current = await cloudflareRequest<CloudflareDownloads>(`/${uid}/downloads`, "GET");
  const download = formatId === "m4a" ? current.audio : current.default;
  const url = download?.url;
  if (url && !url.startsWith("https://")) throw new Error("Cloudflare returned an unsafe download URL.");
  const filename = `cbdrop-${uid.slice(0, 8)}.${formatId === "m4a" ? "m4a" : "mp4"}`;
  const ready = download?.status === "ready";
  return { jobId, status: ready ? "completed" : "processing", filename, downloadUrl: ready && url ? createDownloadProxyUrl(url, filename, formatId === "m4a" ? "m4a" : "mp4") : undefined };
}

export async function prepareZipDownload(
  sourceUrl: string,
  mediaId: string
): Promise<{ downloadUrl: string; filename: string; totalImages: number }> {
  let media: MediaAnalysis | undefined;
  if (mediaId.startsWith("extractor_")) {
    media = analysisCache.get(mediaId)?.media;
  }
  if (!media) {
    media = await resolveMedia(sourceUrl);
  }

  const imageFormats = media.formats.filter((f) => f.type === "image" && f.downloadUrl);
  if (imageFormats.length === 0) {
    throw new Error("No images found in this post to download.");
  }

  const imageItems = imageFormats.map((f, idx) => {
    const ext = f.container === "jpeg" ? "jpg" : f.container || "jpg";
    return {
      url: f.downloadUrl!,
      filename: `image-${idx + 1}.${ext}`,
      headers: f.httpHeaders,
    };
  });

  const safeTitle = (media.title || "cbdrop-images")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40)
    .replace(/^_+|_+$/g, "") || "cbdrop-images";
  const zipFilename = `${safeTitle}.zip`;
  const downloadUrl = createZipDownloadUrl(zipFilename, imageItems);

  return {
    downloadUrl,
    filename: zipFilename,
    totalImages: imageFormats.length,
  };
}

export function providerStatus() {
  const configured = Boolean(cloudflareConfig());
  return { configured, provider: "cloudflare-stream", providerBaseUrl: configured ? "https://api.cloudflare.com/client/v4" : null };
}
