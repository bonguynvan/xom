// Bitmap caches, so a frame is mostly drawImage: the ground (one map-sized bitmap), each building, and each
// resident type in each direction and walking frame. Baked at 1× or 2× the map scale and re-baked when the
// zoom crosses that line; zoomed in further, few things are in view and everything is drawn directly.
import { drawBuilding } from './buildings.js';
import { MAP } from './map.js';
import { drawResident } from './painters.js';
import { drawGround } from './scenery.js';

const FRAMES = 8; // walking poses per step cycle
const TAU = Math.PI * 2;
const BUILDING_PAD = { left: 14, right: 14, up: 96, down: 18 }; // room round a building for trees, signs, stools
const BODY = { w: 1.9, up: 1.6, down: 0.15 }; // a resident's box, in multiples of its size

let bucket = 0;
let ground = null;
const buildings = new Map();
const people = new Map();

/** 1 or 2 when bitmaps are worth it at this zoom, 0 to draw directly. Clears the caches when it changes. */
function sync(view) {
  if (!view.makeCanvas) return 0;
  const b = view.scale <= 1 ? 1 : view.scale <= 2 ? 2 : 0;
  if (b !== bucket) {
    bucket = b;
    ground = null;
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

export function groundLayer(ctx, view) {
  const b = sync(view);
  if (!b) { drawGround(ctx); return; }
  ground ??= bake(view, b, MAP.w, MAP.h, drawGround);
  ctx.drawImage(ground, 0, 0, MAP.w, MAP.h);
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

/** A resident at (x, y) from the cache: one bitmap per type, direction and walking frame. */
export function residentLayer(ctx, a, look, { x, y, size, moving }, view) {
  const b = sync(view);
  if (!b) { drawResident(ctx, a, look, { x, y, size, moving }); return; }
  const frame = moving ? Math.floor((((a.phase % TAU) + TAU) % TAU) / TAU * FRAMES) : -1;
  const dir = a.dir < 0 ? -1 : 1;
  const key = `${a.castId}|${dir}|${frame}|${size}`;
  const w = size * BODY.w;
  const h = size * (BODY.up + BODY.down);
  if (!people.has(key)) {
    const pose = { ...a, dir, phase: frame < 0 ? 0 : ((frame + 0.5) / FRAMES) * TAU };
    people.set(key, bake(view, b, w, h, (c) => drawResident(c, pose, look, { x: w / 2, y: size * BODY.up, size, moving })));
  }
  ctx.drawImage(people.get(key), x - w / 2, y - size * BODY.up, w, h);
}
