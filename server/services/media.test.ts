import { describe, expect, it } from "vitest";
import { detectPlatform, isFacebookHtml, resolveMedia } from "./media";

describe("media service platform detection", () => {
  it("detects direct image URLs by extension", () => {
    expect(detectPlatform("https://example.com/photos/hero.jpg")).toBe("Direct image");
    expect(detectPlatform("https://example.com/images/banner.jpeg?quality=80")).toBe("Direct image");
    expect(detectPlatform("https://example.com/assets/logo.png")).toBe("Direct image");
    expect(detectPlatform("https://example.com/pic.webp")).toBe("Direct image");
    expect(detectPlatform("https://example.com/animated.gif")).toBe("Direct image");
  });

  it("detects direct video URLs by extension", () => {
    expect(detectPlatform("https://example.com/media/clip.mp4")).toBe("Direct video");
    expect(detectPlatform("https://example.com/video.webm?token=xyz")).toBe("Direct video");
    expect(detectPlatform("https://example.com/raw.mov")).toBe("Direct video");
  });

  it("resolves a direct image URL into a downloadable MediaAnalysis with image format", async () => {
    const analysis = await resolveMedia("https://images.unsplash.com/photo-1534447677768-be436bb09401.jpg");
    expect(analysis.platform).toBe("Direct image");
    expect(analysis.formats).toHaveLength(1);
    expect(analysis.formats[0].type).toBe("image");
    expect(analysis.formats[0].container).toBe("jpg");
    expect(analysis.formats[0].available).toBe(true);
    expect(analysis.formats[0].downloadUrl).toBe("https://images.unsplash.com/photo-1534447677768-be436bb09401.jpg");
  });

  it("prepares download for a direct single image with sensible filename image.jpg", async () => {
    const { prepareDownload } = await import("./media");
    const testUrl = "https://images.unsplash.com/photo-sample.png";
    const analysis = await resolveMedia(testUrl);
    const job = await prepareDownload(testUrl, analysis.id, analysis.formats[0].id);
    expect(job.status).toBe("completed");
    expect(job.filename).toBe("image.png");
    expect(job.downloadUrl).toMatch(/^\/api\/download\//);
  });

  it("extracts multi-image carousel entries as distinct individual image formats", async () => {
    const { extractedToMedia } = await import("./media");
    const mockCarousel: import("../extractors/types").ExtractedMedia = {
      id: "carousel123",
      title: "Vacation Carousel",
      uploader: "traveler",
      platform: "Instagram",
      formats: [
        { id: "img-1", ext: "jpg", url: "https://example.com/p1.jpg", vcodec: "none", width: 1080, height: 1080 },
        { id: "img-2", ext: "jpg", url: "https://example.com/p2.jpg", vcodec: "none", width: 1080, height: 1350 },
        { id: "img-3", ext: "jpg", url: "https://example.com/p3.jpg", vcodec: "none", width: 1080, height: 1080 },
      ],
      thumbnails: [
        { url: "https://example.com/p1.jpg", width: 1080, height: 1080 },
        { url: "https://example.com/p2.jpg", width: 1080, height: 1350 },
        { url: "https://example.com/p3.jpg", width: 1080, height: 1080 },
      ],
    };

    const media = extractedToMedia("https://www.instagram.com/p/carousel123/", mockCarousel);
    expect(media.formats).toHaveLength(3);
    expect(media.formats.every((f) => f.type === "image")).toBe(true);
    expect(media.formats[0].id).toBe("extractor-img-1");
    expect(media.formats[1].id).toBe("extractor-img-2");
    expect(media.formats[2].id).toBe("extractor-img-3");
    expect(media.formats[0].note).toBe("Photo 1 · direct");
    expect(media.formats[1].note).toBe("Photo 2 · direct");
    expect(media.formats[2].note).toBe("Photo 3 · direct");
  });

  it("deduplicates multiple resolution thumbnails for a single photo post to 1 format", async () => {
    const { extractedToMedia } = await import("./media");
    const mockSinglePhoto: import("../extractors/types").ExtractedMedia = {
      id: "photo999",
      title: "Single Photo Post",
      uploader: "photographer",
      platform: "X",
      formats: [],
      thumbnails: [
        { url: "https://pbs.twimg.com/media/small.jpg", width: 150, height: 150 },
        { url: "https://pbs.twimg.com/media/medium.jpg", width: 680, height: 680 },
        { url: "https://pbs.twimg.com/media/large.jpg", width: 1200, height: 1200 },
      ],
    };

    const media = extractedToMedia("https://x.com/user/status/123", mockSinglePhoto);
    expect(media.formats).toHaveLength(1);
    expect(media.formats[0].type).toBe("image");
    expect(media.formats[0].downloadUrl).toBe("https://pbs.twimg.com/media/large.jpg");
    expect(media.formats[0].quality).toBe("1200x1200");
  });

  describe("standard video URLs (YouTube, TikTok, Snapchat)", () => {
    it("preserves video duration, produces type: 'video' formats, resolution pickers (MP4, WEBM, M4A), and prepares download for YouTube", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const mockYouTubeVideo: import("../extractors/types").ExtractedMedia = {
        id: "dQw4w9WgXcQ",
        title: "Test YouTube Video",
        uploader: "Test Creator",
        duration: 212, // 3 minutes 32 seconds
        platform: "YouTube",
        formats: [
          { id: "137", ext: "mp4", height: 1080, width: 1920, vcodec: "avc1.640028", acodec: "none", tbr: 4500, url: "https://rr2---sn-googlevideo.com/v1080.mp4" },
          { id: "248", ext: "webm", height: 720, width: 1280, vcodec: "vp9", acodec: "none", tbr: 2500, url: "https://rr2---sn-googlevideo.com/v720.webm" },
          { id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", tbr: 128, url: "https://rr2---sn-googlevideo.com/audio.m4a" },
        ],
        thumbnails: [
          { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", width: 1280, height: 720 },
        ],
      };

      const media = extractedToMedia("https://www.youtube.com/watch?v=dQw4w9WgXcQ", mockYouTubeVideo);

      // Duration formatting preserved
      expect(media.duration).toBe("3:32");
      expect(media.platform).toBe("YouTube");

      // Video formats produced with type: 'video'
      const videoFormats = media.formats.filter((f) => f.type === "video");
      expect(videoFormats.length).toBeGreaterThanOrEqual(2);
      expect(videoFormats.some((f) => f.container === "mp4" && f.quality === "1080p")).toBe(true);
      expect(videoFormats.some((f) => f.container === "webm" && f.quality === "720p")).toBe(true);

      // Audio formats produced with type: 'audio' (M4A)
      const audioFormats = media.formats.filter((f) => f.type === "audio");
      expect(audioFormats.length).toBeGreaterThanOrEqual(1);
      expect(audioFormats[0].container).toBe("m4a");
      expect(audioFormats[0].quality).toBe("audio");

      // Video format has audio pairing for ffmpeg merge
      const mp4Format = videoFormats.find((f) => f.container === "mp4");
      expect(mp4Format?.audioUrl).toBe("https://rr2---sn-googlevideo.com/audio.m4a");
      expect(mp4Format?.httpHeaders?.Referer).toBe("https://www.youtube.com/");

      // Download job preparation
      cacheMedia(media);
      const job = await prepareDownload("https://www.youtube.com/watch?v=dQw4w9WgXcQ", media.id, mp4Format!.id);
      expect(job.status).toBe("completed");
      expect(job.filename).toMatch(/^cbdrop-[A-Za-z0-9_-]+\.mp4$/);
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("produces type: 'video' formats, preserves duration, and prepares download for TikTok", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const mockTikTokVideo: import("../extractors/types").ExtractedMedia = {
        id: "71234567890",
        title: "Funny TikTok Dance",
        uploader: "tiktokstar",
        duration: 24, // 0:24
        platform: "TikTok",
        formats: [
          {
            id: "play_addr",
            ext: "mp4",
            height: 1080,
            width: 576,
            vcodec: "h264",
            acodec: "aac",
            url: "https://v16-webapp-prime.tiktok.com/video.mp4",
          },
        ],
      };

      const media = extractedToMedia("https://www.tiktok.com/@tiktokstar/video/71234567890", mockTikTokVideo);

      expect(media.duration).toBe("0:24");
      expect(media.platform).toBe("TikTok");
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("video");
      expect(media.formats[0].container).toBe("mp4");
      expect(media.formats[0].quality).toBe("1080p");
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.tiktok.com/");

      cacheMedia(media);
      const job = await prepareDownload("https://www.tiktok.com/@tiktokstar/video/71234567890", media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toMatch(/^cbdrop-[A-Za-z0-9_-]+\.mp4$/);
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("produces type: 'video' formats, preserves duration, attaches Snapchat headers, and prepares download for Snapchat", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const mockSnapchatVideo: import("../extractors/types").ExtractedMedia = {
        id: "snap_spotlight_999",
        title: "Snap Spotlight Story",
        uploader: "snapcreator",
        duration: 15, // 0:15
        platform: "Snapchat",
        formats: [
          {
            id: "direct-video",
            ext: "mp4",
            height: 960,
            width: 540,
            vcodec: "h264",
            acodec: "aac",
            url: "https://bolt-gcdn.sc-cdn.net/stream/video.mp4",
          },
        ],
      };

      const media = extractedToMedia("https://www.snapchat.com/spotlight/W7_EDxXdQ...", mockSnapchatVideo);

      expect(media.duration).toBe("0:15");
      expect(media.platform).toBe("Snapchat");
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("video");
      expect(media.formats[0].container).toBe("mp4");
      expect(media.formats[0].quality).toBe("960p");
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.snapchat.com/");
      expect(media.formats[0].httpHeaders?.Origin).toBe("https://www.snapchat.com");

      cacheMedia(media);
      const job = await prepareDownload("https://www.snapchat.com/spotlight/W7_EDxXdQ...", media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toMatch(/^cbdrop-[A-Za-z0-9_-]+\.mp4$/);
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });
  });

  describe("direct media downloading (.mp4, .webm, .jpg, .png)", () => {
    it("resolves and prepares download for direct .mp4 video URL", async () => {
      const { resolveMedia, prepareDownload } = await import("./media");
      const url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
      const media = await resolveMedia(url);

      expect(media.platform).toBe("Direct video");
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("video");
      expect(media.formats[0].container).toBe("mp4");
      expect(media.formats[0].quality).toBe("source");
      expect(media.formats[0].downloadUrl).toBe(url);

      const job = await prepareDownload(url, media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toBe("BigBuckBunny.mp4");
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("resolves and prepares download for direct .webm video URL", async () => {
      const { resolveMedia, prepareDownload } = await import("./media");
      const url = "https://example.com/media/sample-video.webm";
      const media = await resolveMedia(url);

      expect(media.platform).toBe("Direct video");
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("video");
      expect(media.formats[0].container).toBe("webm");
      expect(media.formats[0].quality).toBe("source");
      expect(media.formats[0].downloadUrl).toBe(url);

      const job = await prepareDownload(url, media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toBe("sample-video.webm");
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("resolves and prepares download for direct .jpg image URL", async () => {
      const { resolveMedia, prepareDownload } = await import("./media");
      const url = "https://images.unsplash.com/photo-scenery.jpg";
      const media = await resolveMedia(url);

      expect(media.platform).toBe("Direct image");
      expect(media.thumbnailUrl).toBe(url);
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("image");
      expect(media.formats[0].container).toBe("jpg");
      expect(media.formats[0].quality).toBe("original");

      const job = await prepareDownload(url, media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toBe("image.jpg");
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("resolves and prepares download for direct .png image URL", async () => {
      const { resolveMedia, prepareDownload } = await import("./media");
      const url = "https://assets.example.com/branding/company-logo.png";
      const media = await resolveMedia(url);

      expect(media.platform).toBe("Direct image");
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("image");
      expect(media.formats[0].container).toBe("png");
      expect(media.formats[0].quality).toBe("original");

      const job = await prepareDownload(url, media.id, media.formats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toBe("image.png");
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });
  });

  describe("candidateFormats audio stream filtering (prevent audio streams becoming video formats)", () => {
    it("does NOT turn audio streams (mp3, m4a, opus, aac) into video formats when a post has no video", async () => {
      const { extractedToMedia } = await import("./media");
      const mockAudioOnlyPost: import("../extractors/types").ExtractedMedia = {
        id: "audio_track_123",
        title: "Ambient Soundtrack",
        uploader: "SoundDesigner",
        duration: 180,
        platform: "TikTok",
        formats: [
          { id: "audio-m4a", ext: "m4a", vcodec: "none", acodec: "mp4a.40.2", tbr: 128, url: "https://example.com/track.m4a" },
          { id: "audio-mp3", ext: "mp3", vcodec: "none", acodec: "mp3", tbr: 192, url: "https://example.com/track.mp3" },
          { id: "audio-opus", ext: "opus", vcodec: "none", acodec: "opus", tbr: 160, url: "https://example.com/track.opus" },
        ],
      };

      const media = extractedToMedia("https://www.tiktok.com/@user/sound/123", mockAudioOnlyPost);

      // Verify ZERO video formats are generated
      const videoFormats = media.formats.filter((f) => f.type === "video");
      expect(videoFormats).toHaveLength(0);

      // Verify audio formats are correctly categorized as audio
      const audioFormats = media.formats.filter((f) => f.type === "audio");
      expect(audioFormats.length).toBeGreaterThanOrEqual(1);
      expect(audioFormats.every((f) => f.type === "audio")).toBe(true);
    });

    it("does NOT turn background audio into video formats on a photo slideshow post with images and audio", async () => {
      const { extractedToMedia } = await import("./media");
      const mockPhotoSlideshowWithAudio: import("../extractors/types").ExtractedMedia = {
        id: "slideshow_audio_456",
        title: "Travel Slideshow with Song",
        uploader: "traveler",
        duration: 30,
        platform: "TikTok",
        formats: [
          { id: "audio-track", ext: "m4a", vcodec: "none", acodec: "aac", tbr: 128, url: "https://example.com/bg-music.m4a" },
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 1080, height: 1920, url: "https://example.com/p1.jpg" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 1080, height: 1920, url: "https://example.com/p2.jpg" },
        ],
        thumbnails: [
          { url: "https://example.com/p1.jpg", width: 1080, height: 1920 },
          { url: "https://example.com/p2.jpg", width: 1080, height: 1920 },
        ],
      };

      const media = extractedToMedia("https://www.tiktok.com/@traveler/video/slideshow_audio_456", mockPhotoSlideshowWithAudio);

      // There must be ZERO video formats
      const videoFormats = media.formats.filter((f) => f.type === "video");
      expect(videoFormats).toHaveLength(0);

      // Image formats must be preserved
      const imageFormats = media.formats.filter((f) => f.type === "image");
      expect(imageFormats).toHaveLength(2);
      expect(imageFormats[0].type).toBe("image");
      expect(imageFormats[1].type).toBe("image");

      // Audio format must be preserved as type: 'audio'
      const audioFormats = media.formats.filter((f) => f.type === "audio");
      expect(audioFormats).toHaveLength(1);
      expect(audioFormats[0].type).toBe("audio");
      expect(audioFormats[0].container).toBe("m4a");
    });

    it("handles audio streams without explicit vcodec: 'none' when acodec is audio or ext is audio", async () => {
      const { extractedToMedia } = await import("./media");
      const mockPost: import("../extractors/types").ExtractedMedia = {
        id: "implicit_audio_789",
        title: "Voice Note Post",
        uploader: "speaker",
        platform: "X",
        formats: [
          // Audio without explicit vcodec
          { id: "stream-1", ext: "mp3", acodec: "mp3", url: "https://example.com/audio.mp3" },
          // Webm audio with vcodec 'none' and opus acodec
          { id: "stream-2", ext: "webm", vcodec: "none", acodec: "opus", url: "https://example.com/audio.webm" },
        ],
      };

      const media = extractedToMedia("https://x.com/speaker/status/implicit_audio_789", mockPost);

      const videoFormats = media.formats.filter((f) => f.type === "video");
      expect(videoFormats).toHaveLength(0);

      const audioFormats = media.formats.filter((f) => f.type === "audio");
      expect(audioFormats.length).toBeGreaterThan(0);
      expect(audioFormats.every((f) => f.type === "audio")).toBe(true);
    });
  });

  describe("image and carousel extraction across social media platforms (Instagram, Twitter/X, TikTok, Facebook)", () => {
    it("extracts a TikTok photo post with 23 images and 1 background audio track producing 23 image formats, 0 video formats, and 1 audio format", async () => {
      const { extractedToMedia } = await import("./media");
      const mockTikTokPhotos: import("../extractors/types").ExtractedMedia = {
        id: "7123456789012345678",
        title: "23-photo TikTok photo dump #aesthetic",
        uploader: "tiktok_creator",
        platform: "TikTok",
        formats: [
          // 1 background audio track
          {
            id: "audio-sound",
            url: "https://sf16-ies-music-va.tiktokcdn.com/obj/tos-useast2a-ve-2774/soundtrack.mp3",
            ext: "mp3",
            vcodec: "none",
            acodec: "mp3",
            formatNote: "Original soundtrack",
          },
          // 23 distinct photo formats
          ...Array.from({ length: 23 }, (_, i) => ({
            id: `photo-${i + 1}`,
            url: `https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/image-${i + 1}.jpg`,
            ext: "jpg",
            vcodec: "none",
            width: 1080,
            height: 1920,
            formatNote: `Photo ${i + 1} · Item ${i + 1}`,
          })),
        ],
        thumbnails: Array.from({ length: 23 }, (_, i) => ({
          url: `https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/image-${i + 1}.jpg`,
          width: 1080,
          height: 1920,
          id: `item-${i + 1}`,
        })),
      };

      const media = extractedToMedia("https://www.tiktok.com/@tiktok_creator/video/7123456789012345678", mockTikTokPhotos);

      const imageFormats = media.formats.filter((f) => f.type === "image");
      const videoFormats = media.formats.filter((f) => f.type === "video");
      const audioFormats = media.formats.filter((f) => f.type === "audio");

      expect(imageFormats).toHaveLength(23);
      expect(videoFormats).toHaveLength(0);
      expect(audioFormats).toHaveLength(1);

      // Verify each image format properties and ordering (Photo 1, Photo 2, ..., Photo 23)
      for (let i = 0; i < 23; i++) {
        const fmt = imageFormats[i];
        expect(fmt.type).toBe("image");
        expect(fmt.container).toBe("jpg");
        expect(fmt.id).toBe(`extractor-photo-${i + 1}`);
        expect(fmt.note).toBe(`Photo ${i + 1} · direct`);
        expect(fmt.quality).toBe("1080x1920");
        expect(fmt.available).toBe(true);
        expect(fmt.downloadUrl).toBe(`https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/image-${i + 1}.jpg`);
      }

      // Verify audio format
      expect(audioFormats[0].id).toBe("extractor-audio-sound");
      expect(audioFormats[0].type).toBe("audio");
      expect(audioFormats[0].container).toBe("mp3");
    });

    it("calling prepareDownload for a 23-image TikTok post produces image-1.jpg, image-2.jpg, ..., image-23.jpg", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const testUrl = "https://www.tiktok.com/@tiktok_creator/video/7123456789012345678";
      const mockTikTokPhotos: import("../extractors/types").ExtractedMedia = {
        id: "7123456789012345678",
        title: "23-photo TikTok photo dump #aesthetic",
        uploader: "tiktok_creator",
        platform: "TikTok",
        formats: [
          {
            id: "audio-sound",
            url: "https://sf16-ies-music-va.tiktokcdn.com/obj/tos-useast2a-ve-2774/soundtrack.mp3",
            ext: "mp3",
            vcodec: "none",
            acodec: "mp3",
          },
          ...Array.from({ length: 23 }, (_, i) => ({
            id: `photo-${i + 1}`,
            url: `https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/image-${i + 1}.jpg`,
            ext: "jpg",
            vcodec: "none",
            width: 1080,
            height: 1920,
            formatNote: `Item ${i + 1}`,
          })),
        ],
      };

      const media = extractedToMedia(testUrl, mockTikTokPhotos);
      cacheMedia(media);

      const imageFormats = media.formats.filter((f) => f.type === "image");
      expect(imageFormats).toHaveLength(23);

      for (let i = 0; i < 23; i++) {
        const job = await prepareDownload(testUrl, media.id, imageFormats[i].id);
        expect(job.status).toBe("completed");
        expect(job.filename).toBe(`image-${i + 1}.jpg`);
        expect(job.downloadUrl).toMatch(/^\/api\/download\//);
        expect(job.format.type).toBe("image");
      }
    });

    it("normalizes Twitter/X multi-image posts correctly without duplicate formats and selects best resolution", async () => {
      const { normalizeYtDlpResult } = await import("../extractors/ytdlp");
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const tweetUrl = "https://x.com/natgeo/status/1837999999999999999";

      // Simulated yt-dlp raw output for a 4-image tweet with duplicate root formats and multiple resolutions per entry
      const rawTwitterData = {
        id: "1837999999999999999",
        title: "Wildlife of the Serengeti: A 4-part gallery",
        uploader: "National Geographic",
        extractor_key: "Twitter",
        formats: [
          // Root duplicate formats matching entries
          { format_id: "orig", url: "https://pbs.twimg.com/media/Lion.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
          { format_id: "orig", url: "https://pbs.twimg.com/media/Elephant.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
          { format_id: "orig", url: "https://pbs.twimg.com/media/Cheetah.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
          { format_id: "orig", url: "https://pbs.twimg.com/media/Giraffe.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
        ],
        entries: [
          {
            id: "entry_1",
            title: "Lion photo",
            formats: [
              { format_id: "small", url: "https://pbs.twimg.com/media/Lion.jpg?name=small", ext: "jpg", width: 680, height: 453 },
              { format_id: "large", url: "https://pbs.twimg.com/media/Lion.jpg?name=large", ext: "jpg", width: 1200, height: 800 },
              { format_id: "orig", url: "https://pbs.twimg.com/media/Lion.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
              // Duplicate format entry
              { format_id: "orig", url: "https://pbs.twimg.com/media/Lion.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
            ],
            thumbnails: [
              { url: "https://pbs.twimg.com/media/Lion.jpg?name=small", width: 680, height: 453 },
              { url: "https://pbs.twimg.com/media/Lion.jpg?name=orig", width: 2048, height: 1365 },
            ],
          },
          {
            id: "entry_2",
            title: "Elephant photo",
            formats: [
              { format_id: "small", url: "https://pbs.twimg.com/media/Elephant.jpg?name=small", ext: "jpg", width: 680, height: 453 },
              { format_id: "orig", url: "https://pbs.twimg.com/media/Elephant.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
            ],
          },
          {
            id: "entry_3",
            title: "Cheetah photo",
            formats: [
              { format_id: "medium", url: "https://pbs.twimg.com/media/Cheetah.jpg?name=medium", ext: "jpg", width: 1024, height: 682 },
              { format_id: "orig", url: "https://pbs.twimg.com/media/Cheetah.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
            ],
          },
          {
            id: "entry_4",
            title: "Giraffe photo",
            formats: [
              { format_id: "small", url: "https://pbs.twimg.com/media/Giraffe.jpg?name=small", ext: "jpg", width: 680, height: 453 },
              { format_id: "orig", url: "https://pbs.twimg.com/media/Giraffe.jpg?name=orig", ext: "jpg", width: 2048, height: 1365 },
            ],
          },
        ],
      };

      const extracted = normalizeYtDlpResult(rawTwitterData);
      const media = extractedToMedia(tweetUrl, extracted);

      // Exactly 4 image formats, 0 videos, 0 duplicate formats
      expect(media.formats).toHaveLength(4);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);

      // Correct ordering: Photo 1, Photo 2, Photo 3, Photo 4
      expect(media.formats[0].note).toBe("Photo 1 · direct");
      expect(media.formats[1].note).toBe("Photo 2 · direct");
      expect(media.formats[2].note).toBe("Photo 3 · direct");
      expect(media.formats[3].note).toBe("Photo 4 · direct");

      // Highest resolution picked for each
      expect(media.formats[0].quality).toBe("2048x1365");
      expect(media.formats[0].downloadUrl).toBe("https://pbs.twimg.com/media/Lion.jpg?name=orig");
      expect(media.formats[1].downloadUrl).toBe("https://pbs.twimg.com/media/Elephant.jpg?name=orig");
      expect(media.formats[2].downloadUrl).toBe("https://pbs.twimg.com/media/Cheetah.jpg?name=orig");
      expect(media.formats[3].downloadUrl).toBe("https://pbs.twimg.com/media/Giraffe.jpg?name=orig");

      // Verify prepareDownload produces image-1.jpg through image-4.jpg
      cacheMedia(media);
      for (let i = 0; i < 4; i++) {
        const job = await prepareDownload(tweetUrl, media.id, media.formats[i].id);
        expect(job.filename).toBe(`image-${i + 1}.jpg`);
        expect(job.status).toBe("completed");
      }
    });

    it("normalizes Instagram carousel entries correctly without duplicate formats and assigns sensible filenames", async () => {
      const { normalizeYtDlpResult } = await import("../extractors/ytdlp");
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const instaUrl = "https://www.instagram.com/p/CzCarousel123/";

      // Simulated yt-dlp raw output for an Instagram carousel with 3 photos
      const rawInstagramData = {
        _type: "playlist",
        id: "CzCarousel123",
        title: "Weekend Trip Moments",
        uploader: "travel_blogger",
        extractor_key: "Instagram",
        entries: [
          {
            id: "Cz_slide_1",
            title: "Slide 1",
            formats: [
              { format_id: "0", url: "https://scontent.cdninstagram.com/v/t51/p1_640.jpg", ext: "jpg", width: 640, height: 640 },
              { format_id: "1", url: "https://scontent.cdninstagram.com/v/t51/p1_1080.jpg", ext: "jpg", width: 1080, height: 1080 },
              // Duplicate format entry from CDN
              { format_id: "1", url: "https://scontent.cdninstagram.com/v/t51/p1_1080.jpg", ext: "jpg", width: 1080, height: 1080 },
            ],
            thumbnails: [
              { url: "https://scontent.cdninstagram.com/v/t51/p1_640.jpg", width: 640, height: 640 },
              { url: "https://scontent.cdninstagram.com/v/t51/p1_1080.jpg", width: 1080, height: 1080 },
            ],
          },
          {
            id: "Cz_slide_2",
            title: "Slide 2",
            formats: [
              { format_id: "0", url: "https://scontent.cdninstagram.com/v/t51/p2_640.jpg", ext: "jpg", width: 640, height: 800 },
              { format_id: "1", url: "https://scontent.cdninstagram.com/v/t51/p2_1080.jpg", ext: "jpg", width: 1080, height: 1350 },
            ],
          },
          {
            id: "Cz_slide_3",
            title: "Slide 3",
            formats: [
              { format_id: "1", url: "https://scontent.cdninstagram.com/v/t51/p3_1080.jpg", ext: "jpg", width: 1080, height: 1080 },
            ],
          },
        ],
      };

      const extracted = normalizeYtDlpResult(rawInstagramData);
      const media = extractedToMedia(instaUrl, extracted);

      // Verify no duplicates: exactly 3 formats
      expect(media.formats).toHaveLength(3);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);

      // Verify ordering
      expect(media.formats[0].note).toBe("Photo 1 · direct");
      expect(media.formats[1].note).toBe("Photo 2 · direct");
      expect(media.formats[2].note).toBe("Photo 3 · direct");

      // Highest resolution picked for each
      expect(media.formats[0].quality).toBe("1080x1080");
      expect(media.formats[1].quality).toBe("1080x1350");
      expect(media.formats[2].quality).toBe("1080x1080");

      // Filenames from prepareDownload
      cacheMedia(media);
      const job1 = await prepareDownload(instaUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");
      const job2 = await prepareDownload(instaUrl, media.id, media.formats[1].id);
      expect(job2.filename).toBe("image-2.jpg");
      const job3 = await prepareDownload(instaUrl, media.id, media.formats[2].id);
      expect(job3.filename).toBe("image-3.jpg");
    });

    it("extracts Facebook photo album / multi-photo posts with correct ordering and filenames", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const fbUrl = "https://www.facebook.com/user/posts/10159999999999999";

      const mockFacebookAlbum: import("../extractors/types").ExtractedMedia = {
        id: "10159999999999999",
        title: "Community Event Album",
        uploader: "Community Organization",
        platform: "Facebook",
        formats: [
          { id: "fb-p1", ext: "jpg", vcodec: "none", width: 960, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39.30808-6/fb_img_1.jpg", formatNote: "Photo 1 · Item 1" },
          { id: "fb-p2", ext: "jpg", vcodec: "none", width: 960, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39.30808-6/fb_img_2.jpg", formatNote: "Photo 2 · Item 2" },
          { id: "fb-p3", ext: "jpg", vcodec: "none", width: 960, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39.30808-6/fb_img_3.jpg", formatNote: "Photo 3 · Item 3" },
        ],
      };

      const media = extractedToMedia(fbUrl, mockFacebookAlbum);

      expect(media.formats).toHaveLength(3);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].note).toBe("Photo 1 · direct");
      expect(media.formats[1].note).toBe("Photo 2 · direct");
      expect(media.formats[2].note).toBe("Photo 3 · direct");

      cacheMedia(media);
      const job1 = await prepareDownload(fbUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");
      const job2 = await prepareDownload(fbUrl, media.id, media.formats[1].id);
      expect(job2.filename).toBe("image-2.jpg");
      const job3 = await prepareDownload(fbUrl, media.id, media.formats[2].id);
      expect(job3.filename).toBe("image-3.jpg");
    });

    it("prepares a single ZIP download containing all 23 images for TikTok photo posts", async () => {
      const { extractedToMedia, cacheMedia, prepareZipDownload } = await import("./media");
      const tiktokUrl = "https://vt.tiktok.com/ZSqT5jt9X/";

      const mockTikTokPhotos: import("../extractors/types").ExtractedMedia = {
        id: "7559139162985338144",
        title: "Sunset over Mogadishu coast",
        uploader: "traveler",
        platform: "TikTok",
        formats: Array.from({ length: 23 }, (_, i) => ({
          id: `photo_${i + 1}`,
          ext: "jpeg",
          vcodec: "none",
          width: 1080,
          height: 1920,
          url: `https://p16-sign.tiktokcdn.com/tos-maliva-p-0068/slide_${i + 1}.jpeg`,
          formatNote: `Photo ${i + 1}`,
        })),
      };

      const media = extractedToMedia(tiktokUrl, mockTikTokPhotos);
      cacheMedia(media);

      const zipJob = await prepareZipDownload(tiktokUrl, media.id);
      expect(zipJob.totalImages).toBe(23);
      expect(zipJob.filename).toBe("Sunset_over_Mogadishu_coast.zip");
      expect(zipJob.downloadUrl).toMatch(/^\/api\/download-zip\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      const { decodeZipToken } = await import("./downloadProxy");
      const token = zipJob.downloadUrl.replace("/api/download-zip/", "");
      const decoded = decodeZipToken(token);
      expect(decoded.images).toHaveLength(23);
      expect(decoded.images[0].filename).toBe("image-1.jpg");
      expect(decoded.images[22].filename).toBe("image-23.jpg");
      expect(decoded.images[0].url).toContain("slide_1.jpeg");
      expect(decoded.images[22].url).toContain("slide_23.jpeg");
    });

    it("prioritizes maxresdefault.jpg for YouTube videos and prepares cover image download as cover.jpg", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const ytUrl = "https://www.youtube.com/watch?v=sample123";

      const mockYouTubeVideo: import("../extractors/types").ExtractedMedia = {
        id: "sample123",
        title: "Spectacular Nature 4K",
        uploader: "NatureChannel",
        duration: 300,
        platform: "YouTube",
        formats: [
          { id: "137", ext: "mp4", height: 1080, width: 1920, vcodec: "avc1", acodec: "none", url: "https://googlevideo.com/v1080.mp4" },
          { id: "140", ext: "m4a", vcodec: "none", acodec: "mp4a", url: "https://googlevideo.com/audio.m4a" },
        ],
        thumbnails: [
          { id: "default", url: "https://i.ytimg.com/vi/sample123/default.jpg", width: 120, height: 90 },
          { id: "hqdefault", url: "https://i.ytimg.com/vi/sample123/hqdefault.jpg", width: 480, height: 360 },
          { id: "sddefault", url: "https://i.ytimg.com/vi/sample123/sddefault.jpg", width: 640, height: 480 },
          // maxresdefault might not have explicit width/height in yt-dlp output
          { id: "maxresdefault", url: "https://i.ytimg.com/vi/sample123/maxresdefault.jpg" },
        ],
      };

      const media = extractedToMedia(ytUrl, mockYouTubeVideo);
      const imageFormats = media.formats.filter((f) => f.type === "image");
      expect(imageFormats.length).toBeGreaterThanOrEqual(1);

      // Verify maxresdefault is the highest priority cover image
      expect(imageFormats[0].downloadUrl).toBe("https://i.ytimg.com/vi/sample123/maxresdefault.jpg");
      expect(imageFormats[0].quality).toBe("1920x1080");
      expect(imageFormats[0].httpHeaders?.Referer).toBe("https://www.youtube.com/");

      // Verify prepareDownload assigns cover.jpg filename
      cacheMedia(media);
      const job = await prepareDownload(ytUrl, media.id, imageFormats[0].id);
      expect(job.status).toBe("completed");
      expect(job.filename).toBe("cover.jpg");
      expect(job.downloadUrl).toMatch(/^\/api\/download\//);
    });

    it("prepares individual and ZIP downloads for YouTube Community Post multi-image posts", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload, prepareZipDownload } = await import("./media");
      const { decodeZipToken } = await import("./downloadProxy");
      const postUrl = "https://www.youtube.com/post/UgkxCommunityPhotoPost123";

      const mockCommunityPost: import("../extractors/types").ExtractedMedia = {
        id: "UgkxCommunityPhotoPost123",
        title: "Behind the scenes gallery",
        uploader: "Popular Creator",
        platform: "YouTube",
        formats: [
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 1200, height: 1200, url: "https://yt3.ggpht.com/community_img_1.jpg", formatNote: "Photo 1" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 1200, height: 1200, url: "https://yt3.ggpht.com/community_img_2.jpg", formatNote: "Photo 2" },
          { id: "photo-3", ext: "jpg", vcodec: "none", width: 1200, height: 1200, url: "https://yt3.ggpht.com/community_img_3.jpg", formatNote: "Photo 3" },
        ],
        thumbnails: [
          { url: "https://yt3.ggpht.com/community_img_1.jpg", width: 1200, height: 1200 },
          { url: "https://yt3.ggpht.com/community_img_2.jpg", width: 1200, height: 1200 },
          { url: "https://yt3.ggpht.com/community_img_3.jpg", width: 1200, height: 1200 },
        ],
      };

      const media = extractedToMedia(postUrl, mockCommunityPost);
      expect(media.formats).toHaveLength(3);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.youtube.com/");

      cacheMedia(media);

      // Individual downloads
      const job1 = await prepareDownload(postUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");
      const job2 = await prepareDownload(postUrl, media.id, media.formats[1].id);
      expect(job2.filename).toBe("image-2.jpg");
      const job3 = await prepareDownload(postUrl, media.id, media.formats[2].id);
      expect(job3.filename).toBe("image-3.jpg");

      // ZIP download
      const zipJob = await prepareZipDownload(postUrl, media.id);
      expect(zipJob.totalImages).toBe(3);
      expect(zipJob.filename).toBe("Behind_the_scenes_gallery.zip");
      const decoded = decodeZipToken(zipJob.downloadUrl.replace("/api/download-zip/", ""));
      expect(decoded.images).toHaveLength(3);
      expect(decoded.images[0].url).toContain("community_img_1.jpg");
      expect(decoded.images[0].headers?.Referer).toBe("https://www.youtube.com/");
    });

    it("prepares individual and ZIP downloads for Facebook photo albums", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload, prepareZipDownload } = await import("./media");
      const { decodeZipToken } = await import("./downloadProxy");
      const fbUrl = "https://www.facebook.com/page/posts/pfbid123456789";

      const mockFbAlbum: import("../extractors/types").ExtractedMedia = {
        id: "pfbid123456789",
        title: "Grand Opening Gala Photos",
        uploader: "Event Organizers",
        platform: "Facebook",
        formats: [
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 1080, height: 720, url: "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=123456", formatNote: "Photo 1" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 1080, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39/gala_2.jpg", formatNote: "Photo 2" },
          { id: "photo-3", ext: "jpg", vcodec: "none", width: 1080, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39/gala_3.jpg", formatNote: "Photo 3" },
          { id: "photo-4", ext: "jpg", vcodec: "none", width: 1080, height: 720, url: "https://scontent.xx.fbcdn.net/v/t39/gala_4.jpg", formatNote: "Photo 4" },
        ],
      };

      const media = extractedToMedia(fbUrl, mockFbAlbum);
      expect(media.formats).toHaveLength(4);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.facebook.com/");
      expect(media.formats[0].httpHeaders?.["User-Agent"]).toContain("facebookexternalhit");

      cacheMedia(media);

      // Individual downloads
      const job1 = await prepareDownload(fbUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");

      // ZIP download
      const zipJob = await prepareZipDownload(fbUrl, media.id);
      expect(zipJob.totalImages).toBe(4);
      expect(zipJob.filename).toBe("Grand_Opening_Gala_Photos.zip");
      const decoded = decodeZipToken(zipJob.downloadUrl.replace("/api/download-zip/", ""));
      expect(decoded.images).toHaveLength(4);
      expect(decoded.images[0].url).toContain("media_id=123456");
      expect(decoded.images[0].headers?.Referer).toBe("https://www.facebook.com/");
      expect(decoded.images[0].headers?.["User-Agent"]).toContain("facebookexternalhit");
    });

    it("prepares individual downloads for Facebook Stories with platform headers", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload } = await import("./media");
      const storyUrl = "https://www.facebook.com/stories/1542030902575041/UzpfSVNDOjEwMjYyMjU2MTM3MTAzODE=/?view_single=1";

      const mockFbStory: import("../extractors/types").ExtractedMedia = {
        id: "1026225613710381",
        title: "Facebook Story",
        uploader: "Story Creator",
        platform: "Facebook",
        formats: [
          {
            id: "photo-1",
            ext: "jpg",
            vcodec: "none",
            width: 1080,
            height: 1920,
            url: "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1026225613710381",
            formatNote: "Photo",
          },
        ],
      };

      const media = extractedToMedia(storyUrl, mockFbStory);
      expect(media.formats).toHaveLength(1);
      expect(media.formats[0].type).toBe("image");
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.facebook.com/");
      expect(media.formats[0].httpHeaders?.["User-Agent"]).toContain("facebookexternalhit");

      cacheMedia(media);

      const { decodeToken } = await import("./downloadProxy");
      const job = await prepareDownload(storyUrl, media.id, media.formats[0].id);
      expect(job.filename).toBe("image.jpg");
      expect(job.downloadUrl).toContain("/api/download/");
      const token = job.downloadUrl!.replace("/api/download/", "");
      const payload = decodeToken(token);
      expect(payload.headers?.Referer).toBe("https://www.facebook.com/");
      expect(payload.headers?.["User-Agent"]).toContain("facebookexternalhit");
    });

    it("prepares individual and ZIP downloads for Snapchat multi-snap photo stories with Referer and Origin headers", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload, prepareZipDownload } = await import("./media");
      const { decodeZipToken } = await import("./downloadProxy");
      const snapUrl = "https://www.snapchat.com/add/user/story/story123";

      const mockSnapStory: import("../extractors/types").ExtractedMedia = {
        id: "story123",
        title: "City Weekend Snaps",
        uploader: "cityuser",
        platform: "Snapchat",
        formats: [
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 1080, height: 1920, url: "https://cf-st.sc-cdn.net/snap_img_1.jpg", formatNote: "Photo 1" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 1080, height: 1920, url: "https://cf-st.sc-cdn.net/snap_img_2.jpg", formatNote: "Photo 2" },
          { id: "photo-3", ext: "jpg", vcodec: "none", width: 1080, height: 1920, url: "https://cf-st.sc-cdn.net/snap_img_3.jpg", formatNote: "Photo 3" },
        ],
      };

      const media = extractedToMedia(snapUrl, mockSnapStory);
      expect(media.formats).toHaveLength(3);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.snapchat.com/");
      expect(media.formats[0].httpHeaders?.Origin).toBe("https://www.snapchat.com");

      cacheMedia(media);

      // Individual download
      const job1 = await prepareDownload(snapUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");

      // ZIP download
      const zipJob = await prepareZipDownload(snapUrl, media.id);
      expect(zipJob.totalImages).toBe(3);
      expect(zipJob.filename).toBe("City_Weekend_Snaps.zip");
      const decoded = decodeZipToken(zipJob.downloadUrl.replace("/api/download-zip/", ""));
      expect(decoded.images).toHaveLength(3);
      expect(decoded.images[0].url).toContain("snap_img_1.jpg");
      expect(decoded.images[0].headers?.Referer).toBe("https://www.snapchat.com/");
      expect(decoded.images[0].headers?.Origin).toBe("https://www.snapchat.com");
    });

    it("prepares individual and ZIP downloads for Instagram multi-photo carousels", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload, prepareZipDownload } = await import("./media");
      const { decodeZipToken } = await import("./downloadProxy");
      const instaUrl = "https://www.instagram.com/p/CzCarousel999/";

      const mockInstaCarousel: import("../extractors/types").ExtractedMedia = {
        id: "CzCarousel999",
        title: "Santorini Summer Dump",
        uploader: "travelcouple",
        platform: "Instagram",
        formats: [
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 1080, height: 1350, url: "https://scontent.cdninstagram.com/p1.jpg", formatNote: "Photo 1" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 1080, height: 1350, url: "https://scontent.cdninstagram.com/p2.jpg", formatNote: "Photo 2" },
          { id: "photo-3", ext: "jpg", vcodec: "none", width: 1080, height: 1080, url: "https://scontent.cdninstagram.com/p3.jpg", formatNote: "Photo 3" },
          { id: "photo-4", ext: "jpg", vcodec: "none", width: 1080, height: 1350, url: "https://scontent.cdninstagram.com/p4.jpg", formatNote: "Photo 4" },
          { id: "photo-5", ext: "jpg", vcodec: "none", width: 1080, height: 1080, url: "https://scontent.cdninstagram.com/p5.jpg", formatNote: "Photo 5" },
        ],
      };

      const media = extractedToMedia(instaUrl, mockInstaCarousel);
      expect(media.formats).toHaveLength(5);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://www.instagram.com/");

      cacheMedia(media);

      // Individual download
      const job1 = await prepareDownload(instaUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");

      // ZIP download
      const zipJob = await prepareZipDownload(instaUrl, media.id);
      expect(zipJob.totalImages).toBe(5);
      expect(zipJob.filename).toBe("Santorini_Summer_Dump.zip");
      const decoded = decodeZipToken(zipJob.downloadUrl.replace("/api/download-zip/", ""));
      expect(decoded.images).toHaveLength(5);
      expect(decoded.images[0].url).toContain("p1.jpg");
      expect(decoded.images[0].headers?.Referer).toBe("https://www.instagram.com/");
    });

    it("prepares individual and ZIP downloads for X (Twitter) 4-photo posts", async () => {
      const { extractedToMedia, cacheMedia, prepareDownload, prepareZipDownload } = await import("./media");
      const { decodeZipToken } = await import("./downloadProxy");
      const tweetUrl = "https://x.com/space_photos/status/1838000000000000000";

      const mockTweet4Photos: import("../extractors/types").ExtractedMedia = {
        id: "1838000000000000000",
        title: "James Webb Deep Field 4 views",
        uploader: "NASA Webb Telescope",
        platform: "X",
        formats: [
          { id: "photo-1", ext: "jpg", vcodec: "none", width: 2048, height: 2048, url: "https://pbs.twimg.com/media/nebula1.jpg?name=orig", formatNote: "Photo 1" },
          { id: "photo-2", ext: "jpg", vcodec: "none", width: 2048, height: 2048, url: "https://pbs.twimg.com/media/nebula2.jpg?name=orig", formatNote: "Photo 2" },
          { id: "photo-3", ext: "jpg", vcodec: "none", width: 2048, height: 2048, url: "https://pbs.twimg.com/media/nebula3.jpg?name=orig", formatNote: "Photo 3" },
          { id: "photo-4", ext: "jpg", vcodec: "none", width: 2048, height: 2048, url: "https://pbs.twimg.com/media/nebula4.jpg?name=orig", formatNote: "Photo 4" },
        ],
      };

      const media = extractedToMedia(tweetUrl, mockTweet4Photos);
      expect(media.formats).toHaveLength(4);
      expect(media.formats.every((f) => f.type === "image")).toBe(true);
      expect(media.formats[0].httpHeaders?.Referer).toBe("https://x.com/");

      cacheMedia(media);

      // Individual download
      const job1 = await prepareDownload(tweetUrl, media.id, media.formats[0].id);
      expect(job1.filename).toBe("image-1.jpg");

      // ZIP download
      const zipJob = await prepareZipDownload(tweetUrl, media.id);
      expect(zipJob.totalImages).toBe(4);
      expect(zipJob.filename).toBe("James_Webb_Deep_Field_4_views.zip");
      const decoded = decodeZipToken(zipJob.downloadUrl.replace("/api/download-zip/", ""));
      expect(decoded.images).toHaveLength(4);
      expect(decoded.images[0].url).toContain("nebula1.jpg");
      expect(decoded.images[0].headers?.Referer).toBe("https://x.com/");
    });
  });

  describe("Facebook Story HTML and Page Source support", () => {
    it("detects Facebook HTML and view-source strings with isFacebookHtml", () => {
      expect(isFacebookHtml("<!DOCTYPE html><html><head><title>Facebook</title></head><body></body></html>")).toBe(true);
      expect(isFacebookHtml('{"playable_url": "https://video.xx.fbcdn.net/v/123.mp4"}')).toBe(true);
      expect(isFacebookHtml('{"viewer_image": {"uri": "https://scontent.xx.fbcdn.net/v/photo.jpg"}}')).toBe(true);
      expect(isFacebookHtml("view-source:https://www.facebook.com/stories/123/456/")).toBe(true);
      expect(isFacebookHtml("https://www.youtube.com/watch?v=123")).toBe(false);
      expect(isFacebookHtml("https://www.facebook.com/stories/123/456/")).toBe(false);
    });

    it("detectPlatform returns 'Facebook' for Facebook Story page source HTML", () => {
      const html = '<!DOCTYPE html><html><title>Story | Facebook</title><script>"playable_url_quality_hd":"https:\\/\\/video.xx.fbcdn.net\\/v\\/story.mp4"</script></html>';
      expect(detectPlatform(html)).toBe("Facebook");
      expect(detectPlatform("view-source:https://www.facebook.com/stories/123/456/")).toBe("Facebook");
    });

    it("resolves Facebook Story HTML into a MediaAnalysis with downloadable video and photo formats", async () => {
      const storyHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Alex - Story | Facebook</title>
          <meta property="og:title" content="Alex | Facebook" />
        </head>
        <body>
          <script>
            requireLazy(["ServerJS"], function(s) {
              s.handle({
                "playable_url_quality_hd": "https:\\/\\/video.xx.fbcdn.net\\/v\\/t39.25447-2\\/story_1080p.mp4?_nc_cat=101",
                "playable_url": "https:\\/\\/video.xx.fbcdn.net\\/v\\/t39.25447-2\\/story_720p.mp4?_nc_cat=101",
                "viewer_image": {"uri": "https:\\/\\/scontent.xx.fbcdn.net\\/v\\/t39.30808-6\\/story_preview.jpg?_nc_cat=102"}
              });
            });
          </script>
        </body>
        </html>
      `;
      const media = await resolveMedia(storyHtml);
      expect(media.platform).toBe("Facebook");
      expect(media.title).toBe("Alex - Story");
      expect(media.creator).toBe("Alex");
      expect(media.formats.length).toBeGreaterThanOrEqual(2);
      expect(media.formats.some((f) => f.type === "video")).toBe(true);
      expect(media.formats.some((f) => f.type === "image")).toBe(true);
    });
  });
});
