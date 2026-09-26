import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMedia, prepareDownload, refreshDownload } from "./services/media";
import { extractWithYtDlp } from "./extractors/ytdlp";

function cloudflareResponse(result: unknown) {
  return { ok: true, json: async () => ({ success: true, result, errors: [], messages: [] }) } as Response;
}

const video = {
  uid: "video_uid_123",
  readyToStream: true,
  thumbnail: "https://customer.cloudflarestream.com/video_uid_123/thumbnails/thumbnail.jpg",
  duration: 91,
  meta: { name: "Authorized clip", platform: "Direct video", creator: "Test owner" },
  status: { state: "ready" },
};

describe("Cloudflare Stream adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("ingests a direct authorized video URL and returns metadata", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-test");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token-test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(cloudflareResponse(video));

    const result = await analyzeMedia("https://media.example.com/authorized-video.mp4");

    expect(result.id).toBe("cf_video_uid_123");
    expect(result.ready).toBe(true);
    expect(result.formats.map((format) => format.id)).toEqual(["mp4", "m4a"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/accounts/account-test/stream/copy"), expect.objectContaining({ method: "POST" }));
  });

  it("generates an MP4 download and reports processing until Cloudflare marks it ready", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-test");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token-test");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(cloudflareResponse(video))
      .mockResolvedValueOnce(cloudflareResponse({}))
      .mockResolvedValueOnce(cloudflareResponse({ default: { status: "inprogress", url: "https://customer.cloudflarestream.com/video_uid_123/downloads/default.mp4" } }))
      .mockResolvedValueOnce(cloudflareResponse({ default: { status: "ready", url: "https://customer.cloudflarestream.com/video_uid_123/downloads/default.mp4" } }));

    const job = await prepareDownload("https://media.example.com/authorized-video.mp4", "cf_video_uid_123", "mp4");
    expect(job.status).toBe("processing");
    expect(job.downloadUrl).toBeUndefined();

    const refreshed = await refreshDownload(job.jobId, "mp4");
    expect(refreshed.status).toBe("completed");
    expect(refreshed.downloadUrl).toMatch(/^\/api\/download\//);
  });

  it("returns a clear extractor error for a social URL when yt-dlp is unavailable", async () => {
    vi.stubEnv("YTDLP_BIN", "/tmp/cbdrop-missing-yt-dlp");
    await expect(extractWithYtDlp("https://www.youtube.com/watch?v=authorized")).rejects.toThrow("media extractor is not installed");
  });

  it("downloads an authorized direct MP4 URL without Cloudflare credentials", async () => {
    vi.unstubAllEnvs();
    const sourceUrl = "https://media.example.com/authorized-clip.mp4";
    const analysis = await analyzeMedia(sourceUrl);
    const job = await prepareDownload(sourceUrl, analysis.id, "direct-video");
    expect(job.status).toBe("completed");
    expect(job.downloadUrl).toMatch(/^\/api\/download\//);
  });
});
