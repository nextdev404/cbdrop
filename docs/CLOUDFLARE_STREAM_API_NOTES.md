# Verified Cloudflare Stream API notes

Sources:

- https://developers.cloudflare.com/stream/uploading-videos/upload-via-link/
- https://developers.cloudflare.com/stream/viewing-videos/download-videos/
- https://developers.cloudflare.com/api/resources/stream/methods/get/

The upload-via-link endpoint is `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/copy` with Bearer API token auth and JSON such as `{ "url": "https://direct-file.example/video.mp4", "meta": { "name": "..." } }`. The response returns a Cloudflare video UID and processing status. Video details are retrieved with `GET /accounts/{account_id}/stream/{identifier}`; useful fields include `uid`, `thumbnail`, `readyToStream`, `status.state`, `status.pctComplete`, `duration`, `input.width`, `input.height`, `preview`, `playback.hls`, `playback.dash`, and metadata.

Download generation uses `POST /accounts/{account_id}/stream/{video_uid}/downloads` for MP4 or `/downloads/audio` for M4A. The response includes a URL and async status such as `inprogress`; the URL becomes usable when a subsequent `GET /accounts/{account_id}/stream/{video_uid}/downloads` returns `status: ready`. Generated MP4 files can be retrieved from the returned URL, with `?filename=...` available for a safe suggested filename. Cloudflare documents signed download requirements separately; CBdrop should only expose HTTPS URLs and should not treat a social post/page URL as a direct media file.

Implementation constraint: this provider handles direct accessible media files the user is authorized to use. It is not a general social-platform page resolver, scraper, login-session bypass, DRM bypass, or copyright verifier.
