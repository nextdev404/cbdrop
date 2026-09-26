import express, { type Express } from "express";
import type { Server } from "http";
import path from "node:path";
import fs from "node:fs";

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api")) return next();
    try {
      const templatePath = path.resolve(process.cwd(), "client/index.html");
      let template = fs.readFileSync(templatePath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const possiblePaths = [
    path.resolve(process.cwd(), "client/dist"),
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(process.cwd(), "dist"),
  ];
  const distPath = possiblePaths.find(p => fs.existsSync(path.resolve(p, "index.html")));
  if (distPath) {
    app.use(express.static(distPath));
    app.use("*", (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  } else {
    const clientPath = path.resolve(process.cwd(), "client");
    app.use(express.static(clientPath));
  }
}
