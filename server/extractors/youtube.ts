import type { ExtractedFormat, ExtractedMedia } from "./types";
import { canonicalizeUrl } from "./ytdlp";

interface YtUltraMediaItem {
  url: string;
  format?: string | null;
  fileSize?: number | null;
  quality?: string | null;
}

interface YtUltraResponse {
  code: string;
  msg?: string;
  data?: {
    title?: string;
    imageUrl?: string;
    duration?: string | number;
    medias?: YtUltraMediaItem[];
    images?: Array<{ url: string }>;
  };
}

export async function extractYouTubeWithYtUltra(youtubeUrl: string): Promise<ExtractedMedia | null> {
  try {
    const canonicalUrl = canonicalizeUrl(youtubeUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch("https://api.ytultra.com/ikool/youtube/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ url: canonicalUrl }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resp.ok) return null;
    const json = (await resp.json()) as YtUltraResponse;
    if (json.code !== "0000" || !json.data || !Array.isArray(json.data.medias) || json.data.medias.length === 0) {
      return null;
    }

    const { title, imageUrl, duration, medias } = json.data;

    let videoId = "";
    try {
      const u = new URL(youtubeUrl);
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1).split("?")[0];
      } else {
        videoId = u.searchParams.get("v") || u.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/)?.[1] || "";
      }
    } catch {}

    const formats: ExtractedFormat[] = [];
    const seenFormatIds = new Set<string>();

    for (const m of medias) {
      if (!m.url) continue;
      const fmtStr = m.format || "";
      const isAudio =
        /\[\.(?:m4a|mp3|weba)\]/i.test(fmtStr) ||
        /audio/i.test(fmtStr) ||
        m.url.includes("mime=audio");

      const isWebm = fmtStr.includes(".webm") || m.url.includes("mime=video%2Fwebm");
      const isM4a = fmtStr.includes(".m4a") || m.url.includes("mime=audio%2Fmp4");
      const isWeba = fmtStr.includes(".weba") || m.url.includes("mime=audio%2Fwebm");

      let height: number | undefined;
      let width: number | undefined;

      if (!isAudio) {
        if (/4K/i.test(fmtStr) || m.url.includes("itag=313") || m.url.includes("itag=401")) {
          height = 2160;
          width = 3840;
        } else if (/2K/i.test(fmtStr) || m.url.includes("itag=271") || m.url.includes("itag=400")) {
          height = 1440;
          width = 2560;
        } else {
          const match = fmtStr.match(/(\d{3,4})p/i);
          if (match) {
            height = parseInt(match[1], 10);
            width = Math.round(height * (16 / 9));
          }
        }
      }

      const itagMatch = m.url.match(/[?&]itag=(\d+)/);
      let rawId = itagMatch ? itagMatch[1] : `${height || (isAudio ? "audio" : "video")}`;
      if (seenFormatIds.has(rawId)) {
        // e.g. multi-language audio or duplicate itags
        const langMatch = m.url.match(/lang%3D([a-z-]+)/i) || m.url.match(/lang=([a-z-]+)/i);
        rawId = `${rawId}-${langMatch ? langMatch[1] : formats.length + 1}`;
      }
      seenFormatIds.add(rawId);

      const formatNote = isAudio
        ? (isM4a ? "Audio track (M4A)" : "Audio track (Opus)")
        : height && height >= 2160
        ? "4K Ultra HD"
        : height && height >= 1440
        ? "2K Quad HD"
        : height && height >= 1080
        ? "Full HD"
        : height
        ? `${height}p`
        : "Video";

      formats.push({
        id: rawId,
        url: m.url,
        ext: isAudio ? (isM4a ? "m4a" : "weba") : (isWebm ? "webm" : "mp4"),
        width,
        height,
        filesize: m.fileSize || undefined,
        vcodec: isAudio ? "none" : (isWebm ? "vp9" : "avc1"),
        acodec: isAudio ? (isM4a ? "mp4a" : "opus") : "none",
        formatNote,
        httpHeaders: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://www.youtube.com/",
        },
      });
    }

    const thumbnails: Array<{ url: string; width?: number; height?: number; id?: string }> = [];
    if (imageUrl) {
      thumbnails.push({ id: "maxresdefault", url: imageUrl, width: 1920, height: 1080 });
    }
    if (videoId) {
      thumbnails.push({ id: "sddefault", url: `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`, width: 640, height: 480 });
      thumbnails.push({ id: "hqdefault", url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 });
    }

    const dur = duration
      ? typeof duration === "number"
        ? duration
        : parseInt(duration, 10)
      : undefined;

    return {
      id: videoId || "yt_video",
      title: title || "YouTube Video",
      duration: isNaN(dur as number) ? undefined : dur,
      thumbnail: imageUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : undefined),
      uploader: "YouTube Creator",
      platform: "YouTube",
      formats,
      thumbnails,
    };
  } catch (err) {
    console.warn("[extractYouTubeWithYtUltra] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}
