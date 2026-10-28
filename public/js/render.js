// Draw one frame of the xóm. Pure drawing: reads the world, never changes it.
import { FONT, INK, roundedPath, shape } from './duavit/paint.js';
import { drawDoorGlow, drawWindowLights } from './buildings.js';
import { CAST, findCast } from './cast.js';
import { extrasAt, extrasFrom } from './extras.js';
import { MAP, hourOf } from './map.js';
import { PLACES, POLES } from './places.js';
import { drawLampGlows, drawTrain, drawWires, isMarketOpen, standing } from './scenery.js';
import { buildingLayer, groundLayer, residentLayer } from './sprites.js';
import { trainAt } from './world.js';
import { noise } from './rng.js';

const BUILDINGS = PLACES.filter((p) => p.building);
const EXTRAS = extrasFrom(CAST);
const BACKDROP = '#9fbf6a'; // paddies beyond the edge of the map

/** How dark the xóm is (0 day, 1 deep night) and how warm the light is (dawn and dusk). */
export function lightAt(hour) {
  const dark = hour < 5 || hour >= 20.5 ? 1 : hour < 6.5 ? (6.5 - hour) / 1.5 : hour > 18 ? Math.min(1, (hour - 18) / 2.5) : 0;
  const warm = hour >= 5 && hour < 7 ? 1 - Math.abs(hour - 6) : hour >= 16.5 && hour < 19.5 ? 1 - Math.abs(hour - 18) / 1.5 : 0;
  return { dark, warm: Math.max(0, warm) };
}

const visibleState = (a) => a.state !== 'inside' && a.state !== 'away' && a.state !== 'gone';
const ALTITUDE = 46; // how high flyers are drawn above their shadow
const SIDE_STEPPERS = new Set(['keeper', 'walker', 'kid', 'vendor', 'stray', 'guest']);

/** Where to draw a resident: blended with the last step, and a little to one side of the way they face. */
function placeOf(a, before, alpha) {
  const smooth = before && visibleState(before) && Math.hypot(before.x - a.x, before.y - a.y) < 20;
  const x = smooth ? before.x + (a.x - before.x) * alpha : a.x;
  const y = smooth ? before.y + (a.y - before.y) * alpha : a.y;
  if (!SIDE_STEPPERS.has(a.kind) || a.state === 'stay') return { x, y };
  const off = ((a.i * 37) % 11 - 5) * 0.8; // the heading eases round corners, so this never jumps
  return { x: x - a.hy * off, y: y + a.hx * off };
}

/** A flyer: its shadow on the ground, itself high above (drawn after everything on the ground). */
function flyer(ctx, r, view) {
  ctx.fillStyle = 'rgba(29, 26, 47, 0.18)';
  ctx.beginPath();
  ctx.ellipse(r.x, r.y, r.a.size * 0.35, r.a.size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  residentLayer(ctx, r.a, findCast(r.a.castId).look, { x: r.x, y: r.y - ALTITUDE, size: r.a.size, moving: true }, view);
}

/**
 * Render `world` (blending positions from `prev` by `alpha` for smooth motion) into a view
 * { w, h, dpr, scale, camX, camY, makeCanvas? }: map point (x, y) lands on screen at
 * ((x - camX) * scale, (y - camY) * scale). `makeCanvas(w, h)` lets the ground, buildings and residents be
 * cached as bitmaps (sprites.js).
 */
export function renderFrame(ctx, world, prev, alpha, view) {
  const hour = hourOf(world.minute);
  const { dark, warm } = lightAt(hour);
  const train = trainAt(world.minute);
  const x0 = view.camX - 60;
  const x1 = view.camX + view.w / view.scale + 60;
  const y0 = view.camY - 20;
  const y1 = view.camY + view.h / view.scale + 100;
  const seen = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;

  ctx.save();
  ctx.scale(view.scale, view.scale);
  ctx.translate(-view.camX, -view.camY);
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(x0 - 100, y0 - 100, x1 - x0 + 200, y1 - y0 + 200);
  groundLayer(ctx, view);
  drawTrain(ctx, train);

  const open = { cho: isMarketOpen(hour), hour, t: world.t };
  const weather = world.weather?.kind ?? 'clear';
  const residents = world.agents.filter(visibleState).map((a) => ({ a, ...placeOf(a, prev?.agents[a.i], alpha) })).filter((r) => seen(r.x, r.y));
  const items = [
    ...BUILDINGS.filter((p) => p.x + p.w > x0 && p.x < x1 && p.front > y0 && p.front - 100 < y1)
      .map((p) => ({ y: p.front, draw: (c) => { buildingLayer(c, p, view); drawDoorGlow(c, p, dark); } })),
    ...standing(train),
    ...extrasAt(EXTRAS, hour, world.t, weather).filter((e) => seen(e.x, e.y)).map((e) => ({ y: e.y, draw: e.swim === undefined
      ? (c) => residentLayer(c, e.agent, findCast(e.agent.castId).look, { x: e.x, y: e.y, size: e.agent.size, moving: e.moving }, view)
      : (c) => swimmer(c, e, view) })),
    ...residents.map((r) => (r.a.kind === 'flyer'
      ? { y: Infinity, draw: (c) => flyer(c, r, view) }
      : { y: r.y, draw: (c) => residentLayer(c, r.a, findCast(r.a.castId).look,
        { x: r.x, y: r.y, size: r.a.size, moving: r.a.state === 'walk' || r.a.state === 'drive' }, view) })),
    ...residents.filter((r) => r.a.state === 'bump').map((r) => ({ y: r.y + 0.1, draw: (c) => bumpStar(c, r, world.t) })),
  ].sort((p, q) => p.y - q.y);
  for (const item of items) item.draw(ctx, open, dark);
  drawWires(ctx);

  if (warm > 0) tint(ctx, `rgba(255, 150, 80, ${warm * 0.16})`);
  if (WEATHER_TINT[weather]) tint(ctx, WEATHER_TINT[weather]);
  if (dark > 0) {
    tint(ctx, `rgba(12, 14, 40, ${dark * 0.6})`);
    for (const p of BUILDINGS) if (p.x + p.w > x0 && p.x < x1) drawWindowLights(ctx, p, dark);
    drawLampGlows(ctx, dark);
  }
  ctx.restore();
  if (weather === 'rain' || weather === 'storm') rain(ctx, view, world.t, weather === 'storm');
  speech(ctx, world, view, residents);
}

// ---------------- the weather ----------------

/** How the light looks: grey and wet in the rain, washed out in fog, golden in a heat wave, blue in the cold. */
const WEATHER_TINT = {
  rain: 'rgba(40, 55, 80, 0.22)', storm: 'rgba(25, 30, 55, 0.32)', cloudy: 'rgba(120, 125, 140, 0.12)',
  fog: 'rgba(225, 228, 235, 0.32)', hot: 'rgba(255, 190, 90, 0.10)', cold: 'rgba(160, 195, 255, 0.12)',
};

/** Falling rain, in screen space: slanted streaks drifting with time (and lightning in a storm). */
function rain(ctx, view, t, storm) {
  const px = view.dpr ?? 1;
  const drops = Math.round((view.w * view.h) / (5200 * px * px)) * (storm ? 2 : 1);
  ctx.strokeStyle = storm ? 'rgba(210, 225, 255, 0.55)' : 'rgba(205, 220, 250, 0.45)';
  ctx.lineWidth = px;
  ctx.beginPath();
  for (let k = 0; k < drops; k += 1) {
    const speed = 0.55 + noise(k, 191) * 0.35;
    const x = ((noise(k, 192) * view.w + t * 0.12 * speed * px) % (view.w + 40 * px)) - 20 * px;
    const y = ((noise(k, 193) * view.h + t * speed * px) % (view.h + 30 * px)) - 15 * px;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3 * px, y + 12 * px);
  }
  ctx.stroke();
  if (storm && noise(Math.floor(t / 900), 194) < 0.04) { // a flash of lightning, now and then
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

/** A child in the pond: only the head and shoulders above the water, a ring of ripples round them. */
function swimmer(ctx, e, view) {
  const size = e.agent.size;
  const water = e.y - size * 0.5 + e.swim;
  ctx.save();
  ctx.beginPath();
  ctx.rect(e.x - size, water - size * 2, size * 2, size * 2);
  ctx.clip();
  residentLayer(ctx, e.agent, findCast(e.agent.castId).look, { x: e.x, y: e.y + e.swim, size, moving: true }, view);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(e.x, water, size * 0.32, size * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Two riders who just touched: a little yellow star between them. */
function bumpStar(ctx, r, t) {
  const pulse = 1 + Math.sin(t / 120) * 0.15;
  const cx = r.x + r.a.dir * r.a.size * 0.35;
  const cy = r.y - r.a.size * 0.45;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#1d1a2f';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 0; k < 16; k += 1) {
    const rad = (k % 2 ? 2 : 4.5) * pulse;
    const a = (k / 16) * Math.PI * 2;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ---------------- what people say ----------------

/** Speech bubble above a head, in screen pixels so it stays crisp, never mirrors and is never tinted. */
function bubble(ctx, text, sx, at, view, placed, angry = false) {
  const px = view.dpr ?? 1;
  ctx.font = `700 ${11 * px}px ${FONT}`;
  const room = 200 * px - 14 * px;
  let shown = text;
  while (shown.length > 4 && ctx.measureText(shown).width > room) shown = `${shown.slice(0, -2).trimEnd()}…`.replace(/……$/, '…'); // too long: cut, never squash
  const w = Math.min(200 * px, ctx.measureText(shown).width + 14 * px);
  const x = Math.max(4 * px, Math.min(sx - w / 2, view.w - w - 4 * px)); // never cut off at the edges
  let sy = at; // people chatting stand close: stack a bubble above one it would cover, else leave it out
  const hits = () => placed.some((b) => x < b.x + b.w && b.x < x + w && sy - 26 * px < b.y + 20 * px && b.y < sy - 6 * px);
  if (hits()) sy -= 23 * px;
  if (hits()) return false;
  placed.push({ x, y: sy - 26 * px, w });
  shape(ctx, angry ? '#ffe3e0' : '#fffdf8', () => {
    roundedPath(ctx, x, sy - 26 * px, w, 20 * px, 8 * px);
    ctx.moveTo(sx - 4 * px, sy - 7 * px);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + 4 * px, sy - 7 * px);
  }, 1.5 * px);
  ctx.fillStyle = angry ? '#c1121f' : INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shown, x + w / 2, sy - 16 * px, w - 8 * px);
  return true;
}

/** Little name tags over visitors: always over your own, over everyone's when there are few or you zoom in. */
function nameTags(ctx, residents, view, placed) {
  const px = view.dpr ?? 1;
  const guests = residents.filter((r) => r.a.kind === 'guest');
  const everyone = guests.length <= 40 || view.scale / px >= 1.6;
  ctx.font = `800 ${10 * px}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of guests) {
    const mine = r.a.guestId === view.me;
    if (!mine && !everyone) continue;
    const text = mine ? `★ ${r.a.name}` : r.a.name;
    const w = ctx.measureText(text).width + 10 * px;
    const sx = (r.x - view.camX) * view.scale;
    const sy = (r.y - r.a.size * 1.05 - view.camY) * view.scale;
    shape(ctx, mine ? '#ffd23f' : 'rgba(29, 26, 47, 0.85)', () => roundedPath(ctx, sx - w / 2, sy - 14 * px, w, 13 * px, 6 * px), mine ? 1.5 * px : 0.01);
    ctx.fillStyle = mine ? INK : '#fffdf8';
    ctx.fillText(text, sx, sy - 7.5 * px);
    placed.push({ x: sx - w / 2, y: sy - 14 * px, w });
  }
}

function speech(ctx, world, view, residents) {
  const placed = [];
  nameTags(ctx, residents, view, placed);
  const screen = (x, y) => ({ sx: (x - view.camX) * view.scale, sy: (y - view.camY) * view.scale });
  const budget = Math.max(6, Math.round((view.w * view.h) / (110000 * (view.dpr ?? 1) ** 2))); // a crowd, not a wall of text
  const talking = residents.filter((r) => r.a.bubble && world.t >= r.a.bubble.from)
    .sort((p, q) => (q.a.bubble.angry ? 1 : 0) - (p.a.bubble.angry ? 1 : 0) || p.a.bubble.from - q.a.bubble.from);
  let shown = 0;
  for (const r of talking) {
    if (shown >= budget) break;
    const said = r.a.bubble;
    const { sx, sy } = screen(r.x, r.y - r.a.size * 1.1 - (r.a.kind === 'flyer' ? ALTITUDE : 0));
    if (bubble(ctx, said.text, sx, sy, view, placed, said.angry)) shown += 1;
  }
  if (world.broadcast) {
    const loa = POLES.find((p) => p.loa);
    const { sx, sy } = screen(loa.x, loa.y - 48);
    if (sx > -100 && sx < view.w + 100) bubble(ctx, `📢 ${world.broadcast.text}`, sx, sy, view, placed);
  }
}

/** Colour the whole scene (it is opaque, so everything drawn so far takes the colour). */
function tint(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(-2000, -2000, MAP.w + 4000, MAP.h + 4000);
}
