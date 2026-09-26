import io
import json
import os
import sys
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor

def fetch_image(item):
    filename = item.get("filename", "image.jpg")
    url = item.get("url")
    headers = item.get("headers") or {}
    if not url:
        return filename, None

    default_headers = {
        "User-Agent": headers.get("User-Agent") or headers.get("user-agent") or "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "*/*",
    }

    if url.startswith("file://"):
        try:
            with urllib.request.urlopen(url) as resp:
                return filename, resp.read()
        except Exception as e:
            sys.stderr.write(f"[createZip] Failed to read local file {url}: {e}\n")
            return filename, None

    # Set referer based on domain
    referer = headers.get("Referer") or headers.get("referer")
    if not referer:
        if "tiktok" in url or "byteoversea" in url or "ibytedtos" in url:
            referer = "https://www.tiktok.com/"
        elif "instagram" in url or "cdninstagram" in url:
            referer = "https://www.instagram.com/"
        elif "twimg" in url or "twitter" in url or "x.com" in url:
            referer = "https://x.com/"
        elif "facebook" in url or "fbcdn" in url or "fbsbx" in url:
            referer = "https://www.facebook.com/"
            if "lookaside.fbsbx.com" in url:
                default_headers["User-Agent"] = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
        elif "snapchat" in url or "sc-cdn" in url:
            referer = "https://www.snapchat.com/"
            default_headers["Origin"] = "https://www.snapchat.com"
        elif "youtube" in url or "ytimg" in url or "ggpht" in url:
            referer = "https://www.youtube.com/"
        else:
            referer = "https://www.google.com/"
    default_headers["Referer"] = referer
    if ("snapchat" in url or "sc-cdn" in url) and "Origin" not in default_headers:
        default_headers["Origin"] = "https://www.snapchat.com"

    try:
        req = urllib.request.Request(url, headers=default_headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status == 200:
                data = resp.read()
                return filename, data
            else:
                sys.stderr.write(f"[createZip] HTTP {resp.status} for {url}\n")
                return filename, None
    except Exception as e:
        sys.stderr.write(f"[createZip] Failed to fetch {url}: {e}\n")
        return filename, None

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            sys.exit(1)
        payload = json.loads(raw_input)
        images = payload.get("images", [])
        if not images:
            sys.exit(1)

        # Concurrently fetch all images
        max_workers = min(12, max(2, len(images)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(fetch_image, images))

        # Build zip in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for filename, content in results:
                if content:
                    zf.writestr(filename, content)

        # Output zip to stdout
        sys.stdout.buffer.write(zip_buffer.getvalue())
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"[createZip fatal error] {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
