import { afterEach, describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
import type { Express, Request, Response } from "express";
import {
  createDownloadProxyUrl,
  createZipDownloadUrl,
  decodeToken,
  decodeZipToken,
  getFfmpegPath,
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

function createMockFetchResponse({
  status = 200,
  ok = true,
  contentType = "image/jpeg",
  bodyText = "mock-image-bytes",
}: {
  status?: number;
  ok?: boolean;
  contentType?: string;
  bodyText?: string;
} = {}) {
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("content-length", String(bodyText.length));

  if (!ok) {
    return {
      status,
      ok: false,
      body: null,
      headers,
    } as unknown as globalThis.Response;
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(bodyText));
      controller.close();
    },
  });

  return {
    status,
    ok: true,
    body: stream,
    headers,
  } as unknown as globalThis.Response;
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

describe("download proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a relative signed URL without exposing the upstream source URL", () => {
    const source = "https://cdn.example.com/video?id=opaque-token";
    const proxy = createDownloadProxyUrl(source, "my clip.mp4", "mp4");
    expect(proxy).toMatch(/^\/api\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(proxy).not.toContain("cdn.example.com");
    expect(proxy).not.toContain("opaque-token");
  });

  it("creates a signed URL for Snapchat CDN with Snapchat headers", () => {
    const source = "https://bolt-gcdn.sc-cdn.net/video.mp4?token=123";
    const proxy = createDownloadProxyUrl(source, "snapchat-snap.mp4", "mp4", {
      Referer: "https://www.snapchat.com/",
    });
    expect(proxy).toMatch(/^\/api\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const [encoded] = proxy.replace("/api/download/", "").split(".");
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded.url).toBe(source);
    expect(decoded.headers?.Referer).toBe("https://www.snapchat.com/");
  });

  it("creates a signed URL for image downloads with image container format", () => {
    const source = "https://cdn.example.com/image.jpg";
    const proxy = createDownloadProxyUrl(source, "photo.jpg", "jpg");
    expect(proxy).toMatch(/^\/api\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const [encoded] = proxy.replace("/api/download/", "").split(".");
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded.url).toBe(source);
    expect(decoded.filename).toBe("photo.jpg");
    expect(decoded.container).toBe("jpg");
  });

  it("attaches platform referers for Instagram, TikTok, X, and Facebook CDNs", () => {
    const igProxy = createDownloadProxyUrl("https://scontent.cdninstagram.com/image.jpg", "photo.jpg", "jpg", {
      Referer: "https://www.instagram.com/",
    });
    const [igEncoded] = igProxy.replace("/api/download/", "").split(".");
    const igDecoded = JSON.parse(Buffer.from(igEncoded, "base64url").toString("utf8"));
    expect(igDecoded.headers?.Referer).toBe("https://www.instagram.com/");

    const ttProxy = createDownloadProxyUrl("https://p16-sign.tiktokcdn.com/image.webp", "slide.webp", "webp", {
      Referer: "https://www.tiktok.com/",
    });
    const [ttEncoded] = ttProxy.replace("/api/download/", "").split(".");
    const ttDecoded = JSON.parse(Buffer.from(ttEncoded, "base64url").toString("utf8"));
    expect(ttDecoded.headers?.Referer).toBe("https://www.tiktok.com/");

    const xProxy = createDownloadProxyUrl("https://pbs.twimg.com/media/pic.jpg", "tweet.jpg", "jpg", {
      Referer: "https://x.com/",
    });
    const [xEncoded] = xProxy.replace("/api/download/", "").split(".");
    const xDecoded = JSON.parse(Buffer.from(xEncoded, "base64url").toString("utf8"));
    expect(xDecoded.headers?.Referer).toBe("https://x.com/");
  });

  it("creates a signed ZIP download URL containing all specified images", async () => {
    const images = [
      { url: "https://p16-sign.tiktokcdn.com/img1.jpg", filename: "image-1.jpg" },
      { url: "https://p16-sign.tiktokcdn.com/img2.jpg", filename: "image-2.jpg" },
      { url: "https://p16-sign.tiktokcdn.com/img3.jpg", filename: "image-3.jpg" },
    ];
    const zipUrl = createZipDownloadUrl("tiktok-slideshow.zip", images);
    expect(zipUrl).toMatch(/^\/api\/download-zip\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const token = zipUrl.replace("/api/download-zip/", "");
    const decoded = decodeZipToken(token);
    expect(decoded.filename).toBe("tiktok-slideshow.zip");
    expect(decoded.images).toHaveLength(3);
    expect(decoded.images[0].filename).toBe("image-1.jpg");
    expect(decoded.images[1].filename).toBe("image-2.jpg");
    expect(decoded.images[2].filename).toBe("image-3.jpg");
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("creates a signed URL for video with paired audioUrl for ffmpeg merging", () => {
    const videoUrl = "https://rr1---sn-video.googlevideo.com/videoplayback?id=123";
    const audioUrl = "https://rr1---sn-audio.googlevideo.com/videoplayback?id=456";
    const proxy = createDownloadProxyUrl(
      videoUrl,
      "cbdrop-youtube.mp4",
      "mp4",
      { Referer: "https://www.youtube.com/" },
      audioUrl,
      { Referer: "https://www.youtube.com/" }
    );
    expect(proxy).toMatch(/^\/api\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const [encoded] = proxy.replace("/api/download/", "").split(".");
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    expect(decoded.url).toBe(videoUrl);
    expect(decoded.audioUrl).toBe(audioUrl);
    expect(decoded.filename).toBe("cbdrop-youtube.mp4");
  });

  it("finds a valid ffmpeg binary path via getFfmpegPath", () => {
    const ffmpegPath = getFfmpegPath();
    expect(ffmpegPath).toBeTruthy();
    expect(typeof ffmpegPath).toBe("string");
  });

  it("stores sourceUrl and formatId in token for YouTube downloads", () => {
    const cdnUrl = "https://rr1---sn-video.googlevideo.com/videoplayback?id=123";
    const ytUrl = "https://youtu.be/CN6BhyERbas";
    const proxy = createDownloadProxyUrl(
      cdnUrl,
      "cbdrop-youtube.mp4",
      "mp4",
      undefined,
      undefined,
      undefined,
      ytUrl,
      "400"
    );
    const token = proxy.replace("/api/download/", "");
    const decoded = decodeToken(token);
    expect(decoded.url).toBe(cdnUrl);
    expect(decoded.sourceUrl).toBe(ytUrl);
    expect(decoded.formatId).toBe("400");
    expect(decoded.filename).toBe("cbdrop-youtube.mp4");
  });

  describe("YouTube cover and social image downloads", () => {
    it("verifies a YouTube cover download with sourceUrl and filename cover.jpg is identified as an image with matching token fields", () => {
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const cdnUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";
      const proxy = createDownloadProxyUrl(
        cdnUrl,
        "cover.jpg",
        "jpg",
        { Referer: "https://www.youtube.com/" },
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );

      expect(proxy).toMatch(/^\/api\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      const token = proxy.replace("/api/download/", "");
      const decoded = decodeToken(token);

      // Verify token contains container 'jpg', filename 'cover.jpg', sourceUrl and formatId
      expect(decoded.container).toBe("jpg");
      expect(decoded.filename).toBe("cover.jpg");
      expect(decoded.sourceUrl).toBe(ytUrl);
      expect(decoded.url).toBe(cdnUrl);
      expect(decoded.formatId).toBe("img-cover");

      // Verify image detection logic mirrors server/services/downloadProxy.ts
      const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
      const containerExt = (decoded.container || "").toLowerCase();
      const fileExt = (decoded.filename.split(".").pop() || "").toLowerCase();
      const isImage = IMAGE_EXTS.has(containerExt) || IMAGE_EXTS.has(fileExt) || (decoded.formatId?.startsWith("img-") ?? false);

      expect(isImage).toBe(true);
      expect(IMAGE_EXTS.has(containerExt)).toBe(true);
      expect(IMAGE_EXTS.has(fileExt)).toBe(true);
      expect(decoded.formatId?.startsWith("img-")).toBe(true);
    });

    it("identifies image downloads across container formats (jpg, jpeg, png, webp) and formatId patterns", () => {
      const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
      const testCases = [
        { container: "jpg", filename: "cover.jpg", formatId: "img-0", isImageExpected: true },
        { container: "jpeg", filename: "cover.jpeg", formatId: "img-cover", isImageExpected: true },
        { container: "png", filename: "thumbnail.png", formatId: "img-thumbnail", isImageExpected: true },
        { container: "webp", filename: "cover.webp", formatId: "img-highres", isImageExpected: true },
        { container: "mp4", filename: "cover.jpg", formatId: undefined, isImageExpected: true },
        { container: "jpg", filename: "cbdrop-output", formatId: undefined, isImageExpected: true },
        { container: "mp4", filename: "video.mp4", formatId: "img-snapshot", isImageExpected: true },
        { container: "mp4", filename: "video.mp4", formatId: "137", isImageExpected: false },
        { container: "m4a", filename: "audio.m4a", formatId: "140", isImageExpected: false },
      ];

      for (const tc of testCases) {
        const proxy = createDownloadProxyUrl(
          "https://i.ytimg.com/vi/test123/maxresdefault.jpg",
          tc.filename,
          tc.container,
          undefined,
          undefined,
          undefined,
          "https://www.youtube.com/watch?v=test123",
          tc.formatId
        );
        const decoded = decodeToken(proxy.replace("/api/download/", ""));
        const containerExt = (decoded.container || "").toLowerCase();
        const fileExt = (decoded.filename.split(".").pop() || "").toLowerCase();
        const isImage = IMAGE_EXTS.has(containerExt) || IMAGE_EXTS.has(fileExt) || (decoded.formatId?.startsWith("img-") ?? false);
        expect(isImage).toBe(tc.isImageExpected);
      }
    });

    it("ensures YouTube cover downloads are not routed to streamYouTubeWithYtDlp and filename is never renamed to cover.mp4", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const cdnUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";

      const proxy = createDownloadProxyUrl(
        cdnUrl,
        "cover.jpg",
        "jpg",
        { Referer: "https://www.youtube.com/" },
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        createMockFetchResponse({
          status: 200,
          contentType: "image/jpeg",
          bodyText: "mock-jpg-cover-content",
        })
      );

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      // Verify proxyHttpMedia served the image directly, NOT streamYouTubeWithYtDlp
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res._getStatusCode()).toBe(200);

      // Verify content-disposition retains cover.jpg and is NEVER renamed to cover.mp4
      const disposition = res.getHeader("content-disposition");
      expect(disposition).toBe('attachment; filename="cover.jpg"');
      expect(disposition).not.toContain("cover.mp4");

      // Verify content-type is image/jpeg
      expect(res.getHeader("content-type")).toBe("image/jpeg");
      expect(res.getHeader("content-type")).not.toContain("video");
    });

    it("ensures image downloads with container png, webp, and jpeg maintain proper filenames and are never renamed to mp4", async () => {
      const handler = getDownloadHandler();
      const formats = [
        { container: "png", filename: "cover.png", mime: "image/png", expectedFile: "cover.png" },
        { container: "webp", filename: "cover.webp", mime: "image/webp", expectedFile: "cover.webp" },
        { container: "jpeg", filename: "cover.jpeg", mime: "image/jpeg", expectedFile: "cover.jpeg" },
      ];

      for (const fmt of formats) {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
          createMockFetchResponse({
            status: 200,
            contentType: fmt.mime,
            bodyText: `data-${fmt.container}`,
          })
        );

        const proxy = createDownloadProxyUrl(
          `https://i.ytimg.com/vi/test123/cover.${fmt.container}`,
          fmt.filename,
          fmt.container,
          undefined,
          undefined,
          undefined,
          "https://www.youtube.com/watch?v=test123",
          `img-${fmt.container}`
        );
        const token = proxy.replace("/api/download/", "");

        const req = { params: { token }, headers: {} } as unknown as Request;
        const res = createMockResponse();

        await handler(req, res as unknown as Response);
        await new Promise((resolve) => {
          res.on("finish", resolve);
          setTimeout(resolve, 50);
        });

        expect(res._getStatusCode()).toBe(200);
        expect(res.getHeader("content-disposition")).toBe(`attachment; filename="${fmt.expectedFile}"`);
        expect(res.getHeader("content-disposition")).not.toContain(".mp4");
        expect(res.getHeader("content-type")).toBe(fmt.mime);
      }
    });

    it("normalizes filename to image extension when an image payload erroneously had an .mp4 filename", async () => {
      const handler = getDownloadHandler();
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        createMockFetchResponse({
          status: 200,
          contentType: "image/jpeg",
          bodyText: "mock-image-bytes",
        })
      );

      // Erroneous filename with .mp4 extension but container is 'jpg' and formatId 'img-cover'
      const proxy = createDownloadProxyUrl(
        "https://i.ytimg.com/vi/test123/maxresdefault.jpg",
        "cover.mp4",
        "jpg",
        undefined,
        undefined,
        undefined,
        "https://www.youtube.com/watch?v=test123",
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(res._getStatusCode()).toBe(200);
      // proxyHttpMedia correctly detects image and replaces .mp4 with .jpg
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="cover.jpg"');
      expect(res.getHeader("content-type")).toBe("image/jpeg");
    });

    it("streamYouTubeWithYtDlp explicitly rejects image requests with HTTP 400 preventing video stream renaming", () => {
      const testCases = [
        { container: "jpg", filename: "cover.jpg" },
        { container: "jpeg", filename: "cover.jpeg" },
        { container: "png", filename: "cover.png" },
        { container: "webp", filename: "cover.webp" },
        { container: "gif", filename: "cover.gif" },
        { container: "avif", filename: "cover.avif" },
      ];

      for (const tc of testCases) {
        const res = createMockResponse();
        streamYouTubeWithYtDlp(
          "https://www.youtube.com/watch?v=CN6BhyERbas",
          "img-cover",
          tc.filename,
          res as unknown as Response,
          tc.container
        );

        expect(res._getStatusCode()).toBe(400);
        expect(res._getBody()).toBe("Images cannot be processed by video streaming pipeline.");
        // Ensure no attachment header renaming to .mp4 was sent
        expect(res.getHeader("content-disposition")).toBeUndefined();
      }
    });

    it("resolves maxresdefault.jpg directly on HTTP 200 without attempting fallbacks", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const maxresUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";

      const proxy = createDownloadProxyUrl(
        maxresUrl,
        "cover.jpg",
        "jpg",
        undefined,
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (url === maxresUrl) {
          return createMockFetchResponse({ status: 200, contentType: "image/jpeg" });
        }
        return createMockFetchResponse({ status: 404, ok: false });
      });

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        maxresUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            Referer: "https://www.youtube.com/",
          }),
        })
      );
      expect(res._getStatusCode()).toBe(200);
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="cover.jpg"');
      expect(res.getHeader("content-type")).toBe("image/jpeg");
    });

    it("falls back to sddefault.jpg when maxresdefault.jpg returns HTTP 404", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const maxresUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";
      const sdUrl = "https://i.ytimg.com/vi/CN6BhyERbas/sddefault.jpg";

      const proxy = createDownloadProxyUrl(
        maxresUrl,
        "cover.jpg",
        "jpg",
        undefined,
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const urlsCalled: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        urlsCalled.push(urlStr);
        if (urlStr === maxresUrl) {
          return createMockFetchResponse({ status: 404, ok: false });
        }
        if (urlStr === sdUrl) {
          return createMockFetchResponse({ status: 200, contentType: "image/jpeg" });
        }
        return createMockFetchResponse({ status: 404, ok: false });
      });

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      // Verify maxresdefault was tried first, followed by sddefault fallback
      expect(urlsCalled).toEqual([maxresUrl, sdUrl]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(res._getStatusCode()).toBe(200);
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="cover.jpg"');
      expect(res.getHeader("content-type")).toBe("image/jpeg");
    });

    it("falls back to hqdefault.jpg when both maxresdefault.jpg and sddefault.jpg return HTTP 404", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const maxresUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";
      const sdUrl = "https://i.ytimg.com/vi/CN6BhyERbas/sddefault.jpg";
      const hqUrl = "https://i.ytimg.com/vi/CN6BhyERbas/hqdefault.jpg";

      const proxy = createDownloadProxyUrl(
        maxresUrl,
        "cover.jpg",
        "jpg",
        undefined,
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const urlsCalled: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        urlsCalled.push(urlStr);
        if (urlStr === maxresUrl || urlStr === sdUrl) {
          return createMockFetchResponse({ status: 404, ok: false });
        }
        if (urlStr === hqUrl) {
          return createMockFetchResponse({ status: 200, contentType: "image/jpeg" });
        }
        return createMockFetchResponse({ status: 404, ok: false });
      });

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      // Verify sequence: maxresdefault.jpg -> sddefault.jpg -> hqdefault.jpg
      expect(urlsCalled).toEqual([maxresUrl, sdUrl, hqUrl]);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(res._getStatusCode()).toBe(200);
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="cover.jpg"');
      expect(res.getHeader("content-type")).toBe("image/jpeg");
    });

    it("falls back through sddefault, hqdefault, and jpg when maxresdefault.webp is requested", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const webpUrl = "https://i.ytimg.com/vi_webp/CN6BhyERbas/maxresdefault.webp";
      const sdUrl = "https://i.ytimg.com/vi_webp/CN6BhyERbas/sddefault.jpg";

      const proxy = createDownloadProxyUrl(
        webpUrl,
        "cover.webp",
        "webp",
        undefined,
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      const urlsCalled: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        urlsCalled.push(urlStr);
        if (urlStr === webpUrl) {
          return createMockFetchResponse({ status: 404, ok: false });
        }
        if (urlStr === sdUrl) {
          return createMockFetchResponse({ status: 200, contentType: "image/jpeg" });
        }
        return createMockFetchResponse({ status: 404, ok: false });
      });

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(urlsCalled[0]).toBe(webpUrl);
      expect(urlsCalled[1]).toBe(sdUrl);
      expect(res._getStatusCode()).toBe(200);
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="cover.webp"');
    });

    it("returns HTTP 400 when all thumbnail fallback URLs return 404", async () => {
      const handler = getDownloadHandler();
      const ytUrl = "https://www.youtube.com/watch?v=CN6BhyERbas";
      const maxresUrl = "https://i.ytimg.com/vi/CN6BhyERbas/maxresdefault.jpg";

      const proxy = createDownloadProxyUrl(
        maxresUrl,
        "cover.jpg",
        "jpg",
        undefined,
        undefined,
        undefined,
        ytUrl,
        "img-cover"
      );
      const token = proxy.replace("/api/download/", "");

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        createMockFetchResponse({ status: 404, ok: false })
      );

      const req = { params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res._getStatusCode()).toBe(400);
      expect(res._getBody()).toEqual(expect.objectContaining({ error: expect.stringContaining("Media source returned") }));
    });
  });

  describe("Resumable downloads and file size determination", () => {
    it("handles HEAD requests returning Accept-Ranges and Content-Length without downloading body", async () => {
      const handler = getDownloadHandler();
      const testUrl = "https://cdn.example.com/stream.mp4";
      const proxy = createDownloadProxyUrl(testUrl, "myvideo.mp4", "mp4", undefined, undefined, undefined, undefined, undefined, 2048576);
      const token = proxy.replace("/api/download/", "");

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const headers = new Headers();
        headers.set("content-type", "video/mp4");
        headers.set("content-length", "2048576");
        headers.set("accept-ranges", "bytes");
        return {
          status: 200,
          ok: true,
          body: null,
          headers,
        } as unknown as globalThis.Response;
      });

      const req = { method: "HEAD", params: { token }, headers: {} } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res._getStatusCode()).toBe(200);
      expect(res.getHeader("accept-ranges")).toBe("bytes");
      expect(res.getHeader("content-length")).toBe("2048576");
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="myvideo.mp4"');
      expect(res.getHeader("content-type")).toBe("video/mp4");
      expect(res._getBody()).toBe("");
    });

    it("serves HTTP 206 Partial Content when Range request is made with upstream 206", async () => {
      const handler = getDownloadHandler();
      const testUrl = "https://rr---sn.googlevideo.com/videoplayback?id=123";
      const proxy = createDownloadProxyUrl(testUrl, "videoplayback.webm", "webm", undefined, undefined, undefined, undefined, undefined, 1000);
      const token = proxy.replace("/api/download/", "");

      const chunkBytes = "01234";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const headers = new Headers();
        headers.set("content-type", "video/webm");
        headers.set("content-length", "5");
        headers.set("content-range", "bytes 0-4/1000");
        headers.set("accept-ranges", "bytes");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(chunkBytes));
            controller.close();
          },
        });
        return {
          status: 206,
          ok: true,
          body: stream,
          headers,
        } as unknown as globalThis.Response;
      });

      const req = { method: "GET", params: { token }, headers: { range: "bytes=0-4" } } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(res._getStatusCode()).toBe(206);
      expect(res.getHeader("accept-ranges")).toBe("bytes");
      expect(res.getHeader("content-range")).toBe("bytes 0-4/1000");
      expect(res.getHeader("content-length")).toBe("5");
      expect(res.getHeader("content-disposition")).toBe('attachment; filename="videoplayback.webm"');
    });

    it("serves resumed content (Range: bytes=5-) and sets status 206", async () => {
      const handler = getDownloadHandler();
      const testUrl = "https://rr---sn.googlevideo.com/videoplayback?id=123";
      const proxy = createDownloadProxyUrl(testUrl, "cbdrop_-_7BufD.mp4", "mp4", undefined, undefined, undefined, undefined, undefined, 10);
      const token = proxy.replace("/api/download/", "");

      const remainingBytes = "56789";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const headers = new Headers();
        headers.set("content-type", "video/mp4");
        headers.set("content-length", "5");
        headers.set("content-range", "bytes 5-9/10");
        headers.set("accept-ranges", "bytes");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(remainingBytes));
            controller.close();
          },
        });
        return {
          status: 206,
          ok: true,
          body: stream,
          headers,
        } as unknown as globalThis.Response;
      });

      const req = { method: "GET", params: { token }, headers: { range: "bytes=5-" } } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(res._getStatusCode()).toBe(206);
      expect(res.getHeader("accept-ranges")).toBe("bytes");
      expect(res.getHeader("content-range")).toBe("bytes 5-9/10");
      expect(res.getHeader("content-length")).toBe("5");
    });

    it("slices content locally when upstream returns 200 on Range request", async () => {
      const handler = getDownloadHandler();
      const testUrl = "https://cdn.example.com/video.mp4";
      const fullText = "0123456789ABCDEF"; // 16 bytes
      const proxy = createDownloadProxyUrl(testUrl, "video.mp4", "mp4", undefined, undefined, undefined, undefined, undefined, fullText.length);
      const token = proxy.replace("/api/download/", "");

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        const headers = new Headers();
        headers.set("content-type", "video/mp4");
        headers.set("content-length", String(fullText.length));
        headers.set("accept-ranges", "bytes");
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(fullText));
            controller.close();
          },
        });
        return {
          status: 200, // Upstream ignored Range header
          ok: true,
          body: stream,
          headers,
        } as unknown as globalThis.Response;
      });

      // Request bytes 4-9 (length = 6: '456789')
      const req = { method: "GET", params: { token }, headers: { range: "bytes=4-9" } } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);
      let captured = "";
      res.on("data", (chunk: Buffer) => {
        captured += chunk.toString();
      });
      await new Promise((resolve) => {
        res.on("finish", resolve);
        setTimeout(resolve, 50);
      });

      expect(res._getStatusCode()).toBe(206);
      expect(res.getHeader("content-range")).toBe("bytes 4-9/16");
      expect(res.getHeader("content-length")).toBe("6");
      expect(captured).toBe("456789");
    });

    it("returns HTTP 416 when requested range start is beyond file length", async () => {
      const handler = getDownloadHandler();
      const testUrl = "https://cdn.example.com/video.mp4";
      const proxy = createDownloadProxyUrl(testUrl, "video.mp4", "mp4", undefined, undefined, undefined, undefined, undefined, 100);
      const token = proxy.replace("/api/download/", "");

      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        const headers = new Headers();
        headers.set("content-type", "video/mp4");
        headers.set("content-length", "100");
        return {
          status: 200,
          ok: true,
          body: new ReadableStream({ start(c) { c.close(); } }),
          headers,
        } as unknown as globalThis.Response;
      });

      const req = { method: "GET", params: { token }, headers: { range: "bytes=500-" } } as unknown as Request;
      const res = createMockResponse();

      await handler(req, res as unknown as Response);

      expect(res._getStatusCode()).toBe(416);
      expect(res.getHeader("content-range")).toBe("bytes */100");
    });
  });
});


