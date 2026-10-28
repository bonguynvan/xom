// Little green things on the bare ground: bamboo and wooden fences, hibiscus hedges in front of houses,
// guava, star-fruit and young banana trees, tufts of grass and small flowers (portulaca, chrysanthemum).
// Only where the ground is free: never on a way, a house, the market, the courtyard or the pond.
import { INK, shade, shape, thinLine } from './duavit/paint.js';
import { MAP, RAIL_Y, nodesNear } from './map.js';
import { PLACES, TREES } from './places.js';
import { noise } from './rng.js';

const fill = (ctx, color, build) => { ctx.fillStyle = color; ctx.beginPath(); build(); ctx.fill(); };

const BUSY = [
  ...PLACES.filter((p) => p.building).map((p) => ({ x0: p.x - 3, x1: p.x + p.w + 3, y0: p.front - (p.depth ?? 32) - 3, y1: p.front + 4 })),
  ...PLACES.filter((p) => p.y0 !== undefined).map((p) => ({ x0: p.x - 6, x1: p.x + p.w + 6, y0: p.y0 - 6, y1: (p.front ?? p.y1) + 6 })),
  ...TREES.map((t) => ({ x0: t.x - 16, x1: t.x + 16, y0: t.y - 10, y1: t.y + 4 })),
];
/** Ground at (x, y) with nothing on it within r: no way, no building, no open place, inside the xóm. */
function free(x, y, r) {
  if (x < 10 || x > MAP.w - 10 || y < RAIL_Y + 24 || y > 664) return false;
  if (nodesNear({ x, y }, r + 8).length > 0) return false;
  return !BUSY.some((b) => x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1);
}

/** Candidate spots scattered by noise; the free ones are kept. */
const scatter = (count, salt, r) => Array.from({ length: count }, (_, k) => ({ x: 12 + noise(k, salt) * (MAP.w - 24), y: 60 + noise(k, salt + 1) * 600, k }))
  .filter((p) => free(p.x, p.y, r));

// ---------------- flat: grass and flowers ----------------

const TUFTS = scatter(900, 201, 2);
const FLOWERS = ['#ffd23f', '#ff8fab', '#ffffff', '#e63946', '#f4a261'];

export function drawGreenGround(ctx) {
  for (const t of TUFTS) {
    const kind = noise(t.k, 203);
    thinLine(ctx, kind < 0.5 ? '#6f9e45' : '#5a8a3a', 0.6, () => {
      for (let b = -2; b <= 2; b += 1) { ctx.moveTo(t.x + b, t.y); ctx.lineTo(t.x + b * 1.6, t.y - 3 - Math.abs(b === 0 ? 2 : 0)); }
    });
    if (kind > 0.55) { // a few flowers in the tuft
      const color = FLOWERS[Math.floor(noise(t.k, 204) * FLOWERS.length)];
      for (let f = 0; f < 3; f += 1) fill(ctx, color, () => ctx.arc(t.x - 2 + f * 2, t.y - 3.5 - (f % 2), 0.9, 0, Math.PI * 2));
    }
  }
}

// ---------------- standing: fences, hedges, small trees ----------------

function fence(ctx, f) {
  const color = f.bamboo ? '#b8a05a' : '#9c7a52';
  thinLine(ctx, shade(color, -0.25), 0.7, () => { ctx.moveTo(f.x, f.y - 3); ctx.lineTo(f.x + f.len, f.y - 3); ctx.moveTo(f.x, f.y - 6); ctx.lineTo(f.x + f.len, f.y - 6); });
  thinLine(ctx, color, f.bamboo ? 0.9 : 1.2, () => { for (let x = f.x; x <= f.x + f.len; x += f.bamboo ? 1.8 : 3) { ctx.moveTo(x, f.y); ctx.lineTo(x, f.y - (f.bamboo ? 8 : 7.5)); } });
}

function hedge(ctx, h) {
  shape(ctx, '#3f7d3f', () => { ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, h.y - 5); ctx.quadraticCurveTo(h.x + h.len / 2, h.y - 8, h.x + h.len, h.y - 5); ctx.lineTo(h.x + h.len, h.y); ctx.closePath(); }, 0.6);
  for (let k = 0; k < h.len / 3; k += 1) fill(ctx, k % 3 ? '#e63946' : '#ff8fab', () => ctx.arc(h.x + 1.5 + k * 3, h.y - 4 - (k % 2) * 1.5, 0.9, 0, Math.PI * 2));
}

function smallTree(ctx, t) {
  if (t.kind === 'chuoiNon') {
    thinLine(ctx, '#7a9a4d', 1.4, () => { ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - 9); });
    [-1, 1, 0.3].forEach((s, k) => fill(ctx, k % 2 ? '#6aa84f' : '#7cbf5a', () => ctx.ellipse(t.x + s * 5, t.y - 11 - k, 6, 2, s * 0.5, 0, Math.PI * 2)));
    return;
  }
  const leaf = t.kind === 'khe' ? '#4f9a4f' : '#5aa04a';
  shape(ctx, '#7a5230', () => ctx.rect(t.x - 1, t.y - 9, 2, 9), 0.5);
  fill(ctx, shade(leaf, -0.1), () => ctx.arc(t.x - 3, t.y - 12, 5, 0, Math.PI * 2));
  fill(ctx, leaf, () => ctx.arc(t.x + 2, t.y - 14, 5.5, 0, Math.PI * 2));
  thinLine(ctx, INK, 0.4, () => ctx.arc(t.x, t.y - 13, 7.5, Math.PI * 1.1, Math.PI * 1.9));
  if (t.kind === 'oi' || t.kind === 'khe') { // a few fruits
    const fruit = t.kind === 'oi' ? '#c5e17a' : '#f2c94c';
    for (let k = 0; k < 3; k += 1) fill(ctx, fruit, () => ctx.arc(t.x - 3 + k * 3, t.y - 11 + (k % 2) * 2, 0.9, 0, Math.PI * 2));
  }
}

const FENCES = scatter(400, 211, 6).filter((p) => noise(p.k, 213) < 0.5).map((p) => {
  const len = 18 + Math.floor(noise(p.k, 214) * 24);
  return { x: p.x, y: Math.round(p.y), len, bamboo: noise(p.k, 215) < 0.6 };
}).filter((f) => [0.25, 0.5, 0.75, 1].every((t) => free(f.x + f.len * t, f.y, 3)));

/** Hibiscus hedges in front of some houses, beside the door. */
const HEDGES = PLACES.filter((p) => p.kind === 'house' && p.door.y > p.front && noise(p.x, p.front, 221) < 0.25).map((h) => {
  const left = noise(h.x, h.front, 222) < 0.5;
  const len = Math.max(6, Math.round(h.w / 2 - 8));
  return { x: left ? h.x + 1 : h.x + h.w - 1 - len, y: h.front + 3, len };
});

const SMALL_TREES = scatter(500, 231, 7).filter((p) => noise(p.k, 233) < 0.35)
  .map((p) => ({ x: p.x, y: Math.round(p.y), kind: ['oi', 'khe', 'chuoiNon', 'oi'][Math.floor(noise(p.k, 234) * 4)] }));

/** Every standing green thing with the ground y it stands on. */
export const GREENERY = [
  ...FENCES.map((f) => ({ y: f.y, draw: (ctx) => fence(ctx, f) })),
  ...HEDGES.map((h) => ({ y: h.y, draw: (ctx) => hedge(ctx, h) })),
  ...SMALL_TREES.map((t) => ({ y: t.y, draw: (ctx) => smallTree(ctx, t) })),
];
export const GREENERY_COUNTS = { tufts: TUFTS.length, fences: FENCES.length, hedges: HEDGES.length, trees: SMALL_TREES.length };
export const groundIsFree = free;
