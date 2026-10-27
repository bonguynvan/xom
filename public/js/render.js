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

const BUILDINGS = PLACES.filter((p) => p.building);
const EXTRAS = extrasFrom(CAST);
const BACKDROP = '#9fbf6a'; // paddies beyond the edge of the map

/** How dark the xóm is (0 day, 1 deep night) and how warm the light is (dawn and dusk). */
export function lightAt(hour) {
  const dark = hour < 5 || hour >= 20.5 ? 1 : hour < 6.5 ? (6.5 - hour) / 1.5 : hour > 18 ? Math.min(1, (hour - 18) / 2.5) : 0;
  const warm = hour >= 5 && hour < 7 ? 1 - Math.abs(hour - 6) : hour >= 16.5 && hour < 19.5 ? 1 - Math.abs(hour - 18) / 1.5 : 0;
  return { dark, warm: Math.max(0, warm) };
}

const visibleState = (a) => a.state !== 'inside' && a.state !== 'away';
const ALTITUDE = 46; // how high flyers are drawn above their shadow
const SIDE_STEPPERS = new Set(['keeper', 'walker', 'kid', 'vendor', 'stray']);

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
  const residents = world.agents.filter(visibleState).map((a) => ({ a, ...placeOf(a, prev?.agents[a.i], alpha) })).filter((r) => seen(r.x, r.y));
  const items = [
    ...BUILDINGS.filter((p) => p.x + p.w > x0 && p.x < x1 && p.front > y0 && p.front - 100 < y1)
      .map((p) => ({ y: p.front, draw: (c) => { buildingLayer(c, p, view); drawDoorGlow(c, p, dark); } })),
    ...standing(train),
    ...extrasAt(EXTRAS, hour, world.t).filter((e) => seen(e.x, e.y)).map((e) => ({ y: e.y, draw: (c) => residentLayer(c, e.agent,
      findCast(e.agent.castId).look, { x: e.x, y: e.y, size: e.agent.size, moving: e.moving }, view) })),
    ...residents.map((r) => (r.a.kind === 'flyer'
      ? { y: Infinity, draw: (c) => flyer(c, r, view) }
      : { y: r.y, draw: (c) => residentLayer(c, r.a, findCast(r.a.castId).look,
        { x: r.x, y: r.y, size: r.a.size, moving: r.a.state === 'walk' || r.a.state === 'drive' }, view) })),
  ].sort((p, q) => p.y - q.y);
  for (const item of items) item.draw(ctx, open, dark);
  drawWires(ctx);

  if (warm > 0) tint(ctx, `rgba(255, 150, 80, ${warm * 0.16})`);
  if (dark > 0) {
    tint(ctx, `rgba(12, 14, 40, ${dark * 0.6})`);
    for (const p of BUILDINGS) if (p.x + p.w > x0 && p.x < x1) drawWindowLights(ctx, p, dark);
    drawLampGlows(ctx, dark);
  }
  ctx.restore();
  speech(ctx, world, view, residents);
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

function speech(ctx, world, view, residents) {
  const placed = [];
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
