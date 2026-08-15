import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4199);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
};

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname || '/');
  const rel = normalize(decoded).replace(/^[/\\]+/, '');
  return join(root, rel || 'index.html');
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let file = safePath(url.pathname);
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, 'index.html');
    } catch {
      if (!extname(url.pathname)) file = join(root, 'index.html');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('404 - file not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`GUANYU LAB R22.2 Launch Fix: http://127.0.0.1:${port}`);
});
