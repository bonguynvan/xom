// The background crowd: hundreds of people who are only ever in one place, so they need no simulation.
// Customers on the plastic stools spilling over the pavements, and the crush of shoppers in the market.
// Everything is a pure function of the clock (who is there at this hour, how they shuffle about), so it
// costs almost nothing and replays exactly.
import { STOOL_CLUSTERS } from './street-life.js';
import { findPlace } from './places.js';
import { SPRITE } from './map.js';
import { noise } from './rng.js';

const MARKET_CROWD = 260;
const PLAYING_KIDS = 26;
const STOOL_PEOPLE_ODDS = 0.7;

/** How full the pavement stools are at an hour: busy at breakfast and in the evening, empty at night. */
export function stoolsBusy(hour) {
  if (hour < 5.5 || hour >= 23) return 0;
  const breakfast = Math.max(0, 1 - Math.abs(hour - 7) / 2.5);
  const evening = Math.max(0, 1 - Math.abs(hour - 19.5) / 3);
  return Math.min(1, 0.35 + breakfast * 0.65 + evening * 0.65);
}

/** How packed the market is: a crush at seven, gone by noon. */
export function marketBusy(hour) {
  if (hour < 4.8 || hour >= 11.5) return 0;
  return hour < 7 ? (hour - 4.8) / 2.2 : hour < 9.5 ? 1 : (11.5 - hour) / 2;
}

/** Looks the crowd borrows: cast types that are plain neighbours (their sprites are already cached). */
export function extrasFrom(cast) {
  const looks = cast.filter((c) => c.id.startsWith('xom_') || ['diCho', 'chiEm2', 'baGia', 'coTu', 'thoCay'].includes(c.id));
  const market = findPlace('cho');
  const sitters = STOOL_CLUSTERS.flatMap((c, n) => c.stools.map((s, k) => ({ ...s, n: n * 10 + k })))
    .filter((s) => noise(s.n, 151) < STOOL_PEOPLE_ODDS)
    .map((s) => ({ kind: 'sit', x: s.x, y: s.y + 1, rank: noise(s.n, 152), cast: looks[Math.floor(noise(s.n, 153) * looks.length)], dir: s.face }));
  const shoppers = Array.from({ length: MARKET_CROWD }, (_, k) => ({
    kind: 'shop', bx: market.x + 8 + noise(k, 154) * (market.w - 16), by: market.y0 + 10 + noise(k, 155) * (market.y1 - market.y0 - 14),
    rank: noise(k, 156), speed: 0.4 + noise(k, 157), phase: noise(k, 158) * 6.3, cast: looks[Math.floor(noise(k, 159) * looks.length)],
  }));
  const field = findPlace('sanChoi');
  const kids = cast.filter((c) => c.kind === 'kid');
  const players = Array.from({ length: PLAYING_KIDS }, (_, k) => ({
    kind: 'play', bx: field.x + 18 + noise(k, 171) * (field.w - 36), by: field.y0 + 10 + noise(k, 172) * (field.y1 - field.y0 - 16),
    rank: noise(k, 173), speed: 1.6 + noise(k, 174) * 1.4, phase: noise(k, 175) * 6.3, cast: kids[Math.floor(noise(k, 176) * kids.length)],
  }));
  return [...sitters, ...shoppers, ...players];
}

/** Where each extra who is out at this hour stands, as pseudo-agents the resident drawing understands. */
export function extrasAt(extras, hour, t) {
  const stools = stoolsBusy(hour);
  const market = marketBusy(hour);
  const play = hour >= 7 && hour < 18.5 ? 1 : 0;
  const out = [];
  for (const e of extras) {
    if (e.rank >= (e.kind === 'sit' ? stools : e.kind === 'play' ? play : market)) continue;
    if (e.kind === 'sit') {
      out.push({ x: e.x, y: e.y, moving: false, agent: pose(e.cast, e.dir, 0) });
      continue;
    }
    const s = (t / 1000) * e.speed * 0.6 + e.phase; // shuffling between the stalls, or chasing the ball
    const dx = Math.sin(s) * (e.kind === 'play' ? 30 : 14);
    const moving = Math.abs(Math.cos(s)) > 0.35;
    out.push({ x: e.bx + dx, y: e.by + Math.cos(s * 0.7) * 4, moving, agent: pose(e.cast, Math.cos(s) >= 0 ? 1 : -1, (t / 1000) * 7 + e.phase) });
  }
  return out;
}

const pose = (c, dir, phase) => ({ castId: c.id, painter: c.painter, color: c.color, dir, phase, size: (c.size ?? 68) * SPRITE });
