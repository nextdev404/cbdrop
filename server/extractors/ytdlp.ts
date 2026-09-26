import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { ExtractedFormat, ExtractedMedia } from "./types";

const execFileAsync = promisify(execFile);
const SUPPORTED_HOSTS = new Map<string, string>([
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["tiktok.com", "TikTok"],
  ["facebook.com", "Facebook"],
  ["fb.watch", "Facebook"],
  ["fb.com", "Facebook"],
  ["instagram.com", "Instagram"],
  ["instagr.am", "Instagram"],
  ["snapchat.com", "Snapchat"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["t.co", "X"],
]);

export function detectExtractorPlatform(inputUrl: string) {
  try {
    const parsed = new URL(inputUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    for (const [host, platform] of Array.from(SUPPORTED_HOSTS.entries())) {
      if (hostname === host || hostname.endsWith(`.${host}`)) return platform;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeFormat(format: Record<string, unknown>, defaultHeaders?: Record<string, string>): ExtractedFormat | null {
  const url = typeof format.url === "string" ? format.url : "";
  let ext = typeof format.ext === "string" ? format.ext : "";
  if (!ext && url) {
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (match) ext = match[1].toLowerCase();
  }
  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  if (!ext) {
    const fid = String(format.format_id || "").toLowerCase();
    if (IMAGE_EXTS.has(fid) || fid.includes("photo") || fid.includes("thumb") || fid.includes("image") || (format.vcodec === "none" && !format.acodec)) {
      ext = "jpg";
    } else if (format.vcodec || format.height) {
      ext = "mp4";
    } else if (format.acodec) {
      ext = "m4a";
    } else {
      ext = "jpg";
    }
  }
  if (!url || !ext) return null;
  const headers =
    format.http_headers && typeof format.http_headers === "object"
      ? (format.http_headers as Record<string, string>)
      : defaultHeaders;
  const vcodec =
    typeof format.vcodec === "string"
      ? format.vcodec
      : IMAGE_EXTS.has(ext.toLowerCase())
        ? "none"
        : undefined;
  return {
    id: String(format.format_id || `${ext}-${format.height || "source"}`),
    url,
    ext,
    width: typeof format.width === "number" ? format.width : undefined,
    height: typeof format.height === "number" ? format.height : undefined,
    fps: typeof format.fps === "number" ? format.fps : undefined,
    filesize:
      typeof format.filesize === "number"
        ? format.filesize
        : typeof format.filesize_approx === "number"
          ? format.filesize_approx
          : undefined,
    tbr: typeof format.tbr === "number" ? format.tbr : undefined,
    vcodec,
    acodec: typeof format.acodec === "string" ? format.acodec : undefined,
    protocol: typeof format.protocol === "string" ? format.protocol : undefined,
    formatNote: typeof format.format_note === "string" ? format.format_note : undefined,
    httpHeaders: headers,
  };
}

export function normalizeYtDlpResult(raw: Record<string, unknown>): ExtractedMedia {
  const isSnapchat =
    raw.extractor_key === "SnapchatSpotlight" ||
    raw.extractor === "SnapchatSpotlight" ||
    (typeof raw.url === "string" && raw.url.includes("sc-cdn.net"));

  let defaultHeaders: Record<string, string> | undefined =
    raw.http_headers && typeof raw.http_headers === "object"
      ? (raw.http_headers as Record<string, string>)
      : undefined;

  if (isSnapchat) {
    defaultHeaders = {
      Referer: "https://www.snapchat.com/",
      Origin: "https://www.snapchat.com",
      ...defaultHeaders,
    };
  }

  const rawFormats = Array.isArray(raw.formats) ? raw.formats : [];
  const seenRootUrls = new Set<string>();
  const formats: ExtractedFormat[] = [];
  for (const format of rawFormats) {
    if (format && typeof format === "object") {
      const norm = normalizeFormat(format as Record<string, unknown>, defaultHeaders);
      if (norm && !seenRootUrls.has(norm.url)) {
        seenRootUrls.add(norm.url);
        formats.push(norm);
      }
    }
  }

  // If no formats were returned in raw.formats but raw.url exists (single direct format from extractors like Snapchat):
  if (formats.length === 0 && typeof raw.url === "string" && raw.url.startsWith("http")) {
    const singleFormat = normalizeFormat(
      {
        ...raw,
        format_id: raw.format_id || "direct-video",
        ext: raw.ext || raw.video_ext || "mp4",
      },
      defaultHeaders
    );
    if (singleFormat) formats.push(singleFormat);
  }

  // Normalize yt-dlp thumbnails array
  const thumbnails: Array<{ url: string; width?: number; height?: number; id?: string }> = [];
  if (Array.isArray(raw.thumbnails)) {
    for (const t of raw.thumbnails) {
      if (t && typeof t === "object" && typeof (t as Record<string, unknown>).url === "string") {
        const entry = t as Record<string, unknown>;
        thumbnails.push({
          url: entry.url as string,
          width: typeof entry.width === "number" ? entry.width : undefined,
          height: typeof entry.height === "number" ? entry.height : undefined,
          id: typeof entry.id === "string" ? entry.id : undefined,
        });
      }
    }
  }

  // Support playlist / multi-item posts (Instagram carousels, TikTok slideshows, Twitter multi-photo)
  const rawEntries = Array.isArray(raw.entries) ? (raw.entries as Record<string, unknown>[]) : [];
  if (rawEntries.length > 0) {
    const entryFormats: ExtractedFormat[] = [];
    const seenUrls = new Set<string>();

    for (const [idx, entry] of rawEntries.entries()) {
      if (!entry || typeof entry !== "object") continue;
      // Formats from entry
      if (Array.isArray(entry.formats)) {
        for (const f of entry.formats) {
          if (f && typeof f === "object") {
            const norm = normalizeFormat(f as Record<string, unknown>, defaultHeaders);
            if (norm && !seenUrls.has(norm.url)) {
              seenUrls.add(norm.url);
              entryFormats.push({
                ...norm,
                id: `${norm.id}-${idx + 1}`,
                formatNote: norm.formatNote ? `${norm.formatNote} · Item ${idx + 1}` : `Item ${idx + 1}`,
              });
            }
          }
        }
      } else if (typeof entry.url === "string" && (entry.url as string).startsWith("http")) {
        const detectedExt = ((entry.url as string).match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || "").toLowerCase();
        const ext = typeof entry.ext === "string" ? entry.ext : (detectedExt || "mp4");
        const norm = normalizeFormat(
          { ...entry, format_id: `item-${idx + 1}`, ext },
          defaultHeaders
        );
        if (norm && !seenUrls.has(norm.url)) {
          seenUrls.add(norm.url);
          entryFormats.push(norm);
        }
      }
      // Thumbnails / images from entry
      if (Array.isArray(entry.thumbnails)) {
        for (const t of entry.thumbnails) {
          if (t && typeof t === "object" && typeof (t as Record<string, unknown>).url === "string") {
            const te = t as Record<string, unknown>;
            thumbnails.push({
              url: te.url as string,
              width: typeof te.width === "number" ? te.width : undefined,
              height: typeof te.height === "number" ? te.height : undefined,
              id: `item-${idx + 1}-${te.id || "thumb"}`,
            });
          }
        }
      } else if (typeof entry.thumbnail === "string" && (entry.thumbnail as string).startsWith("http")) {
        thumbnails.push({
          url: entry.thumbnail as string,
          id: `item-${idx + 1}`,
        });
      }

      // If entry had no formats, extract photo format from entry's thumbnails
      if (!Array.isArray(entry.formats) || entry.formats.length === 0) {
        const rawThumbs = Array.isArray(entry.thumbnails) ? (entry.thumbnails as Record<string, unknown>[]) : [];
        const validThumbs = rawThumbs
          .filter((t) => t && typeof t === "object" && typeof t.url === "string")
          .sort((a, b) => ((Number(b.width) || 0) * (Number(b.height) || 0)) - ((Number(a.width) || 0) * (Number(a.height) || 0)));
        const thumbUrl = (validThumbs[0]?.url as string) || (typeof entry.thumbnail === "string" && (entry.thumbnail as string).startsWith("http") ? (entry.thumbnail as string) : null);
        if (thumbUrl && !seenUrls.has(thumbUrl)) {
          seenUrls.add(thumbUrl);
          entryFormats.push({
            id: `photo-${idx + 1}`,
            url: thumbUrl,
            ext: "jpg",
            vcodec: "none",
            acodec: "none",
            width: typeof validThumbs[0]?.width === "number" ? (validThumbs[0].width as number) : undefined,
            height: typeof validThumbs[0]?.height === "number" ? (validThumbs[0].height as number) : undefined,
            formatNote: `Photo ${idx + 1} · Item ${idx + 1}`,
            httpHeaders: defaultHeaders,
          });
        }
      }
    }

    if (entryFormats.length > 0) {
      // Filter out root formats that duplicate entry formats by URL, but preserve non-duplicate root formats (e.g. background audio)
      const nonDuplicateRootFormats = formats.filter((f) => !seenUrls.has(f.url));
      formats.length = 0;
      formats.push(...nonDuplicateRootFormats, ...entryFormats);
    }
  }

  const id = String(raw.id || rawEntries[0]?.id || "media");
  const title = typeof raw.title === "string" && raw.title.trim()
    ? raw.title
    : typeof rawEntries[0]?.title === "string" && (rawEntries[0].title as string).trim()
      ? (rawEntries[0].title as string)
      : "Social media post";

  if ((!raw.id && !rawEntries.length) || (formats.length === 0 && thumbnails.length === 0))
    throw new Error("No downloadable video or image was found for this URL.");
  return {
    id,
    title,
    uploader:
      typeof raw.uploader === "string"
        ? raw.uploader
        : typeof raw.channel === "string"
          ? raw.channel
          : undefined,
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    thumbnail:
      typeof raw.thumbnail === "string"
        ? raw.thumbnail
        : thumbnails.length > 0
          ? thumbnails[thumbnails.length - 1].url
          : raw.id && (raw.extractor_key === "Youtube" || raw.extractor === "youtube")
            ? `https://i.ytimg.com/vi/${raw.id}/hqdefault.jpg`
            : undefined,
    thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
    webpageUrl: typeof raw.webpage_url === "string" ? raw.webpage_url : undefined,
    platform: isSnapchat ? "Snapchat" : typeof raw.extractor_key === "string" ? raw.extractor_key : undefined,
    formats,
  };
}


export function getCookiesPath(): string | null {
  if (process.env.YTDLP_COOKIES_PATH && existsSync(process.env.YTDLP_COOKIES_PATH)) {
    return process.env.YTDLP_COOKIES_PATH;
  }
  const rootCookies = resolve(process.cwd(), "cookies.txt");
  if (existsSync(rootCookies)) return rootCookies;
  const serverCookies = resolve(process.cwd(), "server/cookies.txt");
  if (existsSync(serverCookies)) return serverCookies;
  return null;
}

export function getExecutablePath(): string {
  if (process.env.YTDLP_BIN) {
    return process.env.YTDLP_BIN;
  }
  const rootBin = resolve(process.cwd(), "bin/ytdlp");
  if (existsSync(rootBin)) return rootBin;
  try {
    const localWrapper = new URL("../../bin/ytdlp", import.meta.url).pathname;
    if (existsSync(localWrapper)) return localWrapper;
  } catch {}
  return "yt-dlp";
}

export function canonicalizeUrl(inputUrl: string): string {
  try {
    const parsed = new URL(inputUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "instagram.com" || host === "instagr.am") {
      const match = parsed.pathname.match(/\b(reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
      if (match) {
        const type = match[1].toLowerCase() === "reels" ? "reel" : match[1].toLowerCase();
        const shortcode = match[2];
        return `https://www.instagram.com/${type}/${shortcode}/`;
      }
    }
  } catch {}
  return inputUrl;
}

export async function extractWithYtDlp(inputUrl: string): Promise<ExtractedMedia> {
  const platform = detectExtractorPlatform(inputUrl);
  if (!platform)
    throw new Error("Unsupported URL. Use a YouTube, TikTok, Facebook, Instagram, Snapchat, or X URL.");

  let targetUrl = canonicalizeUrl(inputUrl);
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const isShortLink =
      host === "t.co" ||
      host === "t.snapchat.com" ||
      (host.includes("snapchat.com") && parsed.pathname.startsWith("/t/")) ||
      (host.includes("facebook.com") && (parsed.pathname.startsWith("/share/") || parsed.pathname.startsWith("/story.php"))) ||
      host === "fb.watch" ||
      host === "vm.tiktok.com" ||
      host === "vt.tiktok.com" ||
      host === "youtu.be";
    if (isShortLink) {
      try {
        const isFb = host.includes("facebook.com") || host === "fb.watch";
        const fetchUa = isFb
          ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
          : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        const resp = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "User-Agent": fetchUa,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
        });
        if (resp.url && resp.url !== targetUrl) {
          targetUrl = resp.url;
        } else {
          try {
            const html = await resp.text();
            const canonical =
              html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] ||
              html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)?.[1];
            if (canonical && canonical.startsWith("http")) {
              targetUrl = canonical;
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  const executable = getExecutablePath();
  const cookiesPath = getCookiesPath();

  const isYouTube = targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be");
  const isYouTubeVideo = isYouTube && !targetUrl.includes("/post/") && !targetUrl.includes("/community");
  const commonArgs = [
    "--dump-single-json",
    ...(isYouTubeVideo ? ["--no-playlist"] : []),
    "--skip-download",
    "--no-warnings",
    "--ignore-no-formats-error",
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",
  ];

  const ffmpegLocation = resolve(process.cwd(), "bin/ffmpeg");
  if (existsSync(ffmpegLocation)) {
    commonArgs.push("--ffmpeg-location", ffmpegLocation);
  }

  if (platform === "Instagram") {
    commonArgs.push("--impersonate", "chrome");
  }

  if (cookiesPath) {
    commonArgs.push("--cookies", cookiesPath);
  }

  commonArgs.push("--", targetUrl);
  const execOptions = { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 };

  try {
    const { stdout } = await execFileAsync(executable, commonArgs, execOptions);
    return normalizeYtDlpResult(JSON.parse(stdout) as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extractor failed";
    console.error("[extractWithYtDlp error]:", message);

    // Platform-specific fallbacks before failing
    if (platform === "X") {
      try {
        const fbResult = await extractTwitterFallback(targetUrl);
        if (fbResult) return fbResult;
      } catch {}
    }

    if (platform === "Instagram") {
      try {
        const fbResult = await extractInstagramFallback(targetUrl);
        if (fbResult) return fbResult;
      } catch {}
    }

    if (platform === "Facebook") {
      try {
        const fbResult = (await extractFacebookFallback(targetUrl)) || (await extractFacebookFallback(inputUrl));
        if (fbResult) return fbResult;
      } catch {}
    }

    // If default binary wasn't found and no explicit YTDLP_BIN was configured, try python3 -m yt_dlp
    if (/ENOENT|\b(?:command|binary|executable)\s+not\s+found\b/i.test(message) && !process.env.YTDLP_BIN) {
      try {
        const { stdout } = await execFileAsync("python3", ["-m", "yt_dlp", ...commonArgs], execOptions);
        return normalizeYtDlpResult(JSON.parse(stdout) as Record<string, unknown>);
      } catch (pyError) {
        const pyMessage = pyError instanceof Error ? pyError.message : "";
        if (/ENOENT|No module named/i.test(pyMessage)) {
          throw new Error("The media extractor is not installed on the server yet.");
        }
      }
    }

    if (/ENOENT|\b(?:command|binary|executable)\s+not\s+found\b/i.test(message)) {
      throw new Error("The media extractor is not installed on the server yet.");
    }
    if (/video is unavailable|unavailable/i.test(message)) {
      throw new Error(`This ${platform} post or video is unavailable or has been removed.`);
    }
    if (/private video|is private/i.test(message)) {
      throw new Error(`This ${platform} post is private. CBdrop only downloads public posts.`);
    }
    if (platform === "Facebook" && /login|registered users|only available|requires login/i.test(message)) {
      if (targetUrl.includes("/stories/") || inputUrl.includes("/stories/")) {
        throw new Error(
          "This Facebook story requires login or has expired. If this is from your account or a friend, provide your session cookies in cookies.txt to download it."
        );
      }
      throw new Error("This Facebook post is private or requires login. CBdrop only downloads public posts.");
    }
    if (platform === "Instagram" && /empty media response|not granting access|login|login_required/i.test(message)) {
      throw new Error(
        "This Instagram post is private, restricted, or requires an Instagram account to view. CBdrop only downloads public posts."
      );
    }
    if (platform === "Snapchat" && /404|not found/i.test(message)) {
      throw new Error("This Snapchat snap, story, or spotlight is no longer available or has expired.");
    }
    if (/\b(confirm your age|age-restricted|age gate|sign in to confirm your age)\b/i.test(message)) {
      if (platform === "YouTube") {
        try {
          const fallbackArgs = [
            "--dump-single-json",
            "--no-playlist",
            "--skip-download",
            "--no-warnings",
            "--extractor-args",
            "youtube:player_client=android,web_embedded",
            ...(cookiesPath ? ["--cookies", cookiesPath] : []),
            "--",
            inputUrl,
          ];
          const { stdout } = await execFileAsync(executable, fallbackArgs, { timeout: 25_000, maxBuffer: 16 * 1024 * 1024 });
          return normalizeYtDlpResult(JSON.parse(stdout) as Record<string, unknown>);
        } catch {
          // Fall through to reporting below
        }
      }

      if (!cookiesPath) {
        throw new Error(
          `This ${platform} video requires YouTube age verification. To download age-restricted or member-only videos, add a cookies.txt file to the CBdrop folder.`
        );
      }
      throw new Error(`This ${platform} video is age-restricted and could not be accessed with the current session cookies.`);
    }
    throw new Error(`We couldn't extract downloadable media from this ${platform} post. Check that it is public and the URL is correct.`);
  }
}

export async function extractTwitterFallback(url: string): Promise<ExtractedMedia | null> {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status(?:es)?\/(\d+)/i);
  if (!match) return null;
  const tweetId = match[1];
  try {
    const res = await fetch(`https://api.fxtwitter.com/i/status/${tweetId}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cbdrop/1.0)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tweet?: {
        id?: string;
        text?: string;
        author?: { name?: string; screen_name?: string };
        media?: {
          photos?: Array<{ url: string; width?: number; height?: number }>;
          videos?: Array<{ url: string; width?: number; height?: number }>;
        };
      };
    };
    const tweet = data.tweet;
    if (!tweet) return null;
    const title = tweet.text?.trim() || `Tweet ${tweetId}`;
    const author = tweet.author?.name || tweet.author?.screen_name || "X User";
    const photos = tweet.media?.photos || [];
    const videos = tweet.media?.videos || [];

    const formats: ExtractedFormat[] = [];
    const thumbnails: Array<{ url: string; width?: number; height?: number; id?: string }> = [];

    for (const [idx, v] of videos.entries()) {
      if (v.url) {
        formats.push({
          id: `video-${idx + 1}`,
          url: v.url,
          ext: "mp4",
          width: v.width,
          height: v.height,
          vcodec: "h264",
          acodec: "aac",
          formatNote: "Video",
          httpHeaders: { Referer: "https://x.com/" },
        });
      }
    }

    for (const [idx, p] of photos.entries()) {
      if (p.url) {
        const origUrl = p.url.includes("?") ? p.url : `${p.url}?name=orig`;
        formats.push({
          id: `photo-${idx + 1}`,
          url: origUrl,
          ext: "jpg",
          width: p.width,
          height: p.height,
          vcodec: "none",
          acodec: "none",
          formatNote: photos.length > 1 ? `Photo ${idx + 1} · Item ${idx + 1}` : "Photo",
          httpHeaders: { Referer: "https://x.com/" },
        });
        thumbnails.push({
          url: origUrl,
          width: p.width,
          height: p.height,
          id: `item-${idx + 1}`,
        });
      }
    }

    if (formats.length === 0 && thumbnails.length === 0) return null;

    return {
      id: tweet.id || tweetId,
      title,
      uploader: author,
      platform: "X",
      formats,
      thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
      thumbnail: thumbnails[0]?.url,
    };
  } catch {
    return null;
  }
}

export async function extractInstagramFallback(url: string): Promise<ExtractedMedia | null> {
  const match = url.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
  if (!match) return null;
  const shortcode = match[1];
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const imgMatches = Array.from(html.matchAll(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/g)).map((m) => m[1])
      .concat(Array.from(html.matchAll(/<img[^>]+src="([^"]*cdninstagram\.com[^"]*)"/g)).map((m) => m[1]));
    const cleanUrls = Array.from(new Set(imgMatches.map((u) => u.replace(/&amp;/g, "&"))))
      .filter((u) => !u.includes("s150x150") && !u.includes("/s320x320/"));
    if (cleanUrls.length === 0) return null;

    const formats: ExtractedFormat[] = cleanUrls.map((imgUrl, idx) => ({
      id: `photo-${idx + 1}`,
      url: imgUrl,
      ext: "jpg",
      vcodec: "none",
      acodec: "none",
      formatNote: cleanUrls.length > 1 ? `Photo ${idx + 1} · Item ${idx + 1}` : "Photo",
      httpHeaders: { Referer: "https://www.instagram.com/" },
    }));

    const authorMatch = html.match(/class="UsernameText"[^>]*>([^<]+)</i);
    const author = authorMatch ? authorMatch[1].trim() : "Instagram creator";

    return {
      id: shortcode,
      title: "Instagram Photo",
      uploader: author,
      platform: "Instagram",
      formats,
      thumbnails: cleanUrls.map((u, i) => ({ url: u, id: `item-${i + 1}` })),
      thumbnail: cleanUrls[0],
    };
  } catch {
    return null;
  }
}

export function parseFacebookHtml(html: string, originalUrl?: string): ExtractedMedia | null {
  if (!html || typeof html !== "string") return null;

  function cleanUrl(raw: string): string {
    return raw
      .replace(/\\\\/g, "")
      .replace(/\\\/|\//g, (m) => (m === "\\/" ? "/" : m))
      .replace(/\\u0026/g, "&")
      .replace(/&amp;/g, "&")
      .trim();
  }

  const seenUrls = new Set<string>();
  const formats: ExtractedFormat[] = [];
  const thumbnails: Array<{ url: string; id: string; width?: number; height?: number }> = [];

  // 1. High-definition (HD) Video extraction
  const hdPatterns = [
    /"playable_url_quality_hd"\s*:\s*"([^"]+)"/g,
    /"browser_native_hd_url"\s*:\s*"([^"]+)"/g,
    /"hd_src(?:_no_ratelimit)?"\s*:\s*"([^"]+)"/g,
  ];
  for (const pattern of hdPatterns) {
    for (const match of Array.from(html.matchAll(pattern))) {
      const u = cleanUrl(match[1]);
      if (u.startsWith("http") && !seenUrls.has(u)) {
        seenUrls.add(u);
        formats.push({
          id: `hd-${formats.length + 1}`,
          url: u,
          ext: "mp4",
          vcodec: "h264",
          acodec: "aac",
          height: 1080,
          formatNote: "HD Video · 1080p",
          httpHeaders: { Referer: "https://www.facebook.com/" },
        });
      }
    }
  }

  // 2. Standard-definition (SD) Video extraction
  const sdPatterns = [
    /"playable_url"\s*:\s*"([^"]+)"/g,
    /"browser_native_sd_url"\s*:\s*"([^"]+)"/g,
    /"sd_src(?:_no_ratelimit)?"\s*:\s*"([^"]+)"/g,
    /<meta\s+(?:property|name)="og:video(?::secure_url)?"\s+content="([^"]+)"/gi,
    /content="([^"]+)"\s+(?:property|name)="og:video(?::secure_url)?"/gi,
  ];
  for (const pattern of sdPatterns) {
    for (const match of Array.from(html.matchAll(pattern))) {
      const u = cleanUrl(match[1]);
      if (u.startsWith("http") && !seenUrls.has(u)) {
        seenUrls.add(u);
        formats.push({
          id: `sd-${formats.length + 1}`,
          url: u,
          ext: "mp4",
          vcodec: "h264",
          acodec: "aac",
          height: 720,
          formatNote: "SD Video · 720p",
          httpHeaders: { Referer: "https://www.facebook.com/" },
        });
      }
    }
  }

  // 3. Photos (viewer_image, photo_image, large_share_image, og:image, preload, CDN)
  const photoPatterns = [
    /"(?:viewer_image|photo_image|large_share_image)"\s*:\s*\{[^}]*?"uri"\s*:\s*"([^"]+)"/g,
    /<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/gi,
    /content="([^"]+)"\s+(?:property|name)="og:image"/gi,
    /<meta\s+(?:property|name)="twitter:image"\s+content="([^"]+)"/gi,
    /<link\s+rel="preload"\s+href="([^"]+)"\s+as="image"/gi,
  ];
  for (const pattern of photoPatterns) {
    for (const match of Array.from(html.matchAll(pattern))) {
      const u = cleanUrl(match[1]);
      if (
        u.startsWith("http") &&
        !seenUrls.has(u) &&
        !u.includes("static.xx.fbcdn.net") &&
        !/(?:p|s)50x50|(?:p|s)100x100|\/p\d+x\d+\//i.test(u)
      ) {
        seenUrls.add(u);
        thumbnails.push({ url: u, id: `photo-${thumbnails.length + 1}` });
        formats.push({
          id: `photo-${formats.length + 1}`,
          url: u,
          ext: "jpg",
          vcodec: "none",
          acodec: "none",
          formatNote: "Photo",
          httpHeaders: {
            Referer: "https://www.facebook.com/",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          },
        });
      }
    }
  }

  // 4. Additional CDN images if none found yet
  if (formats.length === 0) {
    const cdnMatches = Array.from(
      html.matchAll(/https?:\/\/[a-zA-Z0-9.-]+\.fbcdn\.net\/v\/[^\s"'<>\\]+\.(?:jpg|jpeg|png|webp)[^\s"'<>\\]*/g)
    ).map((m) => cleanUrl(m[0]));
    for (const cm of cdnMatches) {
      if (
        !seenUrls.has(cm) &&
        !cm.includes("static.xx.fbcdn.net") &&
        !/(?:p|s)50x50|(?:p|s)100x100|\/p\d+x\d+\//i.test(cm)
      ) {
        seenUrls.add(cm);
        thumbnails.push({ url: cm, id: `photo-${thumbnails.length + 1}` });
        formats.push({
          id: `photo-${formats.length + 1}`,
          url: cm,
          ext: "jpg",
          vcodec: "none",
          acodec: "none",
          formatNote: "Photo",
          httpHeaders: { Referer: "https://www.facebook.com/" },
        });
        if (formats.length >= 10) break;
      }
    }
  }

  if (formats.length === 0) return null;

  // Title extraction
  const isStory = Boolean(
    originalUrl?.includes("/stories/") ||
    html.includes("unified_stories") ||
    html.includes("story_card_info") ||
    /story/i.test(html.slice(0, 2000))
  );
  const defaultTitle = isStory ? "Facebook Story" : "Facebook Post";
  const titleMatch =
    html.match(/<title>([^<]+)<\/title>/i) ||
    html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+(?:property|name)="twitter:title"\s+content="([^"]+)"/i);
  const rawTitle = titleMatch ? cleanUrl(titleMatch[1]) : defaultTitle;
  const title = rawTitle.replace(/\s*\|\s*Facebook$/i, "").trim() || defaultTitle;

  // Creator extraction
  const authorMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)?.[1];
  let uploader = isStory ? "Facebook Story" : "Facebook Creator";
  if (authorMatch && authorMatch.includes(" | ")) {
    uploader = cleanUrl(authorMatch.split(" | ")[0]);
  } else {
    const ownerMatch =
      html.match(/"owner"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/i) ||
      html.match(/"actor"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/i);
    if (ownerMatch) uploader = cleanUrl(ownerMatch[1]);
  }

  // ID extraction
  let id = "";
  if (originalUrl) {
    const storyM = originalUrl.match(/\/stories\/(?:(?<bucket>\d+)\/)?(?<token>[A-Za-z0-9_=]+)/i);
    if (storyM) {
      let token = storyM.groups?.token || "";
      if (token.startsWith("Uzpf") || token.includes("=")) {
        try {
          const decoded = Buffer.from(token, "base64").toString("utf-8");
          const m = decoded.match(/\d+/);
          if (m) token = m[0];
        } catch {}
      }
      id = token || storyM.groups?.bucket || "";
    }
  }
  if (!id) {
    const idM =
      html.match(/"story_fbid"\s*:\s*"?(\d+)"?/i) ||
      html.match(/"post_id"\s*:\s*"?(\d+)"?/i) ||
      html.match(/"video_id"\s*:\s*"?(\d+)"?/i);
    if (idM) id = idM[1];
  }
  if (!id) id = `fb_${Date.now()}`;

  // Update formatNotes for multi-photo
  const photoFormats = formats.filter((f) => f.vcodec === "none");
  if (photoFormats.length > 1) {
    photoFormats.forEach((f, i) => {
      f.formatNote = `Photo ${i + 1} · Item ${i + 1}`;
    });
  }

  return {
    id,
    title,
    uploader,
    platform: "Facebook",
    formats,
    thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
    thumbnail: thumbnails[0]?.url || formats.find((f) => f.vcodec === "none")?.url || formats[0]?.url,
  };
}

export async function extractFacebookFallback(url: string): Promise<ExtractedMedia | null> {
  const uas = [
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ];

  for (const ua of uas) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": ua,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 500) continue;

      const parsed = parseFacebookHtml(html, url);
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }

  return null;
}
