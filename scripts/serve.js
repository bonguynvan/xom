// The Xóm Peti server: the static game, the live watcher count (/api/live) and the operator API for the
// peti.vn admin (/api/ops/*, OPS_TOKEN, refused at the public proxy). No dependencies.
// Sends the same strict CSP as deploy/xom.caddy, so a local run catches inline scripts or styles.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLive } from './live.js';
import { createWeather } from './weather.js';

const ROOT = resolve(fileURLToPath(new URL('../public', import.meta.url)));
const BODY_LIMIT = 2048;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

export const HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
    + "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; "
    + "frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** Map a URL path to a servable file inside ROOT, or null: no escaping ROOT, no dotfiles, known types only. */
export function resolvePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const rel = normalize(decoded === '/' ? '/index.html' : decoded).replace(/^([/\\])+/, '');
  if (rel.split(/[/\\]/).some((part) => part.startsWith('.'))) return null;
  const file = resolve(join(ROOT, rel));
  if (!(file === ROOT || file.startsWith(ROOT + sep))) return null;
  return TYPES[extname(file)] ? file : null;
}

const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...HEADERS, ...extra });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

/** The visitor's address: the socket's, or (behind our own proxy only) the first X-Forwarded-For hop. */
const clientIp = (req, trustProxy) => (trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';

function readJson(req) {
  return new Promise((done) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => { size += chunk.length; if (size > BODY_LIMIT) { req.destroy(); done(null); } else chunks.push(chunk); });
    req.on('end', () => { try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { done(null); } });
    req.on('error', () => done(null));
  });
}

function serveFile(req, res) {
  const file = resolvePath(req.url ?? '/');
  const notFound = () => send(res, 404, 'Không tìm thấy', 'text/plain; charset=utf-8');
  if (!file) { notFound(); return; }
  stat(file).then((info) => {
    if (!info.isFile()) { notFound(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)], 'Cache-Control': 'no-cache', ...HEADERS });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }, notFound);
}

/** The request handler, with its live hub (tests pass their own). */
export function createHandler({ live = createLive(), trustProxy = false } = {}) {
  const handler = async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/healthz') return send(res, 200, { ok: true });
    if (path === '/api/live' && req.method === 'GET') return live.watch(req, res, clientIp(req, trustProxy));
    if ((path === '/api/join' || path === '/api/leave') && req.method === 'POST') {
      const input = await readJson(req);
      const { status, body } = path === '/api/join' ? live.join(input) : live.leave(input);
      return send(res, status, body);
    }
    if (path.startsWith('/api/ops/')) {
      // Token first, body second: strangers' payloads are never read.
      if (!live.opsOn) return send(res, 404, { error: 'Game chưa bật OPS_TOKEN' });
      if (!live.authorized(req)) return send(res, 401, { error: 'Sai OPS_TOKEN' });
      if (path === '/api/ops/overview' && req.method === 'GET') return send(res, 200, live.overview());
      if (path === '/api/ops/settings' && req.method === 'POST') {
        const input = await readJson(req);
        return input && typeof input === 'object' ? send(res, 200, { ok: true, settings: live.updateSettings(input) }) : send(res, 400, { error: 'Dữ liệu không hợp lệ' });
      }
      const kick = path.match(/^\/api\/ops\/guests\/(g\d{1,9})\/kick$/);
      if (kick && req.method === 'POST') return live.kick(kick[1]) ? send(res, 200, { ok: true }) : send(res, 404, { error: 'Không có khách này' });
      return send(res, 404, { error: 'Không có' });
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'Không có' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '', 'text/plain', { Allow: 'GET, HEAD' });
    return serveFile(req, res);
  };
  return handler;
}

export const handler = createHandler();

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = Number(process.env.PORT) || 3500;
  const HOST = process.env.HOST || '127.0.0.1';
  let live = null;
  const weather = createWeather({ onChange: () => live?.weatherChanged() });
  live = createLive({ token: process.env.OPS_TOKEN ?? '', file: process.env.STATS_FILE || null, weather: weather.get });
  if (process.env.WEATHER !== 'off') weather.start();
  const server = createServer(createHandler({ live, trustProxy: process.env.TRUST_PROXY === '1' }));
  server.listen(PORT, HOST, () => console.log(`Xóm Peti: http://${HOST}:${PORT}${live.opsOn ? ' (ops on)' : ''}`));
  const stop = () => { weather.stop(); live.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
