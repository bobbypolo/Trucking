import express, { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

/**
 * Mounts static file serving + SPA fallback for the built frontend.
 *
 * When `dist/` exists (relative to the compiled server), serves static
 * assets and falls back to `index.html` for any non-API GET so React Router
 * can handle client-side routing. This is required for Cloudflare tunnel
 * (one URL, one port) and for any single-port deployment of the SaaS UI.
 *
 * No-op when `dist/` is missing — useful for dev mode where Vite serves
 * the frontend on a separate port.
 *
 * This helper exists so `server/index.ts` stays under the 130-line
 * modularization cap (R-P1-02 AC1) and contains no direct route handlers
 * except `/api/health`.
 */
export function mountSpaFallback(app: Express): void {
  const distPath = path.resolve(__dirname, "../../dist");
  if (!fs.existsSync(distPath)) {
    return;
  }

  app.use(express.static(distPath));
  // SPA fallback: any non-API GET that doesn't match a static file
  // returns index.html so React Router handles client-side routing.
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
  logger.info({ distPath }, "Serving static frontend from dist/");
}
