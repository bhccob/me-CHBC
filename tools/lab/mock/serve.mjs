// LAB ONLY (throwaway): serves the browser mock-ups of the coin brief and the two extra ideas on http://localhost:5180.
// Only the folders the pages need are served (the mock-ups, three, postprocessing, the fonts, the project pictures and
// the rendered frames), so the rest of the repo, .env included, is never on the wire.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const PORT = Number(process.env.PORT ?? 5180);
const OPEN = ['/tools/lab/mock/', '/node_modules/three/', '/node_modules/postprocessing/', '/node_modules/@fontsource/', '/public/flight/', '/proof-out/lab/mock/'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (path === '/') path = '/tools/lab/mock/index.html';
  if (path.endsWith('/')) path += 'index.html';
  const clean = normalize(path).replaceAll('\\', '/');
  const file = join(ROOT, clean);
  if (!OPEN.some((prefix) => clean.startsWith(prefix)) || !file.startsWith(ROOT)) {
    res.writeHead(404).end('not served');
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`mock-ups on http://localhost:${PORT}/`));
