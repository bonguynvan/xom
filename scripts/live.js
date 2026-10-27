// Who is watching right now, and the admin's view of it. No accounts, no cookies, no IPs kept: a visitor
// is an open /api/live connection (Server-Sent Events) and nothing more. The server counts them, pushes the
// count (with the admin's announcement and maintenance switch) to every page, and keeps a small daily tally
// (visits, peak watchers) for the peti.vn admin dashboard, which reads it over /api/ops/* with OPS_TOKEN.
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

export const OPS_TOKEN_MIN = 32;
const DAYS = 30;
const PER_IP = 12; // tabs from one address (a whole office behind one IP is fine)
const MAX_WATCHERS = 4000; // what the 192 MB container holds comfortably
const VISIT_GAP_MS = 10 * 60 * 1000; // reopening the page within ten minutes is the same visit
const SLOW_CLIENT_BYTES = 16 * 1024; // a stream nobody reads any more is dropped
const PING_MS = 25000; // keeps proxies from closing an idle stream
const ANNOUNCE_MAX = 200;

const vnDay = (ms) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 10); // days turn over at midnight in Vietnam
const digest = (value) => createHash('sha256').update(String(value)).digest();
/** The caps count an IPv6 visitor by their /64 (one home or one server), an IPv4 one by the address. */
export const ipKey = (ip) => (ip.includes(':') && !ip.startsWith('::ffff:') ? ip.split(':').slice(0, 4).join(':') : ip.replace(/^::ffff:/, ''));

/** The live-watchers hub. `file` (optional) keeps the daily tally across restarts. */
export function createLive({ token = '', file = null, now = () => Date.now(), startedAt = now() } = {}) {
  const watchers = new Set();
  const perIp = new Map();
  const lastVisit = new Map(); // memory only, pruned; never written anywhere
  let settings = { maintenance: false, announcement: null };
  let days = load(file);

  const today = () => {
    const day = vnDay(now());
    if (!days.some((d) => d.day === day)) days = [...days, { day, visits: 0, peakOnline: 0 }].slice(-DAYS);
    return day;
  };
  const bump = (fn) => { const day = today(); days = days.map((d) => (d.day === day ? fn(d) : d)); };
  const message = () => `data: ${JSON.stringify({ online: watchers.size, ...settings })}\n\n`;
  const send = (w, text) => { if (w.res.writableLength > SLOW_CLIENT_BYTES) w.res.destroy(); else w.res.write(text); };
  const broadcast = () => { const text = message(); for (const w of watchers) send(w, text); };
  let pending = null;
  const soon = () => { if (!pending) pending = setTimeout(() => { pending = null; broadcast(); }, 1000); }; // at most once a second

  const ping = setInterval(() => {
    for (const w of watchers) send(w, ': ping\n\n');
    const old = now() - VISIT_GAP_MS;
    for (const [key, at] of lastVisit) if (at < old) lastVisit.delete(key);
  }, PING_MS);
  if (file) store(file, days); // fail loudly at start-up if the stats cannot be written
  const save = file ? setInterval(() => store(file, days), 5 * 60 * 1000) : null;
  ping.unref?.();
  save?.unref?.();

  /** GET /api/live: hold the stream open while the page is. */
  function watch(req, res, address) {
    const ip = ipKey(address);
    if (watchers.size >= MAX_WATCHERS || (perIp.get(ip) ?? 0) >= PER_IP) {
      res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' }).end('Đông quá, thử lại sau');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const w = { res };
    watchers.add(w);
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    const fresh = now() - (lastVisit.get(ip) ?? -Infinity) > VISIT_GAP_MS;
    lastVisit.set(ip, now());
    bump((d) => ({ ...d, visits: d.visits + (fresh ? 1 : 0), peakOnline: Math.max(d.peakOnline, watchers.size) }));
    res.write('retry: 5000\n\n');
    res.write(message());
    soon();
    req.on('close', () => {
      watchers.delete(w);
      const left = (perIp.get(ip) ?? 1) - 1;
      if (left > 0) perIp.set(ip, left); else perIp.delete(ip);
      soon();
    });
  }

  const opsOn = typeof token === 'string' && token.length >= OPS_TOKEN_MIN;
  const expected = digest(`Bearer ${token}`);
  const authorized = (req) => opsOn && timingSafeEqual(digest(req.headers.authorization ?? ''), expected);

  /** The admin dashboard's view, shaped like the other Peti games' overview. */
  function overview() {
    today();
    return {
      game: { id: 'xom', name: 'Xóm Peti' },
      kind: 'watch',
      now: now(),
      uptimeMin: Math.round((now() - startedAt) / 60000),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      live: { rooms: 0, players: watchers.size, connections: watchers.size },
      rooms: [],
      daily: padDays(days, now()),
      settings,
    };
  }

  /** POST /api/ops/settings: only the two known switches, cleaned. */
  function updateSettings(input) {
    const next = { ...settings };
    if (typeof input.maintenance === 'boolean') next.maintenance = input.maintenance;
    if ('announcement' in input) {
      const text = typeof input.announcement === 'string' ? input.announcement.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, ANNOUNCE_MAX) : '';
      next.announcement = text || null;
    }
    settings = next;
    broadcast();
    return settings;
  }

  const close = () => {
    clearInterval(ping);
    if (save) clearInterval(save);
    if (pending) clearTimeout(pending);
    if (file) store(file, days);
    for (const w of watchers) w.res.end();
  };

  return { watch, overview, updateSettings, authorized, opsOn, close, online: () => watchers.size };
}

/** The last 30 days, one entry each, zeros for the days nobody came. */
function padDays(days, nowMs) {
  return Array.from({ length: DAYS }, (_, k) => {
    const day = vnDay(nowMs - (DAYS - 1 - k) * 86400000);
    const d = days.find((x) => x.day === day) ?? { day, visits: 0, peakOnline: 0 };
    // The dashboard was built for races; a watching game fills the race fields with zeros.
    return { roomsCreated: 0, roomRaces: 0, roomRacers: 0, quickRaces: 0, quickRacers: 0, peakPlayers: d.peakOnline, ...d };
  });
}

function load(file) {
  if (!file) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d?.day) && Number.isFinite(d.visits) && Number.isFinite(d.peakOnline)).slice(-DAYS) : [];
  } catch {
    return [];
  }
}

function store(file, days) {
  try {
    writeFileSync(`${file}.tmp`, JSON.stringify(days));
    renameSync(`${file}.tmp`, file);
  } catch (error) {
    console.error('Không lưu được thống kê:', error.message);
  }
}
