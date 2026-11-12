// The bridge between the map (x right, y towards the viewer, in map units) and the 3D xóm (metres, Y up).
// Pure and dependency-free so node:test can check it: no three.js in here.
// Map y grows towards the viewer, which in the 3D scene is +Z (south). North (the railway) is -Z.

export const M = 0.15; // metres per map unit: a tube house 34-56 units wide is 5-8 m, the road about 5.4 m
export const CX = 700; // map centre, so the scene sits round the origin
export const CY = 350;
export const PERSON_HEIGHT = 1.65; // grown-ups in metres, whatever the old sprite size was
export const FLOOR_H = 3.2; // one storey of a tube house
export const HOUSE_DEPTH_EXTRA = 2.4; // tube houses are deeper than the map shows: they grow backwards this far when free

export const toX = (x) => (x - CX) * M;
export const toZ = (y) => (y - CY) * M;
export const toMap = (X, Z) => ({ x: X / M + CX, y: Z / M + CY });

/** The heading (radians about Y) of something moving by (dx, dy) on the map; a glTF character faces +Z at 0. */
export const yawOf = (dx, dy) => Math.atan2(dx, dy);

/** Turn `from` towards `to` by at most `step` radians, the short way round. */
export function turnTowards(from, to, step) {
  let d = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  if (Math.abs(d) <= step) return to;
  d = Math.sign(d) * step;
  return from + d;
}

/** The ground rectangle (metres) a building stands on: {x0, x1, z0, z1} with z1 its front. */
export function footprint(p, depth = p.depth ?? 32) {
  return { x0: toX(p.x), x1: toX(p.x + p.w), z0: toZ(p.front - depth), z1: toZ(p.front) };
}

/** Everything a walker cannot pass through: every building (but trees and booths in `open`) and the pond (metres). */
export function blockers(places, open = new Set()) {
  const boxes = places.filter((p) => p.building && !open.has(p.kind)).map((p) => footprint(p));
  const ponds = places.filter((p) => p.pond).map(({ pond }) => ({ cx: toX(pond.cx), cz: toZ(pond.cy), rx: pond.rx * M * 0.92, rz: pond.ry * M * 0.92 }));
  return { boxes, ponds };
}

/** A grid over the boxes so a walker only tests the few that are near (the xóm has ~150 buildings). */
export function boxGrid(boxes, cell = 8) {
  const grid = new Map();
  boxes.forEach((b, k) => {
    for (let gx = Math.floor(b.x0 / cell); gx <= Math.floor(b.x1 / cell); gx += 1) {
      for (let gz = Math.floor(b.z0 / cell); gz <= Math.floor(b.z1 / cell); gz += 1) {
        const key = `${gx},${gz}`;
        grid.set(key, [...(grid.get(key) ?? []), k]);
      }
    }
  });
  return { cell, grid, boxes };
}

function nearBoxes(index, X, Z) {
  const gx = Math.floor(X / index.cell);
  const gz = Math.floor(Z / index.cell);
  const out = new Set();
  for (let dx = -1; dx <= 1; dx += 1) for (let dz = -1; dz <= 1; dz += 1) for (const k of index.grid.get(`${gx + dx},${gz + dz}`) ?? []) out.add(k);
  return [...out].map((k) => index.boxes[k]);
}

/**
 * Where a walker of radius r ends up when it tries to stand at (X, Z): pushed out of any building and out
 * of the pond, and kept inside the bounds. Returns a new {X, Z}; never mutates.
 */
export function collide(X, Z, r, index, ponds = [], bounds = null) {
  let x = X;
  let z = Z;
  for (const b of nearBoxes(index, x, z)) {
    if (x + r <= b.x0 || x - r >= b.x1 || z + r <= b.z0 || z - r >= b.z1) continue;
    const pushes = [[b.x0 - r - x, 0], [b.x1 + r - x, 0], [0, b.z0 - r - z], [0, b.z1 + r - z]];
    const [px, pz] = pushes.reduce((best, p) => (Math.abs(p[0] + p[1]) < Math.abs(best[0] + best[1]) ? p : best));
    x += px;
    z += pz;
  }
  for (const p of ponds) {
    const ex = (x - p.cx) / (p.rx + r);
    const ez = (z - p.cz) / (p.rz + r);
    const d = Math.hypot(ex, ez);
    if (d < 1 && d > 1e-6) { x = p.cx + (ex / d) * (p.rx + r); z = p.cz + (ez / d) * (p.rz + r); }
  }
  if (bounds) {
    x = Math.max(bounds.x0, Math.min(bounds.x1, x));
    z = Math.max(bounds.z0, Math.min(bounds.z1, z));
  }
  return { X: x, Z: z };
}

/** Sun direction for an hour of the day in Hà Nội (21°N): rises in the east (+X), noon high in the south (+Z). */
export function sunAt(hour) {
  const day = (hour - 6) / 12; // 0 at sunrise, 1 at sunset
  const elevation = Math.sin(Math.PI * day) * (68 * Math.PI) / 180; // below zero at night
  const azimuth = Math.PI * day; // 0 east, PI/2 south, PI west
  return {
    elevation,
    x: Math.cos(azimuth) * Math.cos(elevation),
    y: Math.sin(elevation),
    z: Math.sin(azimuth) * Math.cos(elevation) * 0.55 + 0.25 * Math.cos(elevation), // the sun stays a little to the south
  };
}

/** How dark it is (0 bright day, 1 deep night). */
export function darkAt(hour) {
  if (hour < 5 || hour >= 20.5) return 1;
  if (hour < 6.5) return (6.5 - hour) / 1.5;
  if (hour > 18) return Math.min(1, (hour - 18) / 2.5);
  return 0;
}

/** Height in metres of someone drawn `size` map units tall: grown-ups ~1.65 m, kids smaller, never giants. */
export function heightOf(kind, size, adult = 15) {
  if (kind === 'kid') return 1.1 + Math.min(0.25, Math.max(0, (size - 8) * 0.02));
  return Math.max(1.45, Math.min(1.85, PERSON_HEIGHT * (size / adult) ** 0.25));
}
