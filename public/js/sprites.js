// Bitmap caches, so a frame is mostly drawImage: the ground (in tiles), each building, and each
// resident look in each direction and walking frame. Baked at 1×, 2× or 3× the map scale (high-density screens
// start well above 2) and re-baked when the zoom crosses a line; zoomed in further than that, few things are in
// view and everything is drawn directly.
import { drawBuilding } from './buildings.js';
import { MAP } from './map.js';
import { drawResident } from './painters.js';
import { drawGround } from './scenery.js';

const FRAMES = 8; // walking poses per step cycle
const TAU = Math.PI * 2;
const BUILDING_PAD = { left: 14, right: 14, up: 96, down: 18 }; // room round a building for trees, signs, stools
const BODY = { w: 1.9, up: 1.6, down: 0.15 }; // a resident's box, in multiples of its size
const GROUND_TILE = { w: 350, h: 350 }; // map units: at 3× a tile is 1050 px, well inside what a GPU canvas allows
const MAX_BITMAP_SCALE = 4.5; // past this, 3× bitmaps would look soft: draw directly

let bucket = 0;
const ground = new Map();
const buildings = new Map();
const people = new Map();
const looks = new Map(); // castId|colour -> what the bitmap depends on, so the crowd's hundreds of entries share a few bitmaps

/** Residents who look the same (painter, colour, face) share their bitmaps. */
function lookKey(a, look) {
  const id = `${a.castId}|${a.color}`;
  if (!looks.has(id)) looks.set(id, `${a.painter}|${a.color}|${JSON.stringify(look ?? {})}`);
  return looks.get(id);
}

/** The bitmap scale for this zoom (1, 2 or 3), 0 to draw directly. Clears the caches when it changes. */
function sync(view) {
  if (!view.makeCanvas) return 0;
  const s = view.scale;
  const b = s <= 1 ? 1 : s <= 2 ? 2 : s <= MAX_BITMAP_SCALE ? 3 : 0;
  if (b !== bucket) {
    bucket = b;
    ground.clear();
    buildings.clear();
    people.clear();
  }
  return b;
}

function bake(view, b, w, h, draw) {
  const canvas = view.makeCanvas(Math.max(1, Math.ceil(w * b)), Math.max(1, Math.ceil(h * b)));
  const c = canvas.getContext('2d');
  c.scale(b, b);
  draw(c);
  return canvas;
}

/** The ground in tiles (each overlapping its neighbours by a unit, so no seam shows), only those in view. */
export function groundLayer(ctx, view) {
  const b = sync(view);
  if (!b) { drawGround(ctx); return; }
  const x0 = view.camX;
  const y0 = view.camY;
  const x1 = x0 + view.w / view.scale;
  const y1 = y0 + view.h / view.scale;
  for (let ty = 0; ty < MAP.h; ty += GROUND_TILE.h) {
    for (let tx = 0; tx < MAP.w; tx += GROUND_TILE.w) {
      const w = Math.min(GROUND_TILE.w, MAP.w - tx) + 2;
      const h = Math.min(GROUND_TILE.h, MAP.h - ty) + 2;
      if (tx + w < x0 || tx - 1 > x1 || ty + h < y0 || ty - 1 > y1) continue;
      const key = `${tx},${ty}`;
      if (!ground.has(key)) ground.set(key, bake(view, b, w, h, (c) => { c.translate(1 - tx, 1 - ty); drawGround(c); }));
      ctx.drawImage(ground.get(key), tx - 1, ty - 1, w, h);
    }
  }
}

export function buildingLayer(ctx, p, view) {
  const b = sync(view);
  if (!b) { drawBuilding(ctx, p); return; }
  const x0 = p.x - BUILDING_PAD.left;
  const y0 = p.front - BUILDING_PAD.up;
  const w = p.w + BUILDING_PAD.left + BUILDING_PAD.right;
  const h = BUILDING_PAD.up + BUILDING_PAD.down;
  if (!buildings.has(p.id)) buildings.set(p.id, bake(view, b, w, h, (c) => { c.translate(-x0, -y0); drawBuilding(c, p); }));
  ctx.drawImage(buildings.get(p.id), x0, y0, w, h);
}

/** A resident at (x, y) from the cache: one bitmap per look, direction and walking frame. */
export function residentLayer(ctx, a, look, { x, y, size, moving }, view) {
  const b = sync(view);
  if (!b) { drawResident(ctx, a, look, { x, y, size, moving }); return; }
  const frame = moving ? Math.floor((((a.phase % TAU) + TAU) % TAU) / TAU * FRAMES) : -1;
  const dir = a.dir < 0 ? -1 : 1;
  const key = `${lookKey(a, look)}|${dir}|${frame}|${size}`;
  const w = size * BODY.w;
  const h = size * (BODY.up + BODY.down);
  if (!people.has(key)) {
    const pose = { ...a, dir, phase: frame < 0 ? 0 : ((frame + 0.5) / FRAMES) * TAU };
    const draw = (c) => drawResident(c, pose, look, { x: w / 2, y: size * BODY.up, size, moving });
    people.set(key, bake(view, b, w, h, draw));
  }
  ctx.drawImage(people.get(key), x - w / 2, y - size * BODY.up, w, h);
}
