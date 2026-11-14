import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const root = new URL("../web/", import.meta.url);
const files = new Map([
  ["", "text/html; charset=utf-8"], ["index.html", "text/html; charset=utf-8"],
  ["style.css", "text/css; charset=utf-8"],
  ["questions.js", "text/javascript; charset=utf-8"], ["app.js", "text/javascript; charset=utf-8"],
  ["admin.html", "text/html; charset=utf-8"], ["admin.css", "text/css; charset=utf-8"],
  ["admin.js", "text/javascript; charset=utf-8"], ["backend-config.js", "text/javascript; charset=utf-8"],
  ["sw.js", "text/javascript; charset=utf-8"], ["manifest.webmanifest", "application/manifest+json"],
  ["icon-192.png", "image/png"], ["icon-512.png", "image/png"],
]);

const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname.slice(1);
  if (!files.has(path)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const contents = await readFile(new URL(path || "index.html", root));
    res.writeHead(200, { "Content-Type": files.get(path), "Cache-Control": "no-cache" }).end(contents);
  } catch {
    res.writeHead(500).end();
  }
}).listen(port, "127.0.0.1", () => console.log("http://127.0.0.1:" + port));
