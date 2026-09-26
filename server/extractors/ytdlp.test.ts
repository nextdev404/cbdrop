import { describe, expect, it } from "vitest";
import { detectExtractorPlatform, normalizeYtDlpResult, parseFacebookHtml } from "./ytdlp";

describe("yt-dlp extractor adapter", () => {
  it("detects the supported social platforms without inspecting file extensions", () => {
    expect(detectExtractorPlatform("https://youtu.be/example")).toBe("YouTube");
    expect(detectExtractorPlatform("https://www.youtube.com/watch?v=12345")).toBe("YouTube");
    expect(detectExtractorPlatform("https://m.youtube.com/watch?v=12345")).toBe("YouTube");
    expect(detectExtractorPlatform("https://www.tiktok.com/@creator/video/123")).toBe("TikTok");
    expect(detectExtractorPlatform("https://vm.tiktok.com/ZMexample/")).toBe("TikTok");
    expect(detectExtractorPlatform("https://www.instagram.com/reel/example/")).toBe("Instagram");
    expect(detectExtractorPlatform("https://instagr.am/p/example/")).toBe("Instagram");
    expect(detectExtractorPlatform("https://www.facebook.com/watch?v=12345")).toBe("Facebook");
    expect(detectExtractorPlatform("https://fb.watch/example/")).toBe("Facebook");
    expect(detectExtractorPlatform("https://www.snapchat.com/spotlight/123")).toBe("Snapchat");
    expect(detectExtractorPlatform("https://www.snapchat.com/p/123")).toBe("Snapchat");
    expect(detectExtractorPlatform("https://www.snapchat.com/add/user/story/123")).toBe("Snapchat");
    expect(detectExtractorPlatform("https://story.snapchat.com/o/123")).toBe("Snapchat");
    expect(detectExtractorPlatform("https://t.snapchat.com/123")).toBe("Snapchat");
    expect(detectExtractorPlatform("https://x.com/user/status/123")).toBe("X");
    expect(detectExtractorPlatform("https://twitter.com/user/status/123")).toBe("X");
    expect(detectExtractorPlatform("https://t.co/example")).toBe("X");
    expect(detectExtractorPlatform("https://example.com/video.mp4")).toBeNull();
  });

  it("normalizes direct, HLS, and DASH formats from extractor JSON", () => {
    const result = normalizeYtDlpResult({
      id: "social-123", title: "Authorized public clip", uploader: "Creator", duration: 92, extractor_key: "YouTube",
      formats: [
        { format_id: "18", url: "https://cdn.example/video.mp4", ext: "mp4", height: 360, vcodec: "avc1", acodec: "mp4a", filesize: 4000000 },
        { format_id: "hls", url: "https://cdn.example/master.m3u8", ext: "mp4", protocol: "m3u8", vcodec: "h264", acodec: "aac", height: 720 },
        { format_id: "dash", url: "https://cdn.example/manifest.mpd", ext: "mpd", protocol: "http_dash_segments", vcodec: "vp9", acodec: "none", height: 1080 },
      ],
    });
    expect(result.formats).toHaveLength(3);
    expect(result.formats[1]?.protocol).toBe("m3u8");
    expect(result.formats[2]?.ext).toBe("mpd");
  });

  it("rejects extractor responses with no downloadable formats", () => {
    expect(() => normalizeYtDlpResult({ id: "empty", title: "No media", formats: [] })).toThrow("No downloadable video");
  });

  it("handles single direct video URLs returned by extractors like Snapchat and attaches Snapchat headers", () => {
    const result = normalizeYtDlpResult({
      id: "snap-123",
      title: "Spotlight Snap",
      uploader: "snapuser",
      duration: 15,
      extractor_key: "SnapchatSpotlight",
      url: "https://bolt-gcdn.sc-cdn.net/video.mp4",
      ext: "mp4",
      height: 960,
      width: 540,
    });
    expect(result.platform).toBe("Snapchat");
    expect(result.formats).toHaveLength(1);
    expect(result.formats[0]?.url).toBe("https://bolt-gcdn.sc-cdn.net/video.mp4");
    expect(result.formats[0]?.height).toBe(960);
    expect(result.formats[0]?.httpHeaders?.Referer).toBe("https://www.snapchat.com/");
    expect(result.formats[0]?.httpHeaders?.Origin).toBe("https://www.snapchat.com");
  });

  it("normalizes thumbnails and includes them in ExtractedMedia", () => {
    const result = normalizeYtDlpResult({
      id: "thumb-123",
      title: "Clip with thumbnails",
      formats: [
        { format_id: "18", url: "https://cdn.example/video.mp4", ext: "mp4" },
      ],
      thumbnails: [
        { id: "0", url: "https://cdn.example/thumb_low.jpg", width: 320, height: 180 },
        { id: "1", url: "https://cdn.example/thumb_high.jpg", width: 1280, height: 720 },
      ],
    });
    expect(result.thumbnails).toBeDefined();
    expect(result.thumbnails).toHaveLength(2);
    expect(result.thumbnails?.[1]?.url).toBe("https://cdn.example/thumb_high.jpg");
    expect(result.thumbnails?.[1]?.width).toBe(1280);
  });

  it("supports image-only posts that only provide thumbnails without video formats", () => {
    const result = normalizeYtDlpResult({
      id: "photo-123",
      title: "Instagram Photo",
      formats: [],
      thumbnails: [
        { id: "photo", url: "https://cdn.example/photo.jpg", width: 1080, height: 1080 },
      ],
    });
    expect(result.id).toBe("photo-123");
    expect(result.title).toBe("Instagram Photo");
    expect(result.thumbnails).toHaveLength(1);
    expect(result.formats).toHaveLength(0);
  });

  it("extracts all items and photos from carousel or slideshow posts with raw.entries", () => {
    const result = normalizeYtDlpResult({
      _type: "playlist",
      id: "carousel-123",
      title: "Instagram Carousel",
      entries: [
        {
          id: "item-1",
          title: "Photo 1",
          formats: [{ format_id: "photo", url: "https://cdn.example/p1.jpg", ext: "jpg" }],
          thumbnails: [{ url: "https://cdn.example/p1.jpg", width: 1080, height: 1080 }],
        },
        {
          id: "item-2",
          title: "Photo 2",
          formats: [{ format_id: "photo", url: "https://cdn.example/p2.jpg", ext: "jpg" }],
          thumbnails: [{ url: "https://cdn.example/p2.jpg", width: 1080, height: 1080 }],
        },
      ],
    });
    expect(result.id).toBe("carousel-123");
    expect(result.formats).toHaveLength(2);
    expect(result.thumbnails).toHaveLength(2);
    expect(result.thumbnails?.[0]?.url).toBe("https://cdn.example/p1.jpg");
    expect(result.thumbnails?.[1]?.url).toBe("https://cdn.example/p2.jpg");
  });

  it("extracts photo formats from raw.entries when entries only have thumbnails without formats", () => {
    const result = normalizeYtDlpResult({
      _type: "playlist",
      id: "ig-thumb-carousel",
      title: "Instagram Thumbnails Carousel",
      entries: [
        {
          id: "entry-1",
          title: "Slide 1",
          thumbnails: [
            { url: "https://cdn.example/low1.jpg", width: 320, height: 320 },
            { url: "https://cdn.example/high1.jpg", width: 1080, height: 1080 },
          ],
        },
        {
          id: "entry-2",
          title: "Slide 2",
          thumbnails: [
            { url: "https://cdn.example/high2.jpg", width: 1080, height: 1350 },
          ],
        },
      ],
    });
    expect(result.formats).toHaveLength(2);
    expect(result.formats[0].url).toBe("https://cdn.example/high1.jpg");
    expect(result.formats[0].width).toBe(1080);
    expect(result.formats[1].url).toBe("https://cdn.example/high2.jpg");
    expect(result.formats[1].height).toBe(1350);
  });

  it("normalizes Snapchat photo snap and attaches Snapchat headers", () => {
    const result = normalizeYtDlpResult({
      id: "snap-photo-456",
      title: "Snapchat Photo Snap",
      uploader: "snapuser",
      extractor_key: "SnapchatSpotlight",
      formats: [
        { format_id: "photo", url: "https://bolt-gcdn.sc-cdn.net/snap_photo.jpg", ext: "jpg", vcodec: "none", acodec: "none", width: 1080, height: 1920 },
      ],
      thumbnails: [
        { url: "https://bolt-gcdn.sc-cdn.net/snap_photo.jpg", width: 1080, height: 1920 },
      ],
    });
    expect(result.platform).toBe("Snapchat");
    expect(result.formats).toHaveLength(1);
    expect(result.formats[0].vcodec).toBe("none");
    expect(result.formats[0].httpHeaders?.Referer).toBe("https://www.snapchat.com/");
    expect(result.formats[0].httpHeaders?.Origin).toBe("https://www.snapchat.com");
  });

  it("normalizes Facebook photo album with multiple entries", () => {
    const result = normalizeYtDlpResult({
      _type: "playlist",
      id: "fb-album-789",
      title: "Facebook Photo Album",
      uploader: "fb_page",
      extractor_key: "Facebook",
      entries: [
        {
          id: "fb-item-1",
          title: "Album Photo 1",
          formats: [{ format_id: "photo-1", url: "https://scontent.xx.fbcdn.net/p1.jpg", ext: "jpg", vcodec: "none" }],
          thumbnails: [{ url: "https://scontent.xx.fbcdn.net/p1.jpg", width: 960, height: 720 }],
        },
        {
          id: "fb-item-2",
          title: "Album Photo 2",
          formats: [{ format_id: "photo-2", url: "https://scontent.xx.fbcdn.net/p2.jpg", ext: "jpg", vcodec: "none" }],
          thumbnails: [{ url: "https://scontent.xx.fbcdn.net/p2.jpg", width: 960, height: 720 }],
        },
      ],
    });
    expect(result.formats).toHaveLength(2);
    expect(result.formats[0].url).toBe("https://scontent.xx.fbcdn.net/p1.jpg");
    expect(result.formats[1].url).toBe("https://scontent.xx.fbcdn.net/p2.jpg");
  });

  it("normalizes YouTube community post image entries", () => {
    const result = normalizeYtDlpResult({
      _type: "playlist",
      id: "yt-community-post",
      title: "YouTube Community Photo Post",
      uploader: "Channel Creator",
      extractor_key: "YoutubeTab",
      entries: [
        {
          id: "yt-cp-1",
          title: "Community Photo 1",
          formats: [{ format_id: "photo-1", url: "https://yt3.ggpht.com/p1.jpg", ext: "jpg", vcodec: "none" }],
          thumbnails: [{ url: "https://yt3.ggpht.com/p1.jpg", width: 1200, height: 1200 }],
        },
        {
          id: "yt-cp-2",
          title: "Community Photo 2",
          formats: [{ format_id: "photo-2", url: "https://yt3.ggpht.com/p2.jpg", ext: "jpg", vcodec: "none" }],
          thumbnails: [{ url: "https://yt3.ggpht.com/p2.jpg", width: 1200, height: 1200 }],
        },
      ],
    });
    expect(result.formats).toHaveLength(2);
    expect(result.formats[0].url).toBe("https://yt3.ggpht.com/p1.jpg");
    expect(result.formats[1].url).toBe("https://yt3.ggpht.com/p2.jpg");
  });

  it("detects and normalizes Facebook Stories (videos and photos)", () => {
    expect(detectExtractorPlatform("https://www.facebook.com/stories/1542030902575041/UzpfSVNDOjEwMjYyMjU2MTM3MTAzODE=/?view_single=1")).toBe("Facebook");
    expect(detectExtractorPlatform("https://www.facebook.com/stories/1659105157517420")).toBe("Facebook");
    expect(detectExtractorPlatform("https://m.facebook.com/stories/1542030902575041/1026225613710381")).toBe("Facebook");

    const storyResult = normalizeYtDlpResult({
      id: "1026225613710381",
      title: "Facebook Story",
      uploader: "Story Author",
      extractor_key: "Facebook",
      formats: [
        {
          format_id: "sd",
          url: "https://video.xx.fbcdn.net/v/t42/story_video.mp4",
          ext: "mp4",
          vcodec: "h264",
          acodec: "aac",
          height: 1080,
          width: 608,
          duration: 15,
        },
      ],
    });
    expect(storyResult.platform).toBe("Facebook");
    expect(storyResult.formats).toHaveLength(1);
    expect(storyResult.formats[0].url).toContain("story_video.mp4");
  });

  it("parses Facebook Story HTML containing HD/SD videos and photos", () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ahmed - Story | Facebook</title>
        <meta property="og:title" content="Ahmed | Facebook" />
      </head>
      <body>
        <script>
          requireLazy(["ServerJS"], function(s) {
            s.handle({
              "playable_url_quality_hd": "https:\\/\\/video.xx.fbcdn.net\\/v\\/t39.25447-2\\/story_hd.mp4?_nc_cat=101\\u0026token=123",
              "playable_url": "https:\\/\\/video.xx.fbcdn.net\\/v\\/t39.25447-2\\/story_sd.mp4?_nc_cat=101\\u0026token=123",
              "viewer_image": {"uri": "https:\\/\\/scontent.xx.fbcdn.net\\/v\\/t39.30808-6\\/story_cover.jpg?_nc_cat=102\\u0026token=456"}
            });
          });
        </script>
      </body>
      </html>
    `;
    const parsed = parseFacebookHtml(sampleHtml, "https://www.facebook.com/stories/1542030902575041/UzpfSVNDOjEwMjYyMjU2MTM3MTAzODE=/?view_single=1");
    expect(parsed).not.toBeNull();
    expect(parsed?.platform).toBe("Facebook");
    expect(parsed?.title).toBe("Ahmed - Story");
    expect(parsed?.uploader).toBe("Ahmed");
    expect(parsed?.id).toBe("1026225613710381");
    expect(parsed?.formats).toHaveLength(3);
    const hd = parsed?.formats.find((f) => f.id.startsWith("hd"));
    const sd = parsed?.formats.find((f) => f.id.startsWith("sd"));
    const photo = parsed?.formats.find((f) => f.id.startsWith("photo"));
    expect(hd?.url).toBe("https://video.xx.fbcdn.net/v/t39.25447-2/story_hd.mp4?_nc_cat=101&token=123");
    expect(hd?.vcodec).toBe("h264");
    expect(sd?.url).toBe("https://video.xx.fbcdn.net/v/t39.25447-2/story_sd.mp4?_nc_cat=101&token=123");
    expect(photo?.url).toBe("https://scontent.xx.fbcdn.net/v/t39.30808-6/story_cover.jpg?_nc_cat=102&token=456");
    expect(photo?.vcodec).toBe("none");
  });

  it("parses Facebook photo-only story HTML", () => {
    const photoHtml = `
      <html>
      <head>
        <title>Sara's Story | Facebook</title>
        <meta property="og:image" content="https://scontent.xx.fbcdn.net/v/t39.30808-6/photo1.jpg" />
      </head>
      <body>
        <script>
          var data = {
            "photo_image": {"uri": "https:\\/\\/scontent.xx.fbcdn.net\\/v\\/t39.30808-6\\/photo_hires.jpg"}
          };
        </script>
      </body>
      </html>
    `;
    const parsed = parseFacebookHtml(photoHtml);
    expect(parsed).not.toBeNull();
    expect(parsed?.formats.some((f) => f.url.includes("photo_hires.jpg"))).toBe(true);
    expect(parsed?.formats.every((f) => f.vcodec === "none")).toBe(true);
  });
});
