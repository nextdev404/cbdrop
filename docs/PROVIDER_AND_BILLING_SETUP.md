# CBdrop provider and billing setup

CBdrop now accepts social-media post URLs through a dedicated **yt-dlp extractor layer**. The request pipeline is:

```text
User URL → normalize and validate → detect platform → yt-dlp extraction → format selection → download URL
```

Supported platform families are YouTube, TikTok, Facebook, Instagram, Snapchat, and X/Twitter. The original user URL does not need to end in a video-file extension. The extractor inspects returned direct formats as well as HLS (`.m3u8`) and DASH (`.mpd`) manifests.

## Runtime requirements

The development environment needs `yt-dlp` and `ffmpeg` on `PATH`. The project includes a root `Dockerfile` that installs both packages for deployment and sets `YTDLP_BIN=yt-dlp`. A custom `YTDLP_BIN` path may be supplied when running elsewhere.

The server calls yt-dlp with a bounded, metadata-only command:

```text
yt-dlp --dump-single-json --no-playlist --skip-download --no-warnings URL
```

No media bytes are stored in the database. The server returns the selected extractor-provided HTTPS media URL to the client. Some returned URLs are short-lived, so users should download promptly. For production, a server-side proxy or object-storage handoff may be preferable when a provider's URL expires too quickly or is blocked by browser CORS behavior.

## Permission and failure behavior

Users must only submit content they have permission to download. CBdrop does not bypass DRM, authentication, private-post permissions, age gates, or access controls. If extraction fails, the UI reports that the post may be private, unavailable, age-restricted, or unsupported instead of exposing runtime secrets.

## Cloudflare Stream

Cloudflare Stream remains available for direct authorized HTTPS media-file URLs and asynchronous MP4/M4A generation when these server-side secrets are configured:

```text
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=stream-read-write-token
```

The API token should have the minimum Cloudflare Stream permissions required for the account. Cloudflare is not used to resolve social post pages; yt-dlp is the social extractor.

## Account and usage behavior

The database migration adds `download_jobs`, `user_preferences`, and `usage_counters`, plus plan and Stripe identifier fields on `users`. Free accounts receive five analyses and three downloads per UTC calendar month. Pro accounts receive 1,000 analyses and 1,000 downloads per month. Completed and processing jobs are stored with source metadata, selected format, status, and an optional media URL. Media bytes are never stored locally.

## Premium activation

The premium plans and dashboard upgrade flow are implemented, but hosted checkout is gated until Stripe credentials are configured in the project payment settings:

```text
STRIPE_SECRET_KEY
VITE_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
```

Stripe should remain the source of truth for prices, payment status, invoices, and subscription lifecycle. CBdrop should store only Stripe customer and subscription identifiers locally.
