// The small things that make a street Vietnamese, in map units: motorbikes parked along the pavements,
// quán cóc (a parasol, a low table, plastic stools, a honeycomb-coal stove), the banner across the road,
// the xóm gate, bamboo hedges along the paddies. Data only: the 3D xóm builds them.
import { MAP, PAVE_N, PAVE_S, ZEBRAS, yOn } from './map.js';
import { noise } from './rng.js';


// ---------------- motorbikes ----------------

const BIKE_COLORS = ['#c1121f', '#2d9cdb', '#f2b705', '#e9dcc0', '#3f8f6b', '#ef476f'];

// ---------------- quán vỉa hè: low tables and plastic stools all over the pavement ----------------

const SHOPFRONTS_END = 770; // the north pavement before this is the shops' own (they have their stools)

/** Clusters of stools round a low table, every few steps along both pavements. */
export const STOOL_CLUSTERS = [PAVE_N, PAVE_S].flatMap((line, side) => {
  const out = [];
  for (let x = 24; x < MAP.w - 24; x += 26) {
    const cx = x + Math.round(noise(x, side, 161) * 8);
    if (noise(x, side, 162) > 0.62 || ZEBRAS.some((z) => Math.abs(z - cx) < 16) || (side === 0 && cx < SHOPFRONTS_END)) continue;
    const cy = Math.round(yOn(line, cx) + (side ? 1 : -1));
    const n = 4 + Math.floor(noise(x, side, 163) * 3);
    const stools = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + noise(x, side, k, 164) * 0.4;
      const sx = cx + Math.cos(a) * 9;
      return { x: Math.round(sx), y: Math.round(cy + Math.sin(a) * 4), face: sx < cx ? 1 : -1, color: noise(x, side, k, 165) < 0.55 ? '#e63946' : '#2d9cdb' };
    });
    out.push({ x: cx, y: cy, side, stools });
  }
  return out;
});

/** Where bikes are parked: along both pavements where there is room (not on a zebra, not among the stools). */
export const BIKES = [PAVE_N, PAVE_S].flatMap((line, side) => {
  const out = [];
  for (let x = 30; x < MAP.w - 30; x += 13) {
    if (noise(x, side, 71) > 0.42 || STOOL_CLUSTERS.some((c) => c.side === side && Math.abs(c.x - x) < 16)) continue;
    out.push({ x, y: Math.round(yOn(line, x) + (side ? -3 : 3)), color: BIKE_COLORS[Math.floor(noise(x, side, 72) * BIKE_COLORS.length)], dir: noise(x, side, 73) < 0.5 ? 1 : -1 });
  }
  return out;
});

// ---------------- quán cóc ----------------

/** A street stall to sit at: parasol, low table, stools; seats are the stools. */
export function quanCoc(id, x, y) {
  const seats = [[-9, 2], [9, 2], [0, 7], [-6, -4]].map(([dx, dy]) => ({ x: x + dx, y: y + dy, pose: 'sit' }));
  return { id, kind: 'quanCoc', name: 'Quán cóc', x: x - 14, w: 28, y0: y - 8, y1: y + 10, front: y + 10, open: [6, 22.5], spots: seats, cx: x, cy: y };
}

// ---------------- over the road: the banner and the xóm gate ----------------

export const BANNER_X = 990;
export const GATE_X = 1330;

// ---------------- the edge of the xóm: bamboo, paddies, egrets ----------------

/** Bamboo hedge along the paddies at the bottom of the map. */
export const HEDGE = Array.from({ length: 34 }, (_, k) => ({ x: 20 + k * 42 + noise(k, 91) * 14, y: 684 + noise(k, 92) * 8 }));
