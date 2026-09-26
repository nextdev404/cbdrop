export interface SeoToolPreset {
  slug: string;
  path: string;
  title: string;
  metaDescription: string;
  badgeText: string;
  heroHeadline: string;
  heroHighlight: string;
  heroSubheadline: string;
  inputPlaceholder: string;
  primaryPlatform: "YouTube" | "TikTok" | "Instagram" | "Facebook" | "Snapchat" | "X";
  description: string;
  iconName: string;
  features: { title: string; desc: string }[];
  faqs: [string, string][];
}

export const SEO_PRESETS: Record<string, SeoToolPreset> = {
  "youtube-video-downloader": {
    slug: "youtube-video-downloader",
    path: "/youtube-video-downloader",
    title: "YouTube Video Downloader (4K, 1080p HD, MP4) — CBdrop",
    metaDescription: "Download any YouTube video in 4K, 1080p HD, or 720p MP4. Free, ultra-fast, and resumable in your browser with no software required.",
    badgeText: "YouTube 4K & HD Downloader",
    heroHeadline: "Download YouTube videos,",
    heroHighlight: "in 4K & HD",
    heroSubheadline: "Save any public YouTube video in crystal-clear 4K, 1080p, or 720p. Fast, resumable browser downloads with pre-calculated file sizes.",
    inputPlaceholder: "Paste a YouTube video or Shorts link (e.g. https://www.youtube.com/watch?v=...)",
    primaryPlatform: "YouTube",
    description: "Save YouTube videos in full 4K, 1080p, 720p MP4, and WEBM formats with audio included.",
    iconName: "YouTube",
    features: [
      { title: "Ultra HD 4K & 1080p", desc: "Download in the highest available resolution with crisp 60fps support." },
      { title: "Resumable Downloads", desc: "Native HTTP byte-range support ensures interrupted downloads resume seamlessly." },
      { title: "Exact File Sizes", desc: "Know the exact file size before starting your download." },
      { title: "No Software Needed", desc: "Works completely inside your browser on mobile, tablet, and desktop." },
    ],
    faqs: [
      ["Can I download YouTube videos in 4K?", "Yes! CBdrop supports up to 4K Ultra HD and 1080p 60fps downloads for public videos."],
      ["Does the download include audio?", "Yes, all video downloads come with high-fidelity synchronized stereo audio."],
      ["Is this YouTube downloader free?", "Yes, you can analyze and download public YouTube videos without installing any apps or extensions."],
    ],
  },

  "youtube-to-mp3": {
    slug: "youtube-to-mp3",
    path: "/youtube-to-mp3",
    title: "YouTube to MP3 Audio Converter & Downloader — CBdrop",
    metaDescription: "Convert YouTube videos to high-quality MP3 and M4A audio files in seconds. Free, studio quality, with no software needed.",
    badgeText: "YouTube to MP3 Audio",
    heroHeadline: "Convert YouTube to,",
    heroHighlight: "Studio MP3",
    heroSubheadline: "Extract high-bitrate MP3 and M4A audio from any YouTube video or podcast. Clean, instant audio tracks ready for offline listening.",
    inputPlaceholder: "Paste YouTube link to extract MP3 audio (e.g. music, podcasts, speeches)...",
    primaryPlatform: "YouTube",
    description: "Extract clean MP3 and M4A audio tracks from music, podcasts, lectures, and interviews.",
    iconName: "YouTube",
    features: [
      { title: "High-Bitrate Audio", desc: "Extract clean audio streams up to 320kbps / 128kbps without recompression loss." },
      { title: "Instant Conversion", desc: "Audio is extracted and streamed on the fly without waiting in server queues." },
      { title: "Universal Compatibility", desc: "Plays on iPhone, Android, Mac, Windows, and car stereo systems." },
      { title: "Free & Unlimited", desc: "Convert your favorite podcasts, lectures, and background audio anytime." },
    ],
    faqs: [
      ["What audio formats are supported?", "We provide direct MP3 and M4A audio containers compatible with all modern media players."],
      ["How fast is the conversion?", "Extraction happens in real time. Your audio download starts within seconds."],
      ["Can I download long podcast episodes?", "Yes, CBdrop handles both short clips and multi-hour podcasts smoothly."],
    ],
  },

  "youtube-shorts-downloader": {
    slug: "youtube-shorts-downloader",
    path: "/youtube-shorts-downloader",
    title: "YouTube Shorts Downloader (HD & MP4) — CBdrop",
    metaDescription: "Download YouTube Shorts in Full HD MP4 quality. Fast, free vertical video downloader for mobile and desktop creators.",
    badgeText: "YouTube Shorts Downloader",
    heroHeadline: "Download YouTube Shorts,",
    heroHighlight: "in Full HD",
    heroSubheadline: "Save vertical YouTube Shorts in high quality MP4. Perfect for creators, remixers, and offline viewing.",
    inputPlaceholder: "Paste a YouTube Shorts URL (e.g. https://youtube.com/shorts/...)...",
    primaryPlatform: "YouTube",
    description: "Download vertical YouTube Shorts in 1080p Full HD MP4 with original sound.",
    iconName: "YouTube",
    features: [
      { title: "Full HD 1080p Vertical", desc: "Saves Shorts in pristine 9:16 vertical resolution." },
      { title: "Original Audio Included", desc: "Every Short includes its original music, sound effects, and voice track." },
      { title: "One-Click Mobile Save", desc: "Save directly to your camera roll on iOS and Android devices." },
      { title: "No Watermarks", desc: "Get clean video files ready for offline viewing or creative remixing." },
    ],
    faqs: [
      ["How do I get a YouTube Shorts link?", "Click the 'Share' button under any YouTube Short and tap 'Copy link'."],
      ["Will this save to my phone's camera roll?", "Yes, the downloaded MP4 saves directly into your device's downloads folder or camera roll."],
      ["Is there a limit on Shorts downloads?", "No, you can download public Shorts anytime with no software required."],
    ],
  },

  "tiktok-downloader": {
    slug: "tiktok-downloader",
    path: "/tiktok-downloader",
    title: "TikTok Video & Photo Carousel Downloader (No Watermark) — CBdrop",
    metaDescription: "Download TikTok videos without watermark in HD, and save TikTok photo slideshows with 1-Click ZIP archives. 100% Free.",
    badgeText: "TikTok HD & Carousel Downloader",
    heroHeadline: "Download TikTok videos,",
    heroHighlight: "No Watermark",
    heroSubheadline: "Save TikTok videos in clean HD without watermark, plus download multi-photo carousel slideshows in 1-Click ZIP archives.",
    inputPlaceholder: "Paste a TikTok video or photo carousel link (e.g. https://vm.tiktok.com/...)...",
    primaryPlatform: "TikTok",
    description: "Download TikTok videos without watermark, plus batch download 20+ photo carousels in 1-Click ZIP.",
    iconName: "TikTok",
    features: [
      { title: "No Watermark HD", desc: "Download clean TikTok videos without the floating watermark logo." },
      { title: "Photo Carousel ZIP", desc: "Download all photos from 20+ slide TikTok posts together in a single ZIP." },
      { title: "Background Music (MP3)", desc: "Extract the trending viral audio track alongside photos or video." },
      { title: "Instant Mobile Download", desc: "Works seamlessly on iPhone, iPad, Android, and PC browsers." },
    ],
    faqs: [
      ["Can I download TikTok photo carousels?", "Yes! CBdrop extracts all individual photos and lets you download them all in 1-Click ZIP."],
      ["Is the watermark removed?", "Yes, our extractor pulls the original watermark-free video stream directly from the platform."],
      ["Do I need a TikTok account?", "No account or login is required. Just paste the public TikTok link."],
    ],
  },

  "instagram-downloader": {
    slug: "instagram-downloader",
    path: "/instagram-downloader",
    title: "Instagram Reel, Video & Carousel Downloader — CBdrop",
    metaDescription: "Download Instagram Reels, public post videos, and multi-image photo carousels. Free, high-speed, and 100% secure.",
    badgeText: "Instagram Media Downloader",
    heroHeadline: "Download Instagram Reels,",
    heroHighlight: "and Carousels",
    heroSubheadline: "Save public Instagram Reels, feed videos, and high-resolution photo carousels with 1-Click ZIP support.",
    inputPlaceholder: "Paste an Instagram Reel or post link (e.g. https://www.instagram.com/reel/...)...",
    primaryPlatform: "Instagram",
    description: "Download Instagram Reels, videos, and multi-slide carousels in high resolution.",
    iconName: "Instagram",
    features: [
      { title: "Reels & Feed Videos", desc: "Download Instagram Reels and video posts in original 1080p MP4 quality." },
      { title: "Full Carousel ZIP", desc: "Extract and download all photos from multi-slide Instagram posts in one click." },
      { title: "High-Resolution Photos", desc: "Grab maximum resolution images without aggressive Instagram compression." },
      { title: "No Login Required", desc: "Download public Instagram content without logging into your personal account." },
    ],
    faqs: [
      ["Can I download Instagram Reels?", "Yes, paste any public Instagram Reel URL to get the full-speed MP4 download."],
      ["How do I download an Instagram carousel?", "Paste the post link. CBdrop detects all slides and lets you download each or grab the entire set as a ZIP archive."],
      ["Does this work with private Instagram accounts?", "CBdrop works with public posts and stories only."],
    ],
  },

  "facebook-video-downloader": {
    slug: "facebook-video-downloader",
    path: "/facebook-video-downloader",
    title: "Facebook Video & Reel Downloader (HD & MP4) — CBdrop",
    metaDescription: "Download Facebook videos, public reels, and watch clips in Full HD 1080p and 720p MP4. Free and instant.",
    badgeText: "Facebook Video Downloader",
    heroHeadline: "Download Facebook videos,",
    heroHighlight: "in Full HD",
    heroSubheadline: "Save public Facebook videos, Reels, and Watch clips in 1080p and 720p MP4 format. No software required.",
    inputPlaceholder: "Paste a Facebook video, reel, or watch link (e.g. https://www.facebook.com/watch?v=...)...",
    primaryPlatform: "Facebook",
    description: "Download public Facebook videos and reels in 1080p and 720p MP4 formats.",
    iconName: "Facebook",
    features: [
      { title: "Full HD 1080p & 720p", desc: "Choose between high-definition 1080p or standard 720p MP4 formats." },
      { title: "Public Reels & Watch", desc: "Supports Facebook Reels, feed videos, and Facebook Watch pages." },
      { title: "Fast Streaming Proxy", desc: "High-speed resumable downloads directly to your device." },
      { title: "100% Free & Safe", desc: "No browser extensions, no toolbars, and no registration required." },
    ],
    faqs: [
      ["How do I download Facebook videos?", "Copy the link of any public Facebook video, paste it in the box above, and choose your resolution."],
      ["Are Facebook Reels supported?", "Yes! Public Facebook Reels can be downloaded in MP4 format."],
      ["Can I download on my phone?", "Yes, CBdrop works perfectly on both iOS and Android mobile browsers."],
    ],
  },

  "youtube-thumbnail-downloader": {
    slug: "youtube-thumbnail-downloader",
    path: "/youtube-thumbnail-downloader",
    title: "YouTube Thumbnail Downloader (HD & 4K MaxRes) — CBdrop",
    metaDescription: "Download YouTube video thumbnails in HD, 1080p, and 4K MaxRes quality. Instant JPG download for creators and designers.",
    badgeText: "YouTube Thumbnail Grabber",
    heroHeadline: "Download YouTube covers,",
    heroHighlight: "in MaxRes HD",
    heroSubheadline: "Extract and download official YouTube cover thumbnails in Maximum Resolution (1280x720 and 4K). Clean JPG image downloads.",
    inputPlaceholder: "Paste a YouTube video URL to grab its HD cover thumbnail...",
    primaryPlatform: "YouTube",
    description: "Extract maximum-resolution YouTube video thumbnails in crisp JPG format.",
    iconName: "YouTube",
    features: [
      { title: "Max Resolution (1080p/720p)", desc: "Grabs the official maxresdefault.jpg cover in highest available quality." },
      { title: "Multiple Sizes", desc: "Offers High Quality, Standard, and Medium resolution fallbacks automatically." },
      { title: "Instant JPG Download", desc: "No transcoding delay—downloads the direct image file instantly." },
      { title: "Ideal for Designers", desc: "Perfect for video editors, thumbnail designers, and inspiration archives." },
    ],
    faqs: [
      ["What thumbnail sizes are available?", "We provide the original MaxRes (1280×720 or 1920×1080) when uploaded by the creator, with automatic fallbacks."],
      ["Is the downloaded file a clean JPG?", "Yes, thumbnails are saved cleanly as `.jpg` image files that open in any image viewer."],
      ["How do I get the link?", "Copy any regular YouTube or Shorts URL and paste it above."],
    ],
  },

  "snapchat-downloader": {
    slug: "snapchat-downloader",
    path: "/snapchat-downloader",
    title: "Snapchat Video & Spotlight Downloader (HD & MP4) — CBdrop",
    metaDescription: "Download Snapchat Spotlight videos, public stories, and clips in clean HD MP4 without watermark. Free, fast, and no app required.",
    badgeText: "Snapchat Spotlight Downloader",
    heroHeadline: "Download Snapchat videos,",
    heroHighlight: "Spotlights & Stories",
    heroSubheadline: "Save Snapchat Spotlight clips and public stories in clean HD MP4 with original sound. Fast, vertical video downloads directly to your device.",
    inputPlaceholder: "Paste a Snapchat Spotlight or Story link (e.g. https://www.snapchat.com/spotlight/...)...",
    primaryPlatform: "Snapchat",
    description: "Download Snapchat Spotlight vertical videos and public stories in HD MP4 without watermarks.",
    iconName: "Snapchat",
    features: [
      { title: "Full HD Vertical Video", desc: "Download Spotlight videos in crisp 9:16 vertical resolution." },
      { title: "Original Audio Included", desc: "Every download comes with synchronized high-quality background audio." },
      { title: "No Watermark", desc: "Get clean video files without intrusive overlay watermarks." },
      { title: "No App Installation", desc: "Save directly to your camera roll or desktop browser in one click." },
    ],
    faqs: [
      ["How do I download a Snapchat Spotlight video?", "Tap the 'Share' icon on any Snapchat Spotlight clip, choose 'Copy Link', paste it above, and click Download."],
      ["Does the video keep its original sound?", "Yes, the full original audio track and music are included in the downloaded MP4 file."],
      ["Can I download on iPhone or Android?", "Yes, CBdrop works directly in Safari, Chrome, and all mobile browsers without downloading any third-party app."],
    ],
  },

  "x-downloader": {
    slug: "x-downloader",
    path: "/x-downloader",
    title: "X / Twitter Video Downloader (HD 1080p, MP4, GIF) — CBdrop",
    metaDescription: "Download X (Twitter) videos, GIFs, and clips in Full HD 1080p and 720p MP4. Free, fast, and instant with no software required.",
    badgeText: "X (Twitter) Video Downloader",
    heroHeadline: "Download X / Twitter videos,",
    heroHighlight: "in Full HD & GIFs",
    heroSubheadline: "Save high-resolution videos, thread clips, and animated GIFs from X (Twitter) in crystal-clear MP4. Fast, secure, and permission-first.",
    inputPlaceholder: "Paste an X (Twitter) post URL (e.g. https://x.com/username/status/...)...",
    primaryPlatform: "X",
    description: "Download X (Twitter) videos and animated GIFs in 1080p, 720p, and MP4 formats.",
    iconName: "X",
    features: [
      { title: "1080p & 720p Resolutions", desc: "Choose between high-definition 1080p, 720p, or compact mobile sizes." },
      { title: "GIF & Video Support", desc: "Seamlessly converts animated Twitter GIFs and video posts into clean MP4s." },
      { title: "Thread & Quote Support", desc: "Download media attached to replies, quotes, and viral X threads." },
      { title: "Instant Browser Save", desc: "Direct download links start immediately with no waiting queues." },
    ],
    faqs: [
      ["How do I get an X (Twitter) video link?", "Click the 'Share' button beneath any tweet or post on X, select 'Copy link to post', and paste it here."],
      ["Can I download animated GIFs from X?", "Yes! Twitter stores GIFs as loopable MP4 files, which CBdrop extracts in full quality."],
      ["Does this support both x.com and twitter.com links?", "Yes, links from both x.com and legacy twitter.com are fully supported."],
    ],
  },
};

export const ALL_SEO_TOOLS = Object.values(SEO_PRESETS);
