#!/usr/bin/env node
/*
 * Astro Adventures – local web server (no installs needed, Node 18+)
 *
 *   node tools/serve.mjs        →  open http://localhost:5173
 *
 * Why: the Space Buddies backend only accepts chat requests from
 * http://localhost:5173 and http://127.0.0.1:5173 (its CORS settings),
 * so the game must be opened from here (not by double-clicking index.html)
 * for "Ask PIP" to work.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, "." + rel);
  if (!file.startsWith(ROOT + path.sep) || rel.split("/").some((p) => p.startsWith("."))) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Astro Adventures is running at http://localhost:${PORT}`);
});
