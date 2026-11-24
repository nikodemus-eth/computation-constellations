import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("."),
  port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const testPreview = pathname === "/tests/preview";
      const path = resolve(
        root,
        "." + (pathname === "/" || testPreview ? "/index.html" : pathname),
      );
      if (
        !path.startsWith(root + "/") ||
        pathname.includes("/.") ||
        ![
          "/index.html",
          "/styles.css",
          "/src/app.js",
          "/src/model.js",
          "/src/io.js",
          "/tests/browser.html",
          "/tests/browser.js",
          "/tests/preview",
        ].includes(pathname === "/" ? "/index.html" : pathname)
      ) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] || "text/plain",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors " +
          (testPreview ? "'self'" : "'none'"),
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Computation Constellations → http://127.0.0.1:${port}`),
  );
