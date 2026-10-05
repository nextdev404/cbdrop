import { existsSync, createReadStream, createWriteStream, mkdirSync, statSync, readdirSync, unlinkSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { Readable, Transform } from "node:stream";
import { spawn } from "node:child_process";
import { getCookiesPath, getExecutablePath, canonicalizeUrl } from "../extractors/ytdlp";

const nanoid = (len = 12) => randomBytes(Math.ceil(len * 0.75)).toString("base64url").slice(0, len);
const secret = () => process.env.JWT_SECRET || "cbdrop-development-download-secret";
const allowedProtocols = new Set(["https:"]);

export interface DownloadProgressState {
  token: string;
  filename: string;
  container: string;
  status: "idle" | "preparing" | "downloading" | "resuming" | "interrupted" | "completed" | "error";
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  eta: number; // seconds remaining
  lastUpdated: number;
  error?: string;
}

export const activeDownloads = new Map<string, DownloadProgressState>();

export function getDownloadProgress(token: string): DownloadProgressState | null {
  return activeDownloads.get(token) || null;
}

export function updateDownloadProgress(token: string, updates: Partial<DownloadProgressState>) {
  const current = activeDownloads.get(token);
  if (!current) return;
  Object.assign(current, updates, { lastUpdated: Date.now() });
}

export function cleanOldDownloads() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of activeDownloads.entries()) {
    if (v.lastUpdated < cutoff) activeDownloads.delete(k);
  }
}

/**
 * Automatically purges temporary video files and merge cache older than 10 minutes.
 * Prevents server disk from ever filling up (matches Dajiye's 10-minute auto-cleanup policy).
 */
export function cleanTempDiskCache(maxAgeMs = 10 * 60 * 1000) {
  try {
    const cacheDir = resolve(tmpdir(), "cbdrop_cache");
    if (existsSync(cacheDir)) {
      const now = Date.now();
      const files = readdirSync(cacheDir);
      for (const file of files) {
        try {
          const filePath = resolve(cacheDir, file);
          const stats = statSync(filePath);
          if (now - stats.mtimeMs > maxAgeMs) {
            unlinkSync(filePath);
            console.log(`[cleanTempDiskCache] Removed old cache file: ${file}`);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[cleanTempDiskCache] Error cleaning cacheDir:", err);
  }

  // Also clean any stray .part, .ytdl, or leftover video files in the root older than 10 mins
  try {
    const cwdFiles = readdirSync(process.cwd());
    const now = Date.now();
    for (const file of cwdFiles) {
      if (file.endsWith(".part") || file.endsWith(".ytdl")) {
        try {
          const p = resolve(process.cwd(), file);
          const st = statSync(p);
          if (now - st.mtimeMs > maxAgeMs) {
            unlinkSync(p);
            console.log(`[cleanTempDiskCache] Removed stray temp file: ${file}`);
          }
        } catch {}
      }
    }
  } catch {}
}

export function startPeriodicCleanup(intervalMs = 10 * 60 * 1000) {
  cleanTempDiskCache();
  cleanOldDownloads();
  const timer = setInterval(() => {
    cleanTempDiskCache();
    cleanOldDownloads();
  }, intervalMs);
  timer.unref();
}

type DownloadPayload = {
  url: string;
  filename: string;
  container: string;
  headers?: Record<string, string>;
  /** Optional audio stream URL to merge with video using ffmpeg */
  audioUrl?: string;
  audioHeaders?: Record<string, string>;
  sourceUrl?: string;
  formatId?: string;
  expectedSize?: number;
  exp: number;
};

type ZipImageItem = {
  url: string;
  filename: string;
  headers?: Record<string, string>;
};

type ZipDownloadPayload = {
  filename: string;
  images: ZipImageItem[];
  exp: number;
};

const zipPayloadCache = new Map<string, { payload: ZipDownloadPayload; timer: NodeJS.Timeout }>();

function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export function createZipDownloadUrl(filename: string, images: ZipImageItem[]) {
  const token = `zip_${nanoid(16)}`;
  const payload: ZipDownloadPayload = {
    filename: filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160) || "cbdrop-images.zip",
    images,
    exp: Math.floor(Date.now() / 1000) + 20 * 60, // 20 minutes
  };
  const timer = setTimeout(() => zipPayloadCache.delete(token), 20 * 60 * 1000);
  zipPayloadCache.set(token, { payload, timer });
  return `/api/download-zip/${token}.${sign(token)}`;
}

export function createDownloadProxyUrl(
  sourceUrl: string,
  filename: string,
  container: string,
  headers?: Record<string, string>,
  audioUrl?: string,
  audioHeaders?: Record<string, string>,
  originalSourceUrl?: string,
  formatId?: string,
  expectedSize?: number
) {
  const parsed = new URL(sourceUrl);
  if (!allowedProtocols.has(parsed.protocol)) throw new Error("Only HTTPS media URLs can be downloaded.");
  const payload: DownloadPayload = {
    url: sourceUrl,
    filename: filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 160),
    container,
    headers,
    audioUrl,
    audioHeaders,
    sourceUrl: originalSourceUrl,
    formatId,
    expectedSize,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `/api/download/${encoded}.${sign(encoded)}`;
}

export function decodeToken(token: string): DownloadPayload {
  const [encoded, signature] = token.split(".");
  const expected = encoded ? sign(encoded) : "";
  const providedBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (!encoded || !signature || providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) throw new Error("Invalid download link.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DownloadPayload;
  const parsed = new URL(payload.url);
  if (payload.exp < Math.floor(Date.now() / 1000) || !allowedProtocols.has(parsed.protocol)) throw new Error("This download link has expired or is invalid.");
  return payload;
}

async function proxyHttpMedia(payload: DownloadPayload, req: Request, res: Response, token?: string) {
  const defaultUa =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const requestHeaders: Record<string, string> = {
    "User-Agent":
      payload.headers?.["User-Agent"] ||
      payload.headers?.["user-agent"] ||
      defaultUa,
    Accept: "*/*",
    "Accept-Encoding": "identity",
  };

  let referer = payload.headers?.Referer || payload.headers?.referer;
  let origin: string | undefined = payload.headers?.Origin || payload.headers?.origin;

  try {
    const urlObj = new URL(payload.url);
    const host = urlObj.hostname.toLowerCase();
    if (host.includes("sc-cdn.net") || host.includes("snapchat.com")) {
      referer = "https://www.snapchat.com/";
      origin = "https://www.snapchat.com";
    } else if (host.includes("cdninstagram.com") || host.includes("instagram.com")) {
      referer = "https://www.instagram.com/";
    } else if (host.includes("fbcdn.net") || host.includes("facebook.com") || host.includes("fbsbx.com")) {
      referer = "https://www.facebook.com/";
      if (host.includes("lookaside.fbsbx.com")) {
        requestHeaders["User-Agent"] = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
      }
    } else if (host.includes("twimg.com") || host.includes("twitter.com") || host.includes("x.com")) {
      referer = "https://x.com/";
    } else if (host.includes("byteoversea.com") || host.includes("ibytedtos.com") || host.includes("tiktokcdn.com") || host.includes("tiktok.com")) {
      if (!referer) {
        referer = payload.sourceUrl || "https://www.tiktok.com/";
      }
    } else if (host.includes("ytimg.com") || host.includes("googlevideo.com") || host.includes("ggpht.com")) {
      referer = "https://www.youtube.com/";
    } else if (!referer) {
      referer = `${urlObj.protocol}//${urlObj.hostname}/`;
    }
  } catch {
    if (!referer) referer = "https://www.google.com/";
  }

  if (referer) {
    requestHeaders["Referer"] = referer;
  }
  if (origin) {
    requestHeaders["Origin"] = origin;
  }

  if (payload.headers?.Cookie || payload.headers?.cookie) {
    requestHeaders["Cookie"] = (payload.headers.Cookie || payload.headers.cookie)!;
  }

  if (req.headers.range) {
    requestHeaders["range"] = req.headers.range;
  }

  const urlsToTry = [payload.url];
  if (payload.url.includes("ytimg.com") || payload.url.includes("youtube.com")) {
    if (payload.url.includes("maxresdefault")) {
      urlsToTry.push(payload.url.replace(/maxresdefault\.[a-z0-9]+/i, "sddefault.jpg"));
      urlsToTry.push(payload.url.replace(/maxresdefault\.[a-z0-9]+/i, "hqdefault.jpg"));
      urlsToTry.push(payload.url.replace(/maxresdefault\.[a-z0-9]+/i, "mqdefault.jpg"));
    }
    if (payload.url.endsWith(".webp")) {
      urlsToTry.push(payload.url.replace(/\.webp$/i, ".jpg"));
    }
  }

  const isHead = req.method === "HEAD";
  if (req.headers["if-range"]) {
    requestHeaders["if-range"] = req.headers["if-range"] as string;
  }
  if (req.headers["if-none-match"]) {
    requestHeaders["if-none-match"] = req.headers["if-none-match"] as string;
  }

  let upstream: globalThis.Response | null = null;
  const headerVariations: Record<string, string>[] = [{ ...requestHeaders }];
  if (requestHeaders["Referer"] || requestHeaders["referer"]) {
    // Many CDNs (including TikTok and ByteDance) allow direct access WITHOUT Referer, but block requests if generic Referer is passed
    const noRef = { ...requestHeaders };
    delete noRef["Referer"];
    delete noRef["referer"];
    delete noRef["Origin"];
    delete noRef["origin"];
    headerVariations.push(noRef);
  }
  if (payload.sourceUrl && requestHeaders["Referer"] !== payload.sourceUrl) {
    headerVariations.push({
      ...requestHeaders,
      Referer: payload.sourceUrl,
    });
  }

  for (const testUrl of urlsToTry) {
    let lastStatus = 0;
    try {
      const resp = await fetch(testUrl, {
        method: isHead ? "HEAD" : "GET",
        headers: requestHeaders,
        redirect: "follow",
      });
      if (resp.ok && (isHead || resp.body)) {
        upstream = resp;
        break;
      }
      lastStatus = resp.status;
      if (resp.status !== 404) {
        console.warn(`[proxyHttpMedia] fetch returned status ${resp.status} for ${testUrl.slice(0, 80)}`);
      }
    } catch (err) {
      console.warn(`[proxyHttpMedia] fetch attempt error:`, err instanceof Error ? err.message : err);
    }

    // Only retry with alternate headers (e.g. without referer or with sourceUrl) if upstream returned 403 or 401 (forbidden/anti-hotlink)
    if (!upstream && (lastStatus === 403 || lastStatus === 401)) {
      for (const hdrs of headerVariations.slice(1)) {
        try {
          const resp = await fetch(testUrl, {
            method: isHead ? "HEAD" : "GET",
            headers: hdrs,
            redirect: "follow",
          });
          if (resp.ok && (isHead || resp.body)) {
            upstream = resp;
            break;
          }
        } catch {}
      }
    }

    if (upstream && upstream.ok) break;
  }

  // If HEAD failed or upstream returned error, try fallback GET with 0-0 range probe
  if (isHead && (!upstream || !upstream.ok)) {
    for (const testUrl of urlsToTry) {
      try {
        const probeResp = await fetch(testUrl, {
          method: "GET",
          headers: { ...requestHeaders, range: "bytes=0-0" },
          redirect: "follow",
        });
        if (probeResp.ok) {
          upstream = probeResp;
          break;
        }
      } catch {}
    }
  }

  if (!upstream || !upstream.ok || (!isHead && !upstream.body)) {
    throw new Error(`Media source returned ${upstream ? upstream.status : "error"}.`);
  }

  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
  const isAudio = payload.container === "m4a" || payload.container === "mp3";
  const isImage = IMAGE_EXTS.has((payload.container || "").toLowerCase()) || IMAGE_EXTS.has((payload.filename.split(".").pop() || "").toLowerCase());
  const mediaType = isAudio
    ? `audio/${payload.container === "m4a" ? "mp4" : payload.container}`
    : isImage
      ? `image/${payload.container === "jpg" || payload.container === "jpeg" ? "jpeg" : (payload.container || "jpeg")}`
      : `video/${payload.container}`;

  let outFilename = payload.filename;
  if (isImage && (outFilename.endsWith(".mp4") || !outFilename.includes("."))) {
    const ext = payload.container === "jpeg" ? "jpg" : (IMAGE_EXTS.has(payload.container) ? payload.container : "jpg");
    outFilename = `${outFilename.replace(/\.[^/.]+$/, "")}.${ext}`;
  }

  // Parse upstream total file size and range headers
  const upstreamRange = upstream.headers.get("content-range");
  const upstreamLength = upstream.headers.get("content-length");
  let totalBytes = payload.expectedSize || 0;
  if (upstreamRange) {
    const totalMatch = upstreamRange.match(/\/(\d+)/);
    if (totalMatch) totalBytes = parseInt(totalMatch[1], 10);
  } else if (upstreamLength && upstream.status === 200) {
    totalBytes = parseInt(upstreamLength, 10);
  }

  // Headers for both HEAD and GET
  res.setHeader("content-type", upstream.headers.get("content-type") || mediaType);
  res.setHeader("content-disposition", `attachment; filename="${outFilename}"`);
  res.setHeader("accept-ranges", "bytes");
  res.setHeader("cache-control", "private, max-age=3600");

  const etag = upstream.headers.get("etag");
  if (etag) res.setHeader("etag", etag);
  const lastMod = upstream.headers.get("last-modified");
  if (lastMod) res.setHeader("last-modified", lastMod);

  if (isHead) {
    res.status(200);
    if (totalBytes > 0) {
      res.setHeader("content-length", String(totalBytes));
    }
    res.end();
    return;
  }

  // Handle Range requests
  const rangeHeader = req.headers.range;
  let startOffset = 0;
  let endOffset = totalBytes > 0 ? totalBytes - 1 : undefined;

  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      startOffset = parseInt(m[1], 10);
      if (m[2]) endOffset = parseInt(m[2], 10);
    }
  }

  let needsSlicing = false;
  if (upstream.status === 206) {
    res.status(206);
    if (upstreamRange) res.setHeader("content-range", upstreamRange);
    if (upstreamLength) res.setHeader("content-length", upstreamLength);
  } else if (upstream.status === 200 && rangeHeader && totalBytes > 0) {
    // Upstream returned 200 despite Range header -> Slice locally for full 206 compliance
    if (startOffset >= totalBytes) {
      res.status(416).setHeader("content-range", `bytes */${totalBytes}`).end();
      return;
    }
    const finalEnd = endOffset !== undefined ? Math.min(endOffset, totalBytes - 1) : totalBytes - 1;
    const partialLength = finalEnd - startOffset + 1;
    res.status(206);
    res.setHeader("content-range", `bytes ${startOffset}-${finalEnd}/${totalBytes}`);
    res.setHeader("content-length", String(partialLength));
    needsSlicing = true;
  } else {
    res.status(upstream.status);
    if (upstreamLength) res.setHeader("content-length", upstreamLength);
    else if (totalBytes > 0) res.setHeader("content-length", String(totalBytes));
  }

  // Track live progress
  let currentBytes = startOffset;
  const targetTotal = totalBytes;

  if (token) {
    activeDownloads.set(token, {
      token,
      filename: outFilename,
      container: payload.container,
      status: startOffset > 0 ? "resuming" : "downloading",
      downloadedBytes: currentBytes,
      totalBytes: targetTotal,
      speed: 0,
      eta: 0,
      lastUpdated: Date.now(),
    });
  }

  let lastTrackTime = Date.now();
  let bytesSinceLastTrack = 0;

  const rawStream = Readable.fromWeb(upstream.body as never);

  const tracker = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      currentBytes += chunk.length;
      bytesSinceLastTrack += chunk.length;
      const now = Date.now();
      const elapsed = (now - lastTrackTime) / 1000;
      if (elapsed >= 0.4 && token) {
        const speed = Math.round(bytesSinceLastTrack / elapsed);
        const remaining = Math.max(0, targetTotal - currentBytes);
        const eta = speed > 0 && remaining > 0 ? Math.round(remaining / speed) : 0;
        updateDownloadProgress(token, {
          status: "downloading",
          downloadedBytes: currentBytes,
          totalBytes: targetTotal,
          speed,
          eta,
        });
        lastTrackTime = now;
        bytesSinceLastTrack = 0;
      }
      callback(null, chunk);
    },
  });

  rawStream.on("error", (err) => {
    if (token) updateDownloadProgress(token, { status: "error", error: err.message });
  });

  res.on("close", () => {
    if (!res.writableEnded && token) {
      const state = activeDownloads.get(token);
      if (state && state.status !== "completed") {
        updateDownloadProgress(token, { status: "interrupted", speed: 0 });
      }
    }
  });

  tracker.on("end", () => {
    if (token) {
      updateDownloadProgress(token, {
        status: "completed",
        downloadedBytes: targetTotal > 0 ? targetTotal : currentBytes,
        totalBytes: targetTotal > 0 ? targetTotal : currentBytes,
        speed: 0,
        eta: 0,
      });
    }
  });

  if (needsSlicing) {
    let skipped = 0;
    const finalEnd = endOffset !== undefined ? Math.min(endOffset, totalBytes - 1) : totalBytes - 1;
    let delivered = 0;
    const toDeliver = finalEnd - startOffset + 1;

    const slicer = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (delivered >= toDeliver) return cb();
        if (skipped + chunk.length <= startOffset) {
          skipped += chunk.length;
          return cb();
        }
        let startInChunk = 0;
        if (skipped < startOffset) {
          startInChunk = startOffset - skipped;
          skipped = startOffset;
        }
        const sliceChunk = chunk.subarray(startInChunk);
        const canTake = Math.min(sliceChunk.length, toDeliver - delivered);
        delivered += canTake;
        if (canTake < sliceChunk.length) {
          cb(null, sliceChunk.subarray(0, canTake));
        } else {
          cb(null, sliceChunk);
        }
      },
    });
    rawStream.pipe(slicer).pipe(tracker).pipe(res);
  } else {
    rawStream.pipe(tracker).pipe(res);
  }
}

function buildFfmpegHeaders(headers?: Record<string, string>, targetUrl?: string): string[] {
  const args: string[] = [];
  const ua =
    headers?.["User-Agent"] ||
    headers?.["user-agent"] ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  args.push("-user_agent", ua);

  const headerLines: string[] = [];
  let referer = headers?.Referer || headers?.referer;
  if (targetUrl) {
    try {
      const u = new URL(targetUrl);
      const h = u.hostname.toLowerCase();
      if (h.includes("sc-cdn.net") || h.includes("snapchat.com")) {
        referer = "https://www.snapchat.com/";
      } else if (h.includes("googlevideo.com") || h.includes("youtube.com")) {
        referer = "https://www.youtube.com/";
      } else if (h.includes("cdninstagram.com") || h.includes("instagram.com")) {
        referer = "https://www.instagram.com/";
      } else if (h.includes("tiktokcdn.com") || h.includes("tiktok.com")) {
        referer = "https://www.tiktok.com/";
      } else if (h.includes("twimg.com") || h.includes("x.com") || h.includes("twitter.com")) {
        referer = "https://x.com/";
      } else if (h.includes("fbcdn.net") || h.includes("facebook.com")) {
        referer = "https://www.facebook.com/";
      }
    } catch {}
  }
  if (referer) headerLines.push(`Referer: ${referer}`);

  if (headers?.Cookie || headers?.cookie) {
    headerLines.push(`Cookie: ${headers.Cookie || headers.cookie}`);
  }

  if (headerLines.length > 0) {
    args.push("-headers", headerLines.join("\r\n") + "\r\n");
  }
  return args;
}

export function getFfmpegPath(): string {
  if (process.env.FFMPEG_BIN && existsSync(process.env.FFMPEG_BIN)) {
    return process.env.FFMPEG_BIN;
  }
  const rootBin = resolve(process.cwd(), "bin/ffmpeg");
  if (existsSync(rootBin)) return rootBin;
  try {
    const localBin = new URL("../../bin/ffmpeg", import.meta.url).pathname;
    if (existsSync(localBin)) return localBin;
  } catch {}
  const homeBin = resolve(process.env.HOME || "", ".local/bin/ffmpeg");
  if (existsSync(homeBin)) return homeBin;
  return "ffmpeg";
}

function proxyManifestWithFfmpeg(payload: DownloadPayload, res: Response) {
  const ffmpegBin = getFfmpegPath();
  const baseName = payload.filename.replace(/\.[a-z0-9]+$/i, "");
  const outFilename = `${baseName}.mp4`;
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    ...buildFfmpegHeaders(payload.headers, payload.url),
    "-i", payload.url,
    "-c", "copy",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4",
    "pipe:1",
  ];
  const child = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "pipe"] });

  let headersSent = false;
  let stderrOutput = "";

  child.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  child.stdout.once("data", (firstChunk) => {
    headersSent = true;
    res.status(200)
      .setHeader("content-type", "video/mp4")
      .setHeader("content-disposition", `attachment; filename="${outFilename}"`)
      .setHeader("cache-control", "no-store");
    res.write(firstChunk);
    child.stdout.pipe(res);
  });

  child.on("error", (err) => {
    console.error("[ffmpeg manifest error]:", err.message);
    if (!headersSent && !res.headersSent) {
      res.status(502).send("Unable to start stream processor: " + err.message);
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`[ffmpeg manifest exited with code ${code}]:`, stderrOutput);
      if (!headersSent && !res.headersSent) {
        res.status(502).send("Stream processing failed: " + (stderrOutput.trim() || "manifest error"));
        return;
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  });

  res.on("close", () => {
    if (!child.killed) child.kill("SIGTERM");
  });
}

function mergeVideoAudioWithFfmpeg(payload: DownloadPayload, req: Request, res: Response, token?: string) {
  const ffmpegBin = getFfmpegPath();
  const videoHeaders = buildFfmpegHeaders(payload.headers, payload.url);
  const audioHeaders = buildFfmpegHeaders(payload.audioHeaders, payload.audioUrl);

  const baseName = payload.filename.replace(/\.[a-z0-9]+$/i, "");
  const isWebm = (payload.container || "").toLowerCase() === "webm";
  const ext = isWebm ? "webm" : "mp4";
  const outFilename = `${baseName}.${ext}`;
  const contentType = isWebm ? "video/webm" : "video/mp4";

  // Local temp disk cache for resumable range requests
  const cacheDir = resolve(tmpdir(), "cbdrop_cache");
  if (!existsSync(cacheDir)) {
    try { mkdirSync(cacheDir, { recursive: true }); } catch {}
  }
  const cacheKey = createHmac("sha256", secret()).update(`${payload.url}_${payload.audioUrl || ""}`).digest("hex").slice(0, 24);
  const cachePath = resolve(cacheDir, `${cacheKey}.${ext}`);

  // Check if range request can be served from existing cache file
  if (req.headers.range && existsSync(cachePath)) {
    try {
      const stats = statSync(cachePath);
      if (stats.size > 0) {
        const m = req.headers.range.match(/bytes=(\d+)-(\d+)?/);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = m[2] ? parseInt(m[2], 10) : stats.size - 1;
          if (start < stats.size) {
            const finalEnd = Math.min(end, stats.size - 1);
            res.status(206)
              .setHeader("content-type", contentType)
              .setHeader("content-disposition", `attachment; filename="${outFilename}"`)
              .setHeader("accept-ranges", "bytes")
              .setHeader("content-range", `bytes ${start}-${finalEnd}/${stats.size}`)
              .setHeader("content-length", String(finalEnd - start + 1))
              .setHeader("cache-control", "private, max-age=3600");
            createReadStream(cachePath, { start, end: finalEnd }).pipe(res);
            return;
          }
        }
      }
    } catch {}
  }

  let audioCodecArgs: string[];
  let muxerArgs: string[];

  if (isWebm) {
    const isOpus = (payload.audioUrl || "").includes("opus") || (payload.audioUrl || "").includes(".weba") || (payload.audioUrl || "").includes("audio%2Fwebm");
    audioCodecArgs = isOpus ? ["-c:a", "copy"] : ["-c:a", "libopus", "-b:a", "128k"];
    muxerArgs = ["-f", "webm"];
  } else {
    const isAacAudio =
      (payload.audioUrl || "").includes(".m4a") ||
      (payload.audioUrl || "").includes("mime=audio%2Fmp4");
    audioCodecArgs = isAacAudio
      ? ["-c:a", "copy"]
      : ["-c:a", "aac", "-b:a", "192k"];
    muxerArgs = ["-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4"];
  }

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    ...videoHeaders,
    "-i", payload.url,
    ...audioHeaders,
    "-i", payload.audioUrl!,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    ...audioCodecArgs,
    ...muxerArgs,
    "pipe:1",
  ];

  const child = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "pipe"] });

  let headersSent = false;
  let stderrOutput = "";
  let deliveredBytes = 0;
  const targetTotal = payload.expectedSize || 0;

  if (token) {
    activeDownloads.set(token, {
      token,
      filename: outFilename,
      container: payload.container || "mp4",
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: targetTotal,
      speed: 0,
      eta: 0,
      lastUpdated: Date.now(),
    });
  }

  let lastTrackTime = Date.now();
  let bytesSinceLastTrack = 0;

  let cacheWriteStream: ReturnType<typeof createWriteStream> | null = null;
  try {
    cacheWriteStream = createWriteStream(cachePath);
  } catch {}

  child.stderr.on("data", (chunk) => {
    stderrOutput += chunk.toString();
  });

  child.stdout.on("data", (chunk: Buffer) => {
    deliveredBytes += chunk.length;
    bytesSinceLastTrack += chunk.length;
    if (cacheWriteStream && !cacheWriteStream.destroyed) {
      try { cacheWriteStream.write(chunk); } catch {}
    }
    const now = Date.now();
    const elapsed = (now - lastTrackTime) / 1000;
    if (elapsed >= 0.4 && token) {
      const speed = Math.round(bytesSinceLastTrack / elapsed);
      const remaining = Math.max(0, targetTotal - deliveredBytes);
      const eta = speed > 0 && remaining > 0 ? Math.round(remaining / speed) : 0;
      updateDownloadProgress(token, {
        status: "downloading",
        downloadedBytes: deliveredBytes,
        totalBytes: targetTotal > deliveredBytes ? targetTotal : deliveredBytes,
        speed,
        eta,
      });
      lastTrackTime = now;
      bytesSinceLastTrack = 0;
    }
  });

  // CRITICAL: Only send HTTP 200 OK headers once ffmpeg produces its first chunk of data.
  // If ffmpeg fails before producing output, we do NOT send an empty 200 OK file to the browser.
  child.stdout.once("data", (firstChunk) => {
    headersSent = true;
    res.status(200)
      .setHeader("content-type", "video/mp4")
      .setHeader("content-disposition", `attachment; filename="${outFilename}"`)
      .setHeader("accept-ranges", "bytes")
      .setHeader("cache-control", "private, max-age=3600");
    res.write(firstChunk);
    child.stdout.pipe(res);
  });

  child.on("error", (err) => {
    console.error("[ffmpeg merge spawn error]:", err.message);
    if (cacheWriteStream && !cacheWriteStream.destroyed) cacheWriteStream.end();
    if (token) updateDownloadProgress(token, { status: "error", error: err.message });
    if (!headersSent && !res.headersSent) {
      res.status(502).send("Unable to start video processor: " + err.message);
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  child.on("close", (code) => {
    if (cacheWriteStream && !cacheWriteStream.destroyed) cacheWriteStream.end();
    if (code !== 0) {
      console.error(`[ffmpeg merge exited with code ${code}]:`, stderrOutput);
      if (token) updateDownloadProgress(token, { status: "error", error: stderrOutput.trim() || "merge error" });
      if (!headersSent && !res.headersSent) {
        if (payload.sourceUrl) {
          console.warn("[mergeVideoAudioWithFfmpeg] ffmpeg merge failed, falling back to streamYouTubeWithYtDlp:", stderrOutput);
          return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, payload.container, token, payload.expectedSize);
        }
        res.status(502).send("Video processing failed: " + (stderrOutput.trim() || "stream mux error"));
        return;
      }
    } else if (token) {
      updateDownloadProgress(token, {
        status: "completed",
        downloadedBytes: deliveredBytes,
        totalBytes: targetTotal > deliveredBytes ? targetTotal : deliveredBytes,
        speed: 0,
        eta: 0,
      });
    }
    if (!res.writableEnded) {
      res.end();
    }
  });

  res.on("close", () => {
    if (!child.killed) child.kill("SIGTERM");
    if (cacheWriteStream && !cacheWriteStream.destroyed) cacheWriteStream.end();
    if (!res.writableEnded && token) {
      const state = activeDownloads.get(token);
      if (state && state.status !== "completed") {
        updateDownloadProgress(token, { status: "interrupted", speed: 0 });
      }
    }
  });
}

// In-progress downloads map to deduplicate concurrent requests for the exact same stream
const inProgressDownloads = new Map<string, Promise<string>>();

export function clearInProgressDownloads() {
  inProgressDownloads.clear();
}

export function streamYouTubeWithYtDlp(
  sourceUrl: string,
  formatId: string | undefined,
  filename: string,
  res: Response,
  container = "mp4",
  token?: string,
  expectedSize?: number
) {
  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
  if (IMAGE_EXTS.has((container || "").toLowerCase()) || IMAGE_EXTS.has((filename.split(".").pop() || "").toLowerCase())) {
    res.status(400).send("Images cannot be processed by video streaming pipeline.");
    return;
  }

  const canonicalUrl = canonicalizeUrl(sourceUrl);
  const isYouTube = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
  const ytdlpBin = getExecutablePath();
  const ffmpegBin = getFfmpegPath();
  const cookiesPath = isYouTube ? getCookiesPath("YouTube") : getCookiesPath();

  const rawFormatId = formatId ? formatId.replace(/^extractor-/, "").replace(/-direct$/, "").replace(/-mp4$/, "") : undefined;
  const videoFormatId = rawFormatId ? (rawFormatId.includes("-") ? rawFormatId.split("-")[0] : rawFormatId) : undefined;
  const isAudio = container === "m4a" || container === "mp3" || container === "weba" || container === "opus" || container === "wav" || container === "flac" || (rawFormatId?.includes("audio") ?? false);

  // Map DASH format IDs to HLS equivalents which are authorized and do not trigger 403
  const HLS_MAP: Record<string, string> = {
    // 4K (2160p) - use HLS format 625 instead of DASH 313/401
    "313": "625",
    "401": "625",
    "315": "625",  // 4K 60fps
    "272": "625",
    // 1440p (2K) - use HLS if available, else best available
    "400": "620",  // only if 620 exists, otherwise use best
    "308": "620",
    "271": "620",
    // 1080p
    "137": "270",
    "299": "312",
    "312": "312",
    "270": "270",
    "248": "270",
    "303": "312",
    "617": "617",
    "614": "614",
    // 720p
    "22": "232",
    "136": "232",
    "298": "311",
    "311": "311",
    "232": "232",
    "247": "232",
    "302": "311",
    "612": "612",
    "609": "609",
    // 480p
    "135": "231",
    "244": "231",
    "231": "231",
    "606": "606",
    // 360p
    "18": "230",
    "134": "230",
    "243": "230",
    "230": "230",
    "605": "605",
    // 240p
    "133": "229",
    "242": "229",
    "229": "229",
    "604": "604",
    // 144p
    "160": "269",
    "278": "269",
    "269": "269",
    "603": "603",
  };

  const FORMAT_HEIGHT_MAP: Record<string, number> = {
    "625": 2160,
    "620": 1440,
    "401": 2160, "315": 2160, "313": 2160, "272": 2160,
    "400": 1440, "308": 1440, "271": 1440,
    "137": 1080, "299": 1080, "312": 1080, "270": 1080, "248": 1080, "303": 1080, "617": 1080, "614": 1080,
    "22": 720,   "136": 720,  "298": 720,  "311": 720,  "232": 720,  "247": 720,  "302": 720,  "612": 720,  "609": 720,
    "135": 480,  "244": 480,  "231": 480,  "606": 480,
    "18": 360,   "134": 360,  "243": 360,  "230": 360,  "605": 360,
    "133": 240,  "242": 240,  "229": 240,  "604": 240,
    "160": 144,  "278": 144,  "269": 144,  "603": 144,
  };

  let formatArg: string;
  if (isYouTube) {
    const targetHeight =
      (videoFormatId ? FORMAT_HEIGHT_MAP[videoFormatId] : undefined) ||
      (formatId?.match(/(\d+)p\b/i)?.[1] ? parseInt(formatId.match(/(\d+)p\b/i)![1], 10) : undefined);

    if (isAudio) {
      if (container === "weba" || container === "opus") {
        formatArg = rawFormatId
          ? `${rawFormatId}/ba[protocol^=m3u8]/ba[ext=webm]/251/250/249/ba/bestaudio/best`
          : "ba[protocol^=m3u8]/ba[ext=webm]/251/250/249/ba/bestaudio/best";
      } else {
        formatArg = rawFormatId
          ? `${rawFormatId}/ba[protocol^=m3u8]/234/233/140/ba[ext=m4a]/ba/bestaudio/best`
          : "ba[protocol^=m3u8]/234/233/140/ba[ext=m4a]/ba/bestaudio/best";
      }
    } else {
      const hlsId = videoFormatId ? HLS_MAP[videoFormatId] : undefined;
      const heightFilter = targetHeight ? `[height<=${targetHeight}]` : "";
      const isWebm = container === "webm";

      // Video candidates in priority order:
      // 1. Authorized HLS if available (for 1080p, 720p, etc.)
      // 2. Direct exact requested videoFormatId (e.g. 313 for 4K WebM, 401 for 4K MP4, 137 for 1080p MP4)
      const videoCandidates: string[] = [];
      if (hlsId) videoCandidates.push(hlsId);
      if (videoFormatId && !videoCandidates.includes(videoFormatId)) videoCandidates.push(videoFormatId);

      // Audio candidates (MUST prioritize HLS audio ba[protocol^=m3u8], 234, 233 to avoid 403 Forbidden)
      const audioCandidates = isWebm
        ? ["ba[protocol^=m3u8]", "234", "233", "ba[ext=webm]", "ba", "251", "250", "249"]
        : ["ba[protocol^=m3u8]", "234", "233", "140", "ba[ext=m4a]", "ba", "251"];

      const pairs: string[] = [];
      for (const v of videoCandidates) {
        for (const a of audioCandidates) {
          pairs.push(`${v}+${a}`);
        }
      }

      // Height-filtered generic fallbacks
      const minHeight = targetHeight
        ? (targetHeight >= 2160 ? 1440 : targetHeight >= 1440 ? 1080 : targetHeight >= 1080 ? 720 : targetHeight >= 720 ? 480 : 0)
        : 0;
      const minHeightFilter = minHeight > 0 ? `[height>=${minHeight}]` : "";

      if (isWebm) {
        pairs.push(
          `bestvideo${heightFilter}${minHeightFilter}[ext=webm]+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}[ext=webm]+bestaudio[ext=webm]`,
          `bestvideo${heightFilter}${minHeightFilter}[vcodec^=vp9]+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}+bestaudio`,
          `bv*${heightFilter}${minHeightFilter}+ba[protocol^=m3u8]`,
          `bv*${heightFilter}${minHeightFilter}+ba`
        );
      } else {
        pairs.push(
          `bestvideo${heightFilter}${minHeightFilter}[vcodec^=avc1]+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}[vcodec^=avc1]+bestaudio[ext=m4a]`,
          `bestvideo${heightFilter}${minHeightFilter}[ext=mp4]+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}+ba[protocol^=m3u8]`,
          `bestvideo${heightFilter}${minHeightFilter}+bestaudio`,
          `bv*${heightFilter}${minHeightFilter}+ba[protocol^=m3u8]`,
          `bv*${heightFilter}${minHeightFilter}+ba`
        );
      }

      if (!targetHeight) {
        pairs.push("bv*+ba");
      }

      formatArg = Array.from(new Set(pairs)).join("/");
    }
  } else {
    // Non-YouTube platforms (TikTok, Instagram, Twitter/X, Facebook, Snapchat, etc.)
    if (isAudio) {
      formatArg = "ba/bestaudio/best";
    } else if (rawFormatId && !rawFormatId.startsWith("direct")) {
      formatArg = `${rawFormatId}/bv*+ba/b/best`;
    } else {
      formatArg = "bv*+ba/b/best";
    }
  }

  const baseName = filename.replace(/\.[a-z0-9]+$/i, "");
  let contentType: string;
  let outFilename: string;

  if (container === "mp3") {
    contentType = "audio/mpeg";
    outFilename = `${baseName}.mp3`;
  } else if (container === "m4a") {
    contentType = "audio/mp4";
    outFilename = `${baseName}.m4a`;
  } else if (container === "weba" || container === "opus") {
    contentType = "audio/webm";
    outFilename = `${baseName}.weba`;
  } else if (container === "wav") {
    contentType = "audio/wav";
    outFilename = `${baseName}.wav`;
  } else if (container === "webm") {
    contentType = "video/webm";
    outFilename = `${baseName}.webm`;
  } else {
    contentType = "video/mp4";
    outFilename = `${baseName}.mp4`;
  }

  const cacheDir = resolve(tmpdir(), "cbdrop_cache");
  if (!existsSync(cacheDir)) {
    try { mkdirSync(cacheDir, { recursive: true }); } catch {}
  }

  const cacheKey = createHmac("sha256", secret()).update(`${canonicalUrl}_${formatArg}_${container}`).digest("hex").slice(0, 24);
  const targetExt = container === "weba" ? "webm" : container;
  const finalFilePath = resolve(cacheDir, `${cacheKey}.${targetExt}`);

  const targetTotal = expectedSize || 0;
  if (token) {
    activeDownloads.set(token, {
      token,
      filename: outFilename,
      container,
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: targetTotal,
      speed: 0,
      eta: 0,
      lastUpdated: Date.now(),
    });
  }

  const serveCompletedFile = (filePath: string, targetRes: Response) => {
    try {
      const stats = statSync(filePath);
      const totalSize = stats.size;
      const actualExt = filePath.split(".").pop()?.toLowerCase() || "mp4";
      const actualContentType =
        actualExt === "webm"
          ? "video/webm"
          : actualExt === "mkv"
          ? "video/x-matroska"
          : actualExt === "mp3"
          ? "audio/mpeg"
          : actualExt === "m4a"
          ? "audio/mp4"
          : "video/mp4";
      const effectiveFilename = outFilename.replace(/\.[a-z0-9]+$/i, `.${actualExt}`);

      const reqHeaders = (targetRes.req as any)?.headers || {};
      const rangeHeader = reqHeaders.range;
      if (rangeHeader) {
        const m = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
        if (m) {
          const start = parseInt(m[1], 10);
          const end = m[2] ? parseInt(m[2], 10) : totalSize - 1;
          if (start < totalSize) {
            const finalEnd = Math.min(end, totalSize - 1);
            const chunkSize = finalEnd - start + 1;
            targetRes.status(206)
              .setHeader("content-type", actualContentType)
              .setHeader("content-disposition", `attachment; filename="${effectiveFilename}"`)
              .setHeader("accept-ranges", "bytes")
              .setHeader("content-range", `bytes ${start}-${finalEnd}/${totalSize}`)
              .setHeader("content-length", String(chunkSize))
              .setHeader("cache-control", "private, max-age=3600");
            const stream = createReadStream(filePath, { start, end: finalEnd });
            stream.pipe(targetRes);
            return;
          }
        }
      }

      targetRes.status(200)
        .setHeader("content-type", actualContentType)
        .setHeader("content-disposition", `attachment; filename="${effectiveFilename}"`)
        .setHeader("content-length", String(totalSize))
        .setHeader("accept-ranges", "bytes")
        .setHeader("cache-control", "private, max-age=3600");

      let sentBytes = 0;
      const stream = createReadStream(filePath);
      stream.on("data", (chunk: string | Buffer) => {
        sentBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
        if (token) {
          updateDownloadProgress(token, {
            status: sentBytes >= totalSize ? "completed" : "downloading",
            downloadedBytes: sentBytes,
            totalBytes: totalSize,
          });
        }
      });
      stream.on("end", () => {
        if (token) {
          updateDownloadProgress(token, {
            status: "completed",
            downloadedBytes: totalSize,
            totalBytes: totalSize,
            speed: 0,
            eta: 0,
          });
        }
      });
      stream.pipe(targetRes);
    } catch (err) {
      console.error("[serveCompletedFile error]:", err);
      if (!targetRes.headersSent) {
        targetRes.status(500).send("Failed to stream completed file.");
      }
    }
  };

  // If already finished and cached on disk, serve immediately!
  if (existsSync(finalFilePath)) {
    try {
      const st = statSync(finalFilePath);
      if (st.size > 0) {
        serveCompletedFile(finalFilePath, res);
        return;
      }
    } catch {}
  }

  // If another request is currently downloading this same video to disk, wait for it!
  if (inProgressDownloads.has(cacheKey)) {
    inProgressDownloads.get(cacheKey)!
      .then((actualPath) => {
        if (!res.headersSent && !res.writableEnded) {
          serveCompletedFile(actualPath, res);
        }
      })
      .catch((err) => {
        if (!res.headersSent && !res.writableEnded) {
          res.status(502).send("Stream processing failed: " + err.message);
        }
      });
    return;
  }

  // Build yt-dlp arguments for disk download & merge
  const outTemplate = resolve(cacheDir, `${cacheKey}.%(ext)s`);
  const ytdlpArgs = [
    "--ffmpeg-location", ffmpegBin,
    "-f", formatArg,
    "--no-warnings",
    "--no-playlist",
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",
    "--retries", "10",
    "--retry-sleep", "linear=1::3",
    "--fragment-retries", "10",
  ];



  if (isYouTube) {
    ytdlpArgs.push("--extractor-args", "youtube:player_client=web_embedded,android");
  }

  if (cookiesPath) {
    ytdlpArgs.push("--cookies", cookiesPath);
  }

  if (isAudio) {
    ytdlpArgs.push("-x", "--audio-format", container === "weba" ? "opus" : container);
  } else {
    const mergeFormat = container === "webm" ? "mp4" : (container || "mp4");
    ytdlpArgs.push("--merge-output-format", mergeFormat);
  }

  ytdlpArgs.push("-o", outTemplate, canonicalUrl);
  console.log("[streamYouTubeWithYtDlp] formatArg:", formatArg, "cmd:", ytdlpArgs.join(" "));

  const downloadPromise = new Promise<string>((resolveJob, rejectJob) => {
    const ytdlp = spawn(ytdlpBin, ytdlpArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let ytdlpStderr = "";
    let lastTrackTime = Date.now();

    const parseProgress = (chunkStr: string) => {
      // Example: [download]  45.2% of  140.84MiB at    4.60MiB/s ETA 00:15
      const match = chunkStr.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?(\d+(?:\.\d+)?)\s*([KMG]iB)(?:\s+at\s+(\d+(?:\.\d+)?)\s*([KMG]iB\/s))?(?:\s+ETA\s+(\d+:\d+(?::\d+)?))?/i);
      if (match && token) {
        const percent = parseFloat(match[1]);
        const sizeVal = parseFloat(match[2]);
        const sizeUnit = match[3].toLowerCase();
        let total = sizeVal;
        if (sizeUnit === "kib") total *= 1024;
        else if (sizeUnit === "mib") total *= 1024 * 1024;
        else if (sizeUnit === "gib") total *= 1024 * 1024 * 1024;

        let speed = 0;
        if (match[4] && match[5]) {
          const spVal = parseFloat(match[4]);
          const spUnit = match[5].toLowerCase();
          if (spUnit.startsWith("kib")) speed = spVal * 1024;
          else if (spUnit.startsWith("mib")) speed = spVal * 1024 * 1024;
          else if (spUnit.startsWith("gib")) speed = spVal * 1024 * 1024 * 1024;
        }

        let etaSec = 0;
        if (match[6]) {
          const parts = match[6].split(":").map((p) => parseInt(p, 10));
          if (parts.length === 2) etaSec = parts[0] * 60 + parts[1];
          else if (parts.length === 3) etaSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        const downloaded = Math.round((percent / 100) * total);
        const now = Date.now();
        if (now - lastTrackTime >= 350) {
          updateDownloadProgress(token, {
            status: "downloading",
            downloadedBytes: downloaded,
            totalBytes: total,
            speed: Math.round(speed),
            eta: etaSec,
          });
          lastTrackTime = now;
        }
      }
    };

    ytdlp.stdout?.on("data", (chunk) => {
      parseProgress(chunk.toString());
    });

    ytdlp.stderr?.on("data", (chunk) => {
      const str = chunk.toString();
      ytdlpStderr += str;
      parseProgress(str);
    });

    ytdlp.on("error", (err) => {
      console.error("[yt-dlp error]:", err.message);
      if (token) updateDownloadProgress(token, { status: "error", error: err.message });
      rejectJob(err);
    });

    ytdlp.on("close", (code) => {
      if (code !== 0) {
        console.warn(`[yt-dlp process exited with code ${code}]:`, ytdlpStderr.slice(-500));
        const cleanError = ytdlpStderr
          .split("\n")
          .filter((l) => l.includes("ERROR:") || l.includes("error:"))
          .map((l) => l.replace(/.*ERROR:\s*/i, "").trim())
          .pop() || "Stream connection failed";
        if (token) updateDownloadProgress(token, { status: "error", error: cleanError });
        // Clean up any partial download files to prevent stale cache
        try {
          const partFiles = readdirSync(cacheDir).filter(f => f.startsWith(cacheKey));
          for (const pf of partFiles) {
            try { unlinkSync(resolve(cacheDir, pf)); } catch {}
          }
        } catch {}
        rejectJob(new Error(cleanError));
        return;
      }

      try {
        const files = readdirSync(cacheDir);
        const matching = files.filter((f) => f.startsWith(cacheKey) && !f.endsWith(".part") && !f.endsWith(".ytdl"));
        const found = matching.length > 0 ? resolve(cacheDir, matching[0]) : (existsSync(finalFilePath) ? finalFilePath : null);
        if (!found) {
          rejectJob(new Error("Completed file not found on disk."));
          return;
        }

        // If WebM container was requested, ensure the final file is true WebM with Opus audio
        if (container === "webm" && !found.endsWith(".webm")) {
          const webmTarget = resolve(cacheDir, `${cacheKey}.webm`);
          if (existsSync(webmTarget) && statSync(webmTarget).size > 0) {
            resolveJob(webmTarget);
            return;
          }
          console.log(`[streamYouTubeWithYtDlp] Remuxing to clean WebM (VP9 + Opus): ${found} -> ${webmTarget}`);
          const remuxArgs = [
            "-y",
            "-i", found,
            "-c:v", "copy",
            "-c:a", "libopus",
            "-b:a", "160k",
            webmTarget,
          ];
          const remux = spawn(ffmpegBin, remuxArgs, { stdio: ["ignore", "pipe", "pipe"] });
          let remuxStderr = "";
          remux.stderr?.on("data", (chunk) => { remuxStderr += chunk.toString(); });
          remux.on("close", (remuxCode) => {
            if (remuxCode === 0 && existsSync(webmTarget)) {
              try { unlinkSync(found); } catch {}
              resolveJob(webmTarget);
            } else {
              console.warn("[WebM remux failed, serving original]:", remuxStderr);
              resolveJob(found);
            }
          });
          return;
        }

        resolveJob(found);
      } catch (err) {
        rejectJob(err instanceof Error ? err : new Error("Failed to locate cached file."));
      }
    });

    res.on("close", () => {
      if (!res.writableEnded && token) {
        const state = activeDownloads.get(token);
        if (state && state.status !== "completed") {
          updateDownloadProgress(token, { status: "interrupted", speed: 0 });
        }
      }
    });
  });

  inProgressDownloads.set(cacheKey, downloadPromise);
  downloadPromise.catch(() => {});
  downloadPromise.finally(() => {
    inProgressDownloads.delete(cacheKey);
  });

  downloadPromise
    .then((filePath) => {
      if (!res.headersSent && !res.writableEnded) {
        serveCompletedFile(filePath, res);
      }
    })
    .catch((err) => {
      if (!res.headersSent && !res.writableEnded) {
        res.status(502).send("Stream extraction failed: " + err.message);
      }
    });
}

export function decodeZipToken(token: string): ZipDownloadPayload {
  const [tokenKey, signature] = token.split(".");
  const expected = tokenKey ? sign(tokenKey) : "";
  const providedBuffer = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  if (!tokenKey || !signature || providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new Error("Invalid download link.");
  }
  if (tokenKey.startsWith("zip_")) {
    const entry = zipPayloadCache.get(tokenKey);
    if (!entry) {
      throw new Error("This ZIP download link has expired or is invalid.");
    }
    return entry.payload;
  }
  const payload = JSON.parse(Buffer.from(tokenKey, "base64url").toString("utf8")) as ZipDownloadPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("This download link has expired.");
  }
  return payload;
}

export function registerDownloadProxy(app: Express) {
  const handleDownload = async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      const payload = decodeToken(token);
      const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
      const containerExt = (payload.container || "").toLowerCase();
      const fileExt = (payload.filename.split(".").pop() || "").toLowerCase();
      const isImage = IMAGE_EXTS.has(containerExt) || IMAGE_EXTS.has(fileExt) || (payload.formatId?.startsWith("img-") ?? false);

      const isYouTube =
        (payload.sourceUrl && (payload.sourceUrl.includes("youtube.com") || payload.sourceUrl.includes("youtu.be"))) ||
        (payload.url && payload.url.includes("googlevideo.com"));

      console.log(`[DOWNLOAD] Incoming request: formatId=${payload.formatId}, container=${payload.container}, isYouTube=${isYouTube}, isImage=${isImage}, method=${req.method}`);

      // Images (e.g., YouTube thumbnails/covers) should ALWAYS be handled by direct HTTP proxy
      if (isImage) {
        return await proxyHttpMedia(payload, req, res, token);
      }

      // YouTube downloads (with sourceUrl) must ALWAYS stream via yt-dlp to avoid macOS TLS -9806 and cipher blocks
      if (isYouTube && payload.sourceUrl) {
        return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, payload.container, token, payload.expectedSize);
      }

      // True MP3 audio conversion via libmp3lame for other sources
      if (payload.container === "mp3" && payload.sourceUrl && !payload.url.includes(".mp3")) {
        return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, "mp3", token, payload.expectedSize);
      }

      // Direct video + audio merge via ffmpeg for non-YouTube platforms (supports WebM VP9+Opus, MP4 H264+AAC)
      if (payload.audioUrl) {
        return mergeVideoAudioWithFfmpeg(payload, req, res, token);
      }

      if (payload.container === "hls" || payload.container === "dash") {
        return proxyManifestWithFfmpeg(payload, res);
      }

      // Direct video/audio streams (e.g. 4K direct stream, standalone audio)
      if (payload.url && !payload.url.startsWith("http://localhost")) {
        try {
          return await proxyHttpMedia(payload, req, res, token);
        } catch (proxyError) {
          console.warn("[DOWNLOAD] proxyHttpMedia failed, falling back to streaming with yt-dlp:", proxyError);
        }
      }

      // Stream with yt-dlp (handles authorized HLS and platform extractors)
      if (payload.sourceUrl) {
        return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, payload.container, token, payload.expectedSize);
      }
    } catch (error) {
      console.error("[handleDownload error]:", error);
      if (!res.headersSent) res.status(400).json({ error: error instanceof Error ? error.message : "Download failed." });
    }
  };

  app.get("/api/download/:token", handleDownload);
  if (typeof app.head === "function") {
    app.head("/api/download/:token", handleDownload);
  }

  app.get("/api/download-progress/:token", (req, res) => {
    cleanOldDownloads();
    const token = req.params.token;
    const progress = getDownloadProgress(token);
    if (!progress) {
      return res.json({
        token,
        status: "idle",
        downloadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        eta: 0,
        lastUpdated: Date.now(),
      });
    }
    return res.json(progress);
  });

  app.get("/api/download-info/:token", async (req, res) => {
    try {
      const payload = decodeToken(req.params.token);
      let totalBytes = payload.expectedSize || 0;
      if (!totalBytes && payload.url.startsWith("http")) {
        try {
          const probe = await fetch(payload.url, {
            method: "HEAD",
            headers: payload.headers,
            redirect: "follow",
          });
          const cLen = probe.headers.get("content-length");
          if (cLen) totalBytes = parseInt(cLen, 10);
        } catch {}
      }
      return res.json({
        filename: payload.filename,
        container: payload.container,
        totalBytes,
        resumable: true,
      });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Invalid token" });
    }
  });

  app.get("/api/download-zip/:token", async (req, res) => {
    try {
      const payload = decodeZipToken(req.params.token);
      res.status(200);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
      res.setHeader("Cache-Control", "no-store");

      const scriptPath = fileURLToPath(new URL("createZip.py", import.meta.url));
      const child = spawn("python3", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();

      child.stdout.pipe(res);
      child.stderr.on("data", (data) => {
        console.warn("[createZip]", data.toString().trim());
      });
      child.on("error", (err) => {
        console.error("[createZip process error]", err);
        if (!res.headersSent) res.status(500);
        res.end();
      });
      child.on("close", (code) => {
        if (code !== 0 && !res.writableEnded) res.end();
      });
      res.on("close", () => {
        if (!child.killed) child.kill("SIGTERM");
      });
    } catch (error) {
      if (!res.headersSent) res.status(400).json({ error: error instanceof Error ? error.message : "ZIP download failed." });
    }
  });
}
