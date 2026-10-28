// The background crowd: hundreds of people who are only ever in one place, so they need no simulation.
// Customers on the plastic stools spilling over the pavements, and the crush of shoppers in the market.
// Everything is a pure function of the clock (who is there at this hour, how they shuffle about), so it
// costs almost nothing and replays exactly.
import { STOOL_CLUSTERS } from './street-life.js';
import { findPlace } from './places.js';
import { TRAYS } from './decor.js';
import { SPRITE } from './map.js';
import { noise } from './rng.js';

const MARKET_CROWD = 260;
const PLAYING_KIDS = 26;
const SWIMMERS = 34;
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
  if (hour >= 15.5 && hour < 18.5) return 0.5 * Math.min(1, (hour - 15.5) / 0.6, (18.5 - hour) / 0.6); // the afternoon market
  if (hour < 4.8 || hour >= 11.5) return 0;
  return hour < 7 ? (hour - 4.8) / 2.2 : hour < 9.5 ? 1 : (11.5 - hour) / 2;
}

/** Sellers set up a little before the buyers come and pack up a little after. */
const sellersOut = (hour) => (hour >= 4.5 && hour < 12) || (hour >= 15.2 && hour < 18.8);

/** How many children are in the pond: a crowd on hot afternoons, a few on fine days, none in the rain or cold. */
export function swimmersAt(hour, weather) {
  if (hour < 9 || hour >= 18.5 || ['rain', 'storm', 'cold', 'fog'].includes(weather)) return 0;
  const afternoon = Math.max(0, 1 - Math.abs(hour - 14.5) / 4);
  return weather === 'hot' ? 0.4 + 0.6 * afternoon : weather === 'clear' ? 0.25 * afternoon : 0.1 * afternoon;
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
  // the sellers: one at every stall and one by every tray on the floor
  const sellerLooks = cast.filter((c) => ['baTraDa', 'coTapHoa', 'ganhHang', 'baPho', 'aoDai', 'baTrau', 'coToc'].includes(c.painter) && c.kind !== 'vehicle');
  const sellers = [...market.keeperAt.map((s, k) => ({ x: s.x, y: s.y - 1, k })), ...TRAYS.map((t) => ({ x: t.x - 9, y: t.y + 1, k: 100 + t.k }))]
    .map((s) => ({ kind: 'seller', x: s.x, y: s.y, rank: 0, cast: sellerLooks[Math.floor(noise(s.k, 177) * sellerLooks.length)], dir: noise(s.k, 178) < 0.5 ? 1 : -1 }));
  // children splashing about in the pond
  const pond = findPlace('ao').pond;
  const swimmers = Array.from({ length: SWIMMERS }, (_, k) => {
    const a = noise(k, 181) * Math.PI * 2;
    const d = Math.sqrt(noise(k, 182)) * 0.75;
    return { kind: 'swim', bx: pond.cx + Math.cos(a) * pond.rx * d, by: pond.cy + Math.sin(a) * pond.ry * d, rank: noise(k, 183),
      speed: 0.6 + noise(k, 184), phase: noise(k, 185) * 6.3, cast: kids[Math.floor(noise(k, 186) * kids.length)] };
  });
  return [...sitters, ...shoppers, ...players, ...sellers, ...swimmers];
}

/** Where each extra who is out at this hour stands, as pseudo-agents the resident drawing understands. */
export function extrasAt(extras, hour, t, weather = 'clear') {
  const wet = weather === 'rain' || weather === 'storm';
  const stools = stoolsBusy(hour) * (wet ? 0.2 : weather === 'cold' ? 0.6 : 1);
  const market = marketBusy(hour) * (wet ? 0.35 : 1);
  const play = hour >= 7 && hour < 18.5 && !wet ? 1 : 0;
  const sellers = sellersOut(hour) ? 1 : 0;
  const swim = swimmersAt(hour, weather);
  const out = [];
  for (const e of extras) {
    const busy = { sit: stools, play, seller: sellers, swim, shop: market }[e.kind];
    if (e.rank >= busy) continue;
    if (e.kind === 'seller') {
      out.push({ x: e.x, y: e.y, moving: false, agent: pose(e.cast, e.dir, 0) });
      continue;
    }
    if (e.kind === 'swim') { // bobbing and paddling: only head and shoulders above the water (render.js hides the rest)
      const s = (t / 1000) * e.speed + e.phase;
      out.push({ x: e.bx + Math.sin(s * 0.4) * 10, y: e.by + Math.cos(s * 0.3) * 4, moving: true, swim: Math.sin(s * 2.2) * 1.2,
        agent: pose(e.cast, Math.cos(s * 0.4) >= 0 ? 1 : -1, s * 4) });
      continue;
    }
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
