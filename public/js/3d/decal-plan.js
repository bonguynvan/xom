// Where the small marks of a lived-in street go, as pure data (node:test): a house number by every door,
// stencilled adverts and paper flyers on walls, oil stains and manhole covers on the road, fallen leaves under
// the trees. decals3d.js paints the atlas and builds one mesh from this plan. Seeded: the same on every visit.
import { noise } from '../rng.js';

const CELL = (x, y, w, h) => ({ x, y, w, h });
/** The atlas (pixels): which rectangle each kind of mark is painted in. */
export const ATLAS = {
  w: 2048, h: 1024,
  ads: Array.from({ length: 8 }, (_, k) => CELL((k % 4) * 256, Math.floor(k / 4) * 128, 256, 128)),
  flyers: Array.from({ length: 8 }, (_, k) => CELL(k * 128, 256, 128, 128)),
  stains: Array.from({ length: 4 }, (_, k) => CELL(k * 256, 384, 256, 256)),
  leaves: Array.from({ length: 3 }, (_, k) => CELL(k * 256, 640, 256, 256)),
  manhole: CELL(768, 640, 256, 256),
  numbers: Array.from({ length: 128 }, (_, k) => CELL(1024 + (k % 16) * 64, Math.floor(k / 16) * 40, 64, 40)),
};

const r = (a, b, salt) => noise(a, b, 9000 + salt);

/**
 * `houses` = [{ x0, x1, z0, z1, shop? }] in metres (the street front is z1; `shop` = it has an open front); `road` = { points: [{ x, z }], half }
 * (the centre line and half the width); `trees` = [{ x, z }]; `kerb` = how high the pavement stands.
 * Returns [{ cell, x, y, z, w, h, face: 's' | 'e' | 'w' | 'up', spin }] (x, y, z = the mark's centre).
 */
export function planDecals({ houses = [], road = { points: [], half: 0 }, trees = [], kerb = 0.14 }) {
  const out = [];
  houses.forEach((b, k) => {
    const w = b.x1 - b.x0;
    const open = Boolean(b.shop); // a shop front stands open: only its number, on the pier beside the opening
    out.push({ cell: ATLAS.numbers[(k * 2 + (k % 2)) % 128], x: b.x1 - (open ? 0.2 : 0.42), y: 2.42, z: b.z1, w: 0.34, h: 0.21, face: 's', spin: 0 });
    if (!open && r(k, 1, 1) < 0.38 && w > 2.6) { // a stencilled advert, sprayed at arm's height
      const a = Math.floor(r(k, 2, 1) * 8);
      out.push({ cell: ATLAS.ads[a], x: b.x0 + 0.7 + r(k, 3, 1) * Math.max(0, w - 1.4), y: 1.0 + r(k, 4, 1) * 0.7, z: b.z1, w: 1.0, h: 0.5, face: 's', spin: 0 });
    }
    const flyers = !open && r(k, 5, 1) < 0.34 ? 1 + Math.floor(r(k, 6, 1) * 3) : 0;
    for (let f = 0; f < flyers; f += 1) {
      out.push({ cell: ATLAS.flyers[Math.floor(r(k, f, 2) * 8)], x: b.x0 + 0.25 + f * 0.27, y: 1.35 + r(k, f, 3) * 0.3, z: b.z1, w: 0.24, h: 0.24, face: 's', spin: 0 });
    }
    for (const face of ['e', 'w']) { // the side walls, where an alley runs past
      if (r(k, face === 'e' ? 7 : 8, 1) > 0.22 || b.z1 - b.z0 < 3) continue;
      const z = b.z0 + 1 + r(k, 9, face === 'e' ? 1 : 2) * (b.z1 - b.z0 - 2);
      out.push({ cell: ATLAS.ads[Math.floor(r(k, 10, face === 'e' ? 1 : 2) * 8)], x: face === 'e' ? b.x1 : b.x0, y: 1.1 + r(k, 11, 1) * 0.6, z, w: 1.0, h: 0.5, face, spin: 0 });
    }
  });
  let along = 0;
  let nextStain = 4;
  let nextHole = 22;
  for (let k = 1; k < road.points.length; k += 1) {
    const [a, b] = [road.points[k - 1], road.points[k]];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const [ux, uz] = [(b.x - a.x) / len, (b.z - a.z) / len];
    const at = (d, off) => ({ x: a.x + ux * (d - along) - uz * off, z: a.z + uz * (d - along) + ux * off });
    while (nextStain < along + len) {
      const n = Math.round(nextStain * 10);
      const p = at(nextStain, (r(n, 1, 4) - 0.5) * 1.6 * road.half);
      const s = 0.8 + r(n, 2, 4) * 1.0;
      out.push({ cell: ATLAS.stains[Math.floor(r(n, 3, 4) * 4)], x: p.x, y: 0.045, z: p.z, w: s, h: s, face: 'up', spin: r(n, 4, 4) * Math.PI * 2 });
      nextStain += 5 + r(n, 5, 4) * 9;
    }
    while (nextHole < along + len) {
      const n = Math.round(nextHole * 10);
      const p = at(nextHole, (r(n, 1, 5) < 0.5 ? -0.45 : 0.45) * road.half);
      out.push({ cell: ATLAS.manhole, x: p.x, y: 0.05, z: p.z, w: 0.78, h: 0.78, face: 'up', spin: r(n, 2, 5) * Math.PI * 2 });
      nextHole += 38 + r(n, 3, 5) * 20;
    }
    along += len;
  }
  trees.forEach((t, k) => {
    for (let f = 0; f < 5; f += 1) {
      const a = r(k, f, 6) * Math.PI * 2;
      const d = 0.4 + r(k, f, 7) * 2.4;
      const s = 1.1 + r(k, f, 8) * 0.9;
      out.push({ cell: ATLAS.leaves[Math.floor(r(k, f, 9) * 3)], x: t.x + Math.cos(a) * d, y: (t.y ?? kerb) + 0.03, z: t.z + Math.sin(a) * d, w: s, h: s, face: 'up', spin: r(k, f, 10) * Math.PI * 2 });
    }
  });
  return out;
}
