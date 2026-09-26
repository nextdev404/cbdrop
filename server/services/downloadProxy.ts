import { existsSync, createReadStream, createWriteStream, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { Readable, Transform } from "node:stream";
import { spawn } from "node:child_process";
import { getCookiesPath, getExecutablePath } from "../extractors/ytdlp";

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
    "-movflags", "frag_keyframe+empty_moov",
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
  const outFilename = `${baseName}.mp4`;

  // Local temp disk cache for resumable range requests
  const cacheDir = resolve(tmpdir(), "cbdrop_cache");
  if (!existsSync(cacheDir)) {
    try { mkdirSync(cacheDir, { recursive: true }); } catch {}
  }
  const cacheKey = createHmac("sha256", secret()).update(`${payload.url}_${payload.audioUrl || ""}`).digest("hex").slice(0, 24);
  const cachePath = resolve(cacheDir, `${cacheKey}.mp4`);

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
              .setHeader("content-type", "video/mp4")
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

  // Check if audio stream is AAC or M4A for zero-overhead copy, otherwise convert audio to AAC
  const isAacAudio =
    (payload.audioUrl || "").includes(".m4a") ||
    (payload.audioUrl || "").includes("mime=audio%2Fmp4");
  const audioCodecArgs = isAacAudio
    ? ["-c:a", "copy"]
    : ["-c:a", "aac", "-b:a", "192k"];

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
    "-movflags", "frag_keyframe+empty_moov",
    "-f", "mp4",
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

export function streamYouTubeWithYtDlp(
  sourceUrl: string,
  formatId: string | undefined,
  filename: string,
  res: Response,
  container = "mp4",
  token?: string,
  expectedSize?: number
) {
  const ytdlpBin = getExecutablePath();
  const ffmpegBin = getFfmpegPath();
  const cookiesPath = getCookiesPath();

  const isAudio = container === "m4a" || container === "mp3";
  const rawFormatId = formatId ? formatId.replace(/^extractor-/, "").replace(/-direct$/, "") : undefined;

  // Map DASH format IDs to HLS equivalents which are authorized and do not trigger 403
  const HLS_MAP: Record<string, string> = {
    "137": "270", // 1080p
    "136": "232", // 720p
    "135": "231", // 480p
    "134": "230", // 360p
    "133": "229", // 240p
    "160": "269", // 144p
    "400": "620", // 1440p (2K)
    "271": "620", // 1440p (2K)
    "401": "625", // 2160p (4K)
    "313": "625", // 2160p (4K)
    "620": "620", // 1440p (2K)
    "625": "625", // 2160p (4K)
    "270": "270", // 1080p
    "232": "232", // 720p
    "231": "231", // 480p
    "230": "230", // 360p
    "229": "229", // 240p
    "269": "269", // 144p
    "248": "270", // 1080p
    "247": "232", // 720p
    "244": "231", // 480p
    "243": "230", // 360p
    "242": "229", // 240p
  };

  // YouTube HLS AAC audio streams (itag 234 / 233, including language suffixed like 234-13)
  // are authorized via manifest and bypass all 403 blocks.
  const HLS_AUDIO = "234/233/bestaudio[protocol^=m3u8]/bestaudio[ext=m4a]/bestaudio/best";

  const isYouTube = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
  let formatArg: string;
  if (isYouTube) {
    if (isAudio) {
      formatArg = rawFormatId
        ? `${rawFormatId}/${HLS_AUDIO}/ba/bestaudio/best`
        : `${HLS_AUDIO}/ba/bestaudio/best`;
    } else if (rawFormatId) {
      const hlsId = HLS_MAP[rawFormatId];
      if (hlsId && hlsId !== rawFormatId) {
        formatArg = `${hlsId}+${HLS_AUDIO}/${rawFormatId}+${HLS_AUDIO}/18/bv*+ba/b/best`;
      } else {
        formatArg = `${rawFormatId}+${HLS_AUDIO}/18/bv*+ba/b/best`;
      }
    } else {
      formatArg = `270+${HLS_AUDIO}/232+${HLS_AUDIO}/18/bv*+ba/b/best`;
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

  const ytdlpArgs = [
    "--ffmpeg-location", ffmpegBin,
    "-f", formatArg,
    "--no-warnings",
    "--no-playlist",
    "--js-runtimes", "node",
    "--remote-components", "ejs:github",
  ];

  if (isYouTube) {
    ytdlpArgs.push("--extractor-args", "youtube:player_client=android,web");
  }

  if (cookiesPath) {
    ytdlpArgs.push("--cookies", cookiesPath);
  }

  ytdlpArgs.push("-o", "-", sourceUrl);
  console.log("[streamYouTubeWithYtDlp] formatArg:", formatArg, "cmd:", ytdlpArgs.join(" "));

  const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
  if (IMAGE_EXTS.has((container || "").toLowerCase()) || IMAGE_EXTS.has((filename.split(".").pop() || "").toLowerCase())) {
    res.status(400).send("Images cannot be processed by video streaming pipeline.");
    return;
  }

  const baseName = filename.replace(/\.[a-z0-9]+$/i, "");
  let ffmpegArgs: string[];
  let contentType: string;
  let outFilename: string;

  if (container === "mp3") {
    contentType = "audio/mpeg";
    outFilename = `${baseName}.mp3`;
    ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-f", "mp3",
      "pipe:1",
    ];
  } else if (container === "m4a") {
    contentType = "audio/mp4";
    outFilename = `${baseName}.m4a`;
    ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "frag_keyframe+empty_moov",
      "-f", "mp4",
      "pipe:1",
    ];
  } else if (container === "webm") {
    contentType = "video/webm";
    outFilename = `${baseName}.webm`;
    ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-c:v", "copy",
      "-c:a", "copy",
      "-f", "webm",
      "pipe:1",
    ];
  } else {
    contentType = "video/mp4";
    outFilename = `${baseName}.mp4`;
    ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "frag_keyframe+empty_moov",
      "-f", "mp4",
      "pipe:1",
    ];
  }

  const ytdlp = spawn(ytdlpBin, ytdlpArgs, { stdio: ["ignore", "pipe", "pipe"] });
  const ffmpeg = spawn(ffmpegBin, ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });

  ytdlp.stdout.on("error", () => {});
  ffmpeg.stdin.on("error", () => {});
  ffmpeg.stdout.on("error", () => {});

  ytdlp.stdout.pipe(ffmpeg.stdin);

  let headersSent = false;
  let ytdlpStderr = "";
  let ffmpegStderr = "";
  let deliveredBytes = 0;
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

  let lastTrackTime = Date.now();
  let bytesSinceLastTrack = 0;

  ytdlp.stderr.on("data", (chunk) => {
    ytdlpStderr += chunk.toString();
  });

  ffmpeg.stderr.on("data", (chunk) => {
    ffmpegStderr += chunk.toString();
  });

  ffmpeg.stdout.on("data", (chunk: Buffer) => {
    deliveredBytes += chunk.length;
    bytesSinceLastTrack += chunk.length;
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

  ffmpeg.stdout.once("data", (firstChunk) => {
    headersSent = true;
    res.status(200)
      .setHeader("content-type", contentType)
      .setHeader("content-disposition", `attachment; filename="${outFilename}"`)
      .setHeader("accept-ranges", "bytes")
      .setHeader("cache-control", "private, max-age=3600");
    res.write(firstChunk);
    ffmpeg.stdout.pipe(res);
  });

  const cleanup = () => {
    if (!ytdlp.killed) ytdlp.kill("SIGTERM");
    if (!ffmpeg.killed) ffmpeg.kill("SIGTERM");
  };

  ytdlp.on("error", (err) => {
    console.error("[yt-dlp stream error]:", err.message);
    cleanup();
    if (token) updateDownloadProgress(token, { status: "error", error: err.message });
    if (!headersSent && !res.headersSent) {
      res.status(502).send("Unable to start media stream: " + err.message);
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  ffmpeg.on("error", (err) => {
    console.error("[ffmpeg stream error]:", err.message);
    cleanup();
    if (token) updateDownloadProgress(token, { status: "error", error: err.message });
    if (!headersSent && !res.headersSent) {
      res.status(502).send("Unable to process media stream: " + err.message);
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  ytdlp.on("close", (code) => {
    if (code !== 0) {
      console.warn(`[yt-dlp stream process exited with code ${code}]:`, ytdlpStderr.slice(-500));
      if (token) updateDownloadProgress(token, { status: "error", error: ytdlpStderr.trim() || `exit ${code}` });
      if (!headersSent && !res.headersSent) {
        res.status(502).send("Stream extraction failed: " + (ytdlpStderr.trim() || `exit code ${code}`));
      }
    }
  });

  ffmpeg.on("close", (code) => {
    if (code !== 0) {
      console.warn(`[ffmpeg stream process exited with code ${code}]:`, ffmpegStderr.slice(-500));
      if (token) updateDownloadProgress(token, { status: "error", error: ffmpegStderr.trim() || `exit ${code}` });
      if (!headersSent && !res.headersSent) {
        res.status(502).send("Stream processing failed: " + (ffmpegStderr.trim() || `exit code ${code}`));
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
    cleanup();
    if (!res.writableEnded && token) {
      const state = activeDownloads.get(token);
      if (state && state.status !== "completed") {
        updateDownloadProgress(token, { status: "interrupted", speed: 0 });
      }
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

      // YouTube video and audio should ALWAYS route through streamYouTubeWithYtDlp using authorized HLS
      // to avoid Google Video 403 Forbidden datacenter blocks
      if (isYouTube && payload.sourceUrl) {
        return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, payload.container, token, payload.expectedSize);
      }

      if (payload.audioUrl) {
        return mergeVideoAudioWithFfmpeg(payload, req, res, token);
      }

      if (payload.container === "hls" || payload.container === "dash") {
        return proxyManifestWithFfmpeg(payload, res);
      }

      try {
        await proxyHttpMedia(payload, req, res, token);
      } catch (proxyError) {
        if (payload.sourceUrl && !res.headersSent) {
          console.warn("[DOWNLOAD] proxyHttpMedia failed, falling back to streaming with yt-dlp:", proxyError);
          return streamYouTubeWithYtDlp(payload.sourceUrl, payload.formatId, payload.filename, res, payload.container, token, payload.expectedSize);
        }
        throw proxyError;
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
