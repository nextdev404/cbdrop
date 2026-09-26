import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { extractYouTubeWithYtUltra } from "./youtube";

describe("extractYouTubeWithYtUltra", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts 4K, 2K, 1080p and audio formats with pot tokens", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "0000",
        msg: "请求成功",
        data: {
          title: "I Tried The LAZIEST Way to Make Money With AI",
          imageUrl: "https://i.ytimg.com/vi/LlhTEttKcwQ/maxresdefault.jpg",
          duration: "1999",
          medias: [
            {
              url: "https://redirector.googlevideo.com/videoplayback?expire=123&itag=313&pot=token4k",
              format: "4K (1.97 GB) [.webm]",
              fileSize: 2116732009,
            },
            {
              url: "https://redirector.googlevideo.com/videoplayback?expire=123&itag=271&pot=token2k",
              format: "2K (566.09 MB) [.webm]",
              fileSize: 593591113,
            },
            {
              url: "https://redirector.googlevideo.com/videoplayback?expire=123&itag=137&pot=token1080",
              format: "1080p (238.84 MB) [.mp4]",
              fileSize: 250438737,
            },
            {
              url: "https://redirector.googlevideo.com/videoplayback?expire=123&itag=140&pot=tokenAudio",
              format: "30.85 MB [.m4a]",
              fileSize: 32353651,
            },
          ],
        },
      }),
    });

    const result = await extractYouTubeWithYtUltra("https://www.youtube.com/watch?v=LlhTEttKcwQ");
    expect(result).not.toBeNull();
    expect(result?.title).toBe("I Tried The LAZIEST Way to Make Money With AI");
    expect(result?.duration).toBe(1999);
    expect(result?.thumbnail).toContain("maxresdefault.jpg");

    // Check formats
    const f4k = result?.formats.find((f) => f.height === 2160);
    expect(f4k).toBeDefined();
    expect(f4k?.ext).toBe("webm");
    expect(f4k?.url).toContain("itag=313");
    expect(f4k?.url).toContain("pot=token4k");

    const f2k = result?.formats.find((f) => f.height === 1440);
    expect(f2k).toBeDefined();
    expect(f2k?.ext).toBe("webm");

    const f1080 = result?.formats.find((f) => f.height === 1080);
    expect(f1080).toBeDefined();
    expect(f1080?.ext).toBe("mp4");

    const audio = result?.formats.find((f) => f.ext === "m4a");
    expect(audio).toBeDefined();
    expect(audio?.url).toContain("itag=140");
  });

  it("gracefully returns null on API errors to allow yt-dlp fallback", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const result = await extractYouTubeWithYtUltra("https://www.youtube.com/watch?v=LlhTEttKcwQ");
    expect(result).toBeNull();
  });
});
