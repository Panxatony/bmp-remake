// Statischer Server: liefert index.html, dist/app.js und die Assets aus dem Repo.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
// Entwicklung: Original-Spielstände aus dem Nachbarordner (BMP_DIR) unter /saves/
const saves = process.env.BMP_DIR ?? resolve(root, "../bmp");
const web = import.meta.dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
const port = Number(process.env.PORT ?? 8765);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file;
  if (url.pathname === "/") file = join(web, "index.html");
  else if (url.pathname.startsWith("/dist/")) file = join(web, url.pathname);
  else if (url.pathname.startsWith("/assets/")) file = join(root, url.pathname);
  else if (url.pathname.startsWith("/saves/")) file = join(saves, url.pathname.slice(7));
  else file = null;
  try {
    if (!file || file.includes("..")) throw new Error("nicht gefunden");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("nicht gefunden");
  }
}).listen(port, () => console.log(`Bundesliga Manager Prototyp: http://localhost:${port}/`));
