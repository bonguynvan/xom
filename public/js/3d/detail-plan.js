// What a street looks like from two steps away, as pure data (node:test): the room behind a shop's open front
// and what stands in it (shelves of goods, a counter, a ceiling fan, a television), what hangs on a balcony
// (laundry, a bird cage, potted plants), bicycles leaning by the doors. Everything is a list of simple solids
// in metres; detail3d.js builds them near you and drops them far away. Seeded: the same on every visit.
import { noise } from '../rng.js';

export const ROOM = { depth: 3.4, height: 2.75, pier: 0.4 }; // the shop room behind the opening
export const CHUNK = 24; // metres: details are built and culled in squares this big
export const GROUND_H = 3.4;
export const FLOOR_H = 3.2;
const r = (a, b, salt) => noise(a, b, 9500 + salt);

/** Which upper floors of a house have a balcony (buildings3d.js builds the slab and railing by the same rule). */
export const hasBalcony = (px, floor) => noise(px, floor, 12) <= 0.55;

/**
 * The opening of a shop front and the room behind it, for a building box { x0, x1, z0, z1 } whose street
 * front is z1: { x0, x1, top, front, back } in metres, or null when the shop is too narrow or too shallow.
 */
export function shopOpening(box) {
  const w = box.x1 - box.x0;
  const d = box.z1 - box.z0;
  if (w < 3.2 || d < 2.4) return null;
  return { x0: box.x0 + ROOM.pier, x1: box.x1 - ROOM.pier, top: ROOM.height, front: box.z1, back: box.z1 - Math.min(ROOM.depth, d - 0.6) };
}

const GOODS = {
  tapHoa: ['#e63946', '#f2b705', '#2d9cdb', '#3f8f6b', '#f4f1ea', '#e07a1f'], bangDia: ['#111111', '#c1121f', '#2d6fb5', '#f2b705'],
  hieuMay: ['#d1495b', '#2a5f5a', '#efe3c2', '#6a4c93', '#1f4e9c'], pho: ['#f4f1ea', '#d8c48c'], traDa: ['#3f8f6b', '#f4f1ea', '#d8c48c'],
  suaXe: ['#1b1b1b', '#3a3a3a', '#8c8a86'], catToc: ['#f4f1ea', '#2d9cdb'], hieuAnh: ['#111111', '#f4f1ea', '#b08a55'],
  buuDien: ['#e0a100', '#f4f1ea'], che: ['#d1495b', '#f2b705', '#9bc1a4'],
};
const TV = new Set(['bangDia', 'traDa', 'catToc', 'pho', 'che']);

/**
 * What stands in a shop's room. `kind` is the place kind, `o` the opening, `seed` any number. Returns solids:
 * { s: 'box' | 'cyl' | 'fan' | 'glow' | 'bulb', p: [x, y, z] (centre), d: [sx, sy, sz], c: '#rrggbb' }.
 */
export function interiorFor(kind, o, seed = 0) {
  const out = [];
  const w = o.x1 - o.x0;
  const depth = o.front - o.back;
  const cx = (o.x0 + o.x1) / 2;
  const goods = GOODS[kind] ?? GOODS.tapHoa;
  // shelves along the back wall, three boards, goods standing on each
  const sx0 = o.x0 + 0.15;
  const sx1 = o.x1 - 0.15;
  for (let tier = 0; tier < 3; tier += 1) {
    const y = 0.55 + tier * 0.6;
    out.push({ s: 'box', p: [cx, y, o.back + 0.2], d: [sx1 - sx0, 0.04, 0.34], c: '#6b4a2e' });
    for (let x = sx0 + 0.14, k = 0; x < sx1 - 0.1; x += 0.24 + r(seed, k, tier) * 0.12, k += 1) {
      if (r(seed, k, tier + 10) < 0.18) continue; // a gap where something was sold
      const h = 0.14 + r(seed, k, tier + 20) * 0.26;
      out.push({ s: r(seed, k, tier + 30) < 0.4 ? 'cyl' : 'box', p: [x, y + 0.02 + h / 2, o.back + 0.2], d: [0.16, h, 0.16], c: goods[Math.floor(r(seed, k, tier + 40) * goods.length)] });
    }
  }
  for (const x of [sx0 + 0.03, sx1 - 0.03]) out.push({ s: 'box', p: [x, 0.95, o.back + 0.2], d: [0.05, 1.9, 0.34], c: '#5a3d26' });
  // the counter, to one side near the front, with a glass-fronted case on it
  const side = r(seed, 1, 50) < 0.5 ? -1 : 1;
  const counterX = cx + side * (w / 2 - 0.85);
  out.push({ s: 'box', p: [counterX, 0.45, o.front - 0.9], d: [1.3, 0.9, 0.5], c: '#7a5433' });
  out.push({ s: 'box', p: [counterX, 1.02, o.front - 0.9], d: [0.9, 0.24, 0.36], c: '#b9d3d8' });
  // a ceiling fan and a bare bulb on its flex
  out.push({ s: 'fan', p: [cx, o.top - 0.28, o.back + depth * 0.55], d: [1.2, 0.04, 1.2], c: '#d9d2c0' });
  out.push({ s: 'bulb', p: [cx - side * 0.7, o.top - 0.45, o.front - 0.8], d: [0.09, 0.12, 0.09], c: '#ffd9a0' });
  if (TV.has(kind)) { // the television up on its bracket, facing the street
    const tx = cx - side * (w / 2 - 0.6);
    out.push({ s: 'box', p: [tx, 2.05, o.back + 0.42], d: [0.62, 0.5, 0.5], c: '#2a2523' });
    out.push({ s: 'glow', p: [tx, 2.07, o.back + 0.68], d: [0.5, 0.38, 0.01], c: '#9fc4ff' });
  }
  if (kind === 'pho' || kind === 'che' || kind === 'traDa') { // low tables and stools inside
    for (let k = 0; k < 2; k += 1) {
      const tx = cx - side * (0.3 + k * 1.1);
      const tz = o.back + 1.2 + (k % 2) * 0.5;
      if (tx < o.x0 + 0.5 || tx > o.x1 - 0.5) continue;
      out.push({ s: 'box', p: [tx, 0.42, tz], d: [0.7, 0.04, 0.5], c: '#8a6a45' });
      for (const [dx, dz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) out.push({ s: 'box', p: [tx + dx, 0.2, tz + dz], d: [0.04, 0.4, 0.04], c: '#6b4a2e' });
    }
    out.push({ s: 'cyl', p: [counterX, 1.05, o.front - 0.55], d: [0.42, 0.34, 0.42], c: '#b8b2a6' }); // the big pot
  }
  if (kind === 'suaXe') { // tyres stacked by the wall, a compressor
    for (let k = 0; k < 3; k += 1) out.push({ s: 'cyl', p: [o.x0 + 0.5, 0.09 + k * 0.17, o.front - 0.6], d: [0.62, 0.16, 0.62], c: '#1b1b1b' });
    out.push({ s: 'cyl', p: [o.x1 - 0.55, 0.3, o.back + 0.9], d: [0.4, 0.6, 0.4], c: '#b3261e' });
  }
  if (kind === 'hieuMay') { // the sewing table and bolts of cloth
    out.push({ s: 'box', p: [cx, 0.72, o.back + 1.3], d: [1.0, 0.05, 0.5], c: '#6b4a2e' });
    out.push({ s: 'box', p: [cx + 0.15, 0.88, o.back + 1.3], d: [0.36, 0.26, 0.18], c: '#1b1b1b' });
    for (let k = 0; k < 4; k += 1) out.push({ s: 'cyl', p: [o.x0 + 0.35 + k * 0.2, 0.6, o.front - 0.5], d: [0.16, 1.2, 0.16], c: goods[k % goods.length] });
  }
  return out;
}

const CLOTH = ['#f4f1ea', '#d1495b', '#2d6fb5', '#f2b705', '#3f8f6b', '#e8b4a0', '#6a4c93', '#f4f1ea'];

/**
 * What hangs on one balcony: `b` = { x0, x1, y (the slab's top), z (the wall), out (how far it sticks out) }.
 * Laundry on a line, sometimes a bird cage, some pots along the rail.
 */
export function balconyFor(b, seed = 0) {
  const out = [];
  const w = b.x1 - b.x0;
  if (r(seed, 1, 60) < 0.8) { // washing: shirts and trousers pegged to a line under the eaves
    const y = b.y + 1.75;
    const z = b.z + b.out * 0.55;
    out.push({ s: 'box', p: [(b.x0 + b.x1) / 2, y + 0.3, z], d: [w - 0.3, 0.012, 0.012], c: '#3a3a3a' });
    for (let x = b.x0 + 0.35, k = 0; x < b.x1 - 0.35; x += 0.42 + r(seed, k, 61) * 0.25, k += 1) {
      if (r(seed, k, 62) < 0.25) continue;
      const h = 0.4 + r(seed, k, 63) * 0.35;
      out.push({ s: 'box', p: [x, y + 0.3 - h / 2, z], d: [0.34, h, 0.02], c: CLOTH[Math.floor(r(seed, k, 64) * CLOTH.length)] });
    }
  }
  if (r(seed, 2, 65) < 0.35 && w > 2) { // a bird cage hanging at one end
    const x = b.x0 + 0.45;
    out.push({ s: 'cyl', p: [x, b.y + 1.75, b.z + b.out * 0.7], d: [0.26, 0.34, 0.26], c: '#b08a55' });
    out.push({ s: 'box', p: [x, b.y + 1.98, b.z + b.out * 0.7], d: [0.012, 0.14, 0.012], c: '#3a3a3a' });
    out.push({ s: 'box', p: [x, b.y + 1.68, b.z + b.out * 0.7], d: [0.07, 0.07, 0.11], c: '#e9a23b' });
  }
  const pots = Math.floor(r(seed, 3, 66) * 4);
  for (let k = 0; k < pots; k += 1) {
    const x = b.x1 - 0.4 - k * 0.5;
    if (x < b.x0 + 0.3) break;
    out.push({ s: 'cyl', p: [x, b.y + 0.12, b.z + b.out - 0.22], d: [0.24, 0.24, 0.24], c: '#a8623f' });
    out.push({ s: 'cyl', p: [x, b.y + 0.42, b.z + b.out - 0.22], d: [0.34, 0.38, 0.34], c: ['#3f8f6b', '#5a7a3a', '#2f6b4f'][k % 3] });
  }
  return out;
}

/** A bicycle leaning by the wall of about one house in five: [{ x, z, yaw, color }] on the pavement in front. */
export function bicycleSpots(houses) {
  const out = [];
  houses.forEach((b, k) => {
    if (r(k, 1, 70) > 0.2 || b.x1 - b.x0 < 3) return;
    out.push({ x: b.x0 + 0.6 + r(k, 2, 70) * (b.x1 - b.x0 - 1.2), z: b.z1 + 0.32, yaw: Math.PI / 2 + (r(k, 3, 70) - 0.5) * 0.3, color: ['#1f4e9c', '#2f6b4f', '#7a1e1a', '#1b1b1b'][k % 4] });
  });
  return out;
}

export const chunkKey = (x, z, size = CHUNK) => `${Math.floor(x / size)},${Math.floor(z / size)}`;

/** The chunk keys whose squares come within `radius` of (x, z). */
export function chunksNear(x, z, radius, size = CHUNK) {
  const out = [];
  for (let gx = Math.floor((x - radius) / size); gx <= Math.floor((x + radius) / size); gx += 1) {
    for (let gz = Math.floor((z - radius) / size); gz <= Math.floor((z + radius) / size); gz += 1) {
      const nx = Math.max(gx * size, Math.min(x, (gx + 1) * size));
      const nz = Math.max(gz * size, Math.min(z, (gz + 1) * size));
      if (Math.hypot(nx - x, nz - z) <= radius) out.push(`${gx},${gz}`);
    }
  }
  return out;
}

/**
 * Which chunks to show: those within `radius`, plus the ones already shown that are still within
 * `radius + keep` (so a detail does not flicker at the edge). Returns a new Set.
 */
export function visibleChunks(shown, x, z, radius, keep = 6, size = CHUNK) {
  const near = new Set(chunksNear(x, z, radius, size));
  const hold = new Set(chunksNear(x, z, radius + keep, size));
  return new Set([...near, ...[...shown].filter((k) => hold.has(k))]);
}
