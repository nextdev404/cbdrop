import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerDownloadProxy } from "../services/downloadProxy";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer({ maxHeaderSize: 64 * 1024 }, app);

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerDownloadProxy(app);
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);

  // Reliable image proxy for external platform thumbnails (YouTube, TikTok, etc.)
  app.get("/api/thumbnail-proxy", async (req, res) => {
    const rawUrl = req.query.url;
    if (typeof rawUrl !== "string" || !rawUrl.startsWith("http")) {
      res.status(400).send("Invalid URL");
      return;
    }

    const urlsToTry = [rawUrl];
    if (rawUrl.includes("ytimg.com") || rawUrl.includes("youtube.com")) {
      if (rawUrl.includes("maxresdefault")) {
        urlsToTry.push(rawUrl.replace(/maxresdefault\.[a-z0-9]+/i, "sddefault.jpg"));
        urlsToTry.push(rawUrl.replace(/maxresdefault\.[a-z0-9]+/i, "hqdefault.jpg"));
        urlsToTry.push(rawUrl.replace(/maxresdefault\.[a-z0-9]+/i, "mqdefault.jpg"));
      }
      if (rawUrl.endsWith(".webp")) {
        urlsToTry.push(rawUrl.replace(/\.webp$/i, ".jpg"));
      }
    }

    let referer = "https://www.google.com/";
    try {
      const u = new URL(rawUrl);
      if (u.hostname.includes("youtube.com") || u.hostname.includes("ytimg.com")) {
        referer = "https://www.youtube.com/";
      } else if (u.hostname.includes("instagram.com") || u.hostname.includes("cdninstagram.com")) {
        referer = "https://www.instagram.com/";
      } else if (u.hostname.includes("snapchat.com") || u.hostname.includes("sc-cdn.net")) {
        referer = "https://www.snapchat.com/";
      } else if (u.hostname.includes("tiktok.com") || u.hostname.includes("byteoversea.com")) {
        referer = "https://www.tiktok.com/";
      } else if (u.hostname.includes("facebook.com") || u.hostname.includes("fbcdn.net") || u.hostname.includes("fbsbx.com")) {
        referer = "https://www.facebook.com/";
      } else if (u.hostname.includes("x.com") || u.hostname.includes("twitter.com") || u.hostname.includes("twimg.com")) {
        referer = "https://x.com/";
      }
    } catch {}

    for (const targetUrl of urlsToTry) {
      try {
        const isLookaside = targetUrl.includes("lookaside.fbsbx.com");
        const ua = isLookaside
          ? "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
          : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": ua,
            "Referer": referer,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });
        if (response.ok && response.body) {
          const contentType = response.headers.get("content-type") || "image/jpeg";
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

          const arrayBuffer = await response.arrayBuffer();
          res.send(Buffer.from(arrayBuffer));
          return;
        }
      } catch {
        // try next candidate
      }
    }

    res.status(404).send("Thumbnail not found");
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV !== "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
