import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { Express, Request, Response } from "express";

const spawnCalls: Array<{ bin: string; args: string[] }> = [];

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn((bin: any, args: any) => {
      spawnCalls.push({ bin: String(bin), args: args as string[] });
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stdout.pipe = vi.fn();
      child.stderr = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdin.write = vi.fn();
      child.stdin.end = vi.fn();
      child.killed = false;
      child.kill = vi.fn();
      return child;
    }),
  };
});

import {
  createDownloadProxyUrl,
  decodeToken,
  registerDownloadProxy,
  streamYouTubeWithYtDlp,
} from "./downloadProxy";

function createMockResponse() {
  const stream = new PassThrough();
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = "";
  const res = Object.assign(stream, {
    statusCode: 200,
    headersSent: false,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    send(data?: any) {
      body = data;
      this.headersSent = true;
      if (typeof data === "string") {
        stream.write(data);
      }
      stream.end();
      return this;
    },
    json(data: any) {
      headers["content-type"] = "application/json";
      body = data;
      this.headersSent = true;
      stream.write(JSON.stringify(data));
      stream.end();
      return this;
    },
    _getHeaders: () => headers,
    _getStatusCode: () => statusCode,
    _getBody: () => body,
  });
  return res;
}

function getDownloadHandler() {
  const routes: Record<string, (req: Request, res: Response) => Promise<void>> = {};
  const mockApp = {
    get: (path: string, handler: (req: Request, res: Response) => Promise<void>) => {
      routes[path] = handler;
    },
  } as unknown as Express;
  registerDownloadProxy(mockApp);
  return routes["/api/download/:token"];
}

describe("YouTube video and audio pipeline verification", () => {
  beforeEach(() => {
    spawnCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies 1080p MP4 YouTube downloads route to yt-dlp with authorized HLS format '270'", () => {
    const mockRes = createMockResponse();
    streamYouTubeWithYtDlp(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "137",
      "cbdrop-1080p.mp4",
      mockRes as unknown as Response,
      "mp4"
    );

    expect(spawnCalls.length).toBe(2);
    const [ytdlpCall, ffmpegCall] = spawnCalls;

    const fIdx = ytdlpCall.args.indexOf("-f");
    expect(fIdx).toBeGreaterThanOrEqual(0);
    const formatArg = ytdlpCall.args[fIdx + 1];
    expect(formatArg).toMatch(/^270\+/);
    expect(formatArg).toContain("137+");
    expect(formatArg).not.toContain("/18/");
    expect(formatArg).toContain("[height<=1080]");

    // ffmpeg converts/muxes video into MP4 with default_base_moof for Finder QuickLook compatibility
    expect(ffmpegCall.args).toContain("-c:v");
    expect(ffmpegCall.args).toContain("copy");
    expect(ffmpegCall.args).toContain("-c:a");
    expect(ffmpegCall.args).toContain("aac");
    const movflagsIdx = ffmpegCall.args.indexOf("-movflags");
    expect(movflagsIdx).toBeGreaterThanOrEqual(0);
    expect(ffmpegCall.args[movflagsIdx + 1]).toContain("default_base_moof");
  });

  it("verifies 720p MP4 YouTube downloads route to yt-dlp with authorized HLS format '232'", () => {
    const mockRes = createMockResponse();
    streamYouTubeWithYtDlp(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "136",
      "cbdrop-720p.mp4",
      mockRes as unknown as Response,
      "mp4"
    );

    expect(spawnCalls.length).toBe(2);
    const [ytdlpCall, ffmpegCall] = spawnCalls;

    const fIdx = ytdlpCall.args.indexOf("-f");
    expect(fIdx).toBeGreaterThanOrEqual(0);
    const formatArg = ytdlpCall.args[fIdx + 1];
    expect(formatArg).toMatch(/^232\+/);
    expect(formatArg).toContain("136+");
    expect(formatArg).not.toContain("/18/");
    expect(formatArg).toContain("[height<=720]");
    const movflagsIdx = ffmpegCall.args.indexOf("-movflags");
    expect(movflagsIdx).toBeGreaterThanOrEqual(0);
    expect(ffmpegCall.args[movflagsIdx + 1]).toContain("default_base_moof");
  });

  it("verifies additional resolutions (480p, 360p, 240p, 144p, 1440p, 4K) map to their HLS equivalents", () => {
    const testCases: Record<string, string> = {
      "135": "231", // 480p
      "134": "230", // 360p
      "133": "229", // 240p
      "160": "269", // 144p
      "400": "620", // 1440p
      "401": "625", // 4K
      "313": "625", // 4K webm
    };

    for (const [dashId, expectedHlsId] of Object.entries(testCases)) {
      spawnCalls.length = 0;
      const mockRes = createMockResponse();
      streamYouTubeWithYtDlp(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        dashId,
        "video.mp4",
        mockRes as unknown as Response,
        "mp4"
      );

      const [ytdlpCall] = spawnCalls;
      const fIdx = ytdlpCall.args.indexOf("-f");
      const formatArg = ytdlpCall.args[fIdx + 1];
      expect(formatArg.startsWith(`${expectedHlsId}+`)).toBe(true);
      expect(formatArg).toContain(`${dashId}+`);
    }
  });

  it("verifies YouTube audio downloads route to yt-dlp with container 'm4a' and 'mp3'", () => {
    // 1. M4A
    const mockResM4a = createMockResponse();
    streamYouTubeWithYtDlp(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "140",
      "cbdrop-audio.m4a",
      mockResM4a as unknown as Response,
      "m4a"
    );

    expect(spawnCalls.length).toBe(2);
    const [ytdlpM4a, ffmpegM4a] = spawnCalls;
    const fIdxM4a = ytdlpM4a.args.indexOf("-f");
    expect(ytdlpM4a.args[fIdxM4a + 1]).toContain("234");
    expect(ytdlpM4a.args[fIdxM4a + 1]).toContain("140");
    expect(ffmpegM4a.args).toContain("aac");
    expect(ffmpegM4a.args).toContain("-vn");

    // 2. MP3
    spawnCalls.length = 0;
    const mockResMp3 = createMockResponse();
    streamYouTubeWithYtDlp(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "140",
      "cbdrop-audio.mp3",
      mockResMp3 as unknown as Response,
      "mp3"
    );

    expect(spawnCalls.length).toBe(2);
    const [ytdlpMp3, ffmpegMp3] = spawnCalls;
    const fIdxMp3 = ytdlpMp3.args.indexOf("-f");
    expect(ytdlpMp3.args[fIdxMp3 + 1]).toContain("234");
    expect(ffmpegMp3.args).toContain("libmp3lame");
    expect(ffmpegMp3.args).toContain("-vn");
  });

  it("verifies endpoint routing: YouTube video and audio route to streamYouTubeWithYtDlp, while image downloads bypass to HTTP proxy", async () => {
    const handler = getDownloadHandler();

    // 1. YouTube video
    const ytVideoToken = createDownloadProxyUrl(
      "https://rr1---sn-video.googlevideo.com/v.mp4",
      "cbdrop-video.mp4",
      "mp4",
      undefined,
      undefined,
      undefined,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "137"
    ).replace("/api/download/", "");

    const reqVideo = { params: { token: ytVideoToken }, headers: {} } as unknown as Request;
    const resVideo = createMockResponse();
    await handler(reqVideo, resVideo as unknown as Response);

    expect(spawnCalls.length).toBe(2); // yt-dlp + ffmpeg
    expect(spawnCalls[0].args).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(spawnCalls[0].args.join(" ")).toContain("270+");

    // 2. YouTube audio
    spawnCalls.length = 0;
    const ytAudioToken = createDownloadProxyUrl(
      "https://rr1---sn-audio.googlevideo.com/a.m4a",
      "cbdrop-audio.m4a",
      "m4a",
      undefined,
      undefined,
      undefined,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "140"
    ).replace("/api/download/", "");

    const reqAudio = { params: { token: ytAudioToken }, headers: {} } as unknown as Request;
    const resAudio = createMockResponse();
    await handler(reqAudio, resAudio as unknown as Response);

    expect(spawnCalls.length).toBe(2);
    expect(spawnCalls[0].args).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(spawnCalls[1].args).toContain("aac");

    // 3. YouTube cover image (must NOT route to streamYouTubeWithYtDlp!)
    spawnCalls.length = 0;
    const mockImageBody = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("image-data"));
        c.close();
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg", "content-length": "10" }),
      body: mockImageBody,
    } as unknown as globalThis.Response);

    const ytCoverToken = createDownloadProxyUrl(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
      "cover.jpg",
      "jpg",
      undefined,
      undefined,
      undefined,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "img-maxresdefault"
    ).replace("/api/download/", "");

    const reqCover = { params: { token: ytCoverToken }, headers: {} } as unknown as Request;
    const resCover = createMockResponse();
    await handler(reqCover, resCover as unknown as Response);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spawnCalls.length).toBe(0); // Zero yt-dlp/ffmpeg spawns
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resCover._getStatusCode()).toBe(200);
    expect(resCover.getHeader("content-type")).toBe("image/jpeg");
    expect(resCover.getHeader("content-disposition")).toBe('attachment; filename="cover.jpg"');
  });

  it("verifies non-YouTube downloads route to ffmpeg merge or direct streaming", async () => {
    const handler = getDownloadHandler();

    // 1. Non-YouTube video with separate audio stream -> calls mergeVideoAudioWithFfmpeg
    const nonYtMergeToken = createDownloadProxyUrl(
      "https://v16-webapp-prime.tiktok.com/video.mp4",
      "cbdrop-tiktok.mp4",
      "mp4",
      { Referer: "https://www.tiktok.com/" },
      "https://sf16-ies-music.tiktokcdn.com/audio.mp3",
      { Referer: "https://www.tiktok.com/" },
      "https://www.tiktok.com/@user/video/123",
      "play_addr"
    ).replace("/api/download/", "");

    const reqMerge = { params: { token: nonYtMergeToken }, headers: {} } as unknown as Request;
    const resMerge = createMockResponse();
    await handler(reqMerge, resMerge as unknown as Response);

    expect(spawnCalls.length).toBe(1); // 1 ffmpeg merge process spawned
    expect(spawnCalls[0].args).toContain("-i");
    expect(spawnCalls[0].args).toContain("https://v16-webapp-prime.tiktok.com/video.mp4");
    expect(spawnCalls[0].args).toContain("https://sf16-ies-music.tiktokcdn.com/audio.mp3");
    expect(spawnCalls[0].args).toContain("-map");

    // 2. Non-YouTube direct progressive video -> proxies via proxyHttpMedia (no ffmpeg spawn)
    spawnCalls.length = 0;
    const mockVideoBody = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("video-data"));
        c.close();
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "video/mp4", "content-length": "10" }),
      body: mockVideoBody,
    } as unknown as globalThis.Response);

    const directVideoToken = createDownloadProxyUrl(
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      "BigBuckBunny.mp4",
      "mp4"
    ).replace("/api/download/", "");

    const reqDirect = { params: { token: directVideoToken }, headers: {} } as unknown as Request;
    const resDirect = createMockResponse();
    await handler(reqDirect, resDirect as unknown as Response);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spawnCalls.length).toBe(0); // Zero child process spawns
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resDirect._getStatusCode()).toBe(200);
    expect(resDirect.getHeader("content-type")).toBe("video/mp4");
    expect(resDirect.getHeader("content-disposition")).toBe('attachment; filename="BigBuckBunny.mp4"');

    // 3. Non-YouTube progressive video where upstream returns 403 (e.g. TikTok CDN blocks fetch) -> automatically falls back to yt-dlp streaming
    spawnCalls.length = 0;
    fetchSpy.mockResolvedValue({
      status: 403,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as globalThis.Response);

    const tiktokBlockedToken = createDownloadProxyUrl(
      "https://v16-webapp4prime.tiktok.com/video.mp4",
      "cbdrop-tiktok.mp4",
      "mp4",
      { Referer: "https://www.tiktok.com/@user/video/123" },
      undefined,
      undefined,
      "https://www.tiktok.com/@user/video/123",
      "h264_540p_426576-0"
    ).replace("/api/download/", "");

    const reqBlocked = { params: { token: tiktokBlockedToken }, headers: {} } as unknown as Request;
    const resBlocked = createMockResponse();
    await handler(reqBlocked, resBlocked as unknown as Response);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify yt-dlp was spawned as fallback
    expect(spawnCalls.length).toBeGreaterThanOrEqual(1);
    expect(spawnCalls.some((c) => c.args.includes("https://www.tiktok.com/@user/video/123"))).toBe(true);
  });
});
