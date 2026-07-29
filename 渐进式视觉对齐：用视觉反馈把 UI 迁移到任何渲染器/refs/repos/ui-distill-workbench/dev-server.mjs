import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const clients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const liveReloadScript = `
<script>
  new EventSource('/__reload').addEventListener('reload', () => location.reload());
</script>`;

function resolveFile(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const relative = pathname === '/' ? '/index.html' : pathname;
  const file = normalize(join(root, relative));

  if (!file.startsWith(root)) {
    return null;
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    return null;
  }

  return file;
}

function sendReload() {
  for (const response of clients) {
    response.write('event: reload\ndata: changed\n\n');
  }
}

const server = createServer((request, response) => {
  if (request.url === '/__reload') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write('\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  const file = resolveFile(request.url || '/');
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const ext = extname(file);
  response.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');

  if (ext !== '.html') {
    createReadStream(file).pipe(response);
    return;
  }

  let html = '';
  createReadStream(file, 'utf8')
    .on('data', (chunk) => {
      html += chunk;
    })
    .on('end', () => {
      response.end(html.replace('</body>', `${liveReloadScript}\n</body>`));
    })
    .on('error', () => {
      response.writeHead(500);
      response.end('Failed to read file');
    });
});

watch(root, { recursive: true }, (_, filename) => {
  if (!filename) {
    return;
  }

  if (!/\.(html|css|js|mjs)$/.test(filename)) {
    return;
  }

  setTimeout(sendReload, 50);
});

server.listen(port, () => {
  console.log(`html dev server: http://127.0.0.1:${port}/index.html`);
});
