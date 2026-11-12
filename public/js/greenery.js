// Free ground: never on a way, a house, the market, the courtyard or the pond. The 3D xóm plants its small
// trees, fences and grass only where this says the ground is free.
import { MAP, RAIL_Y, nodesNear } from './map.js';
import { PLACES, TREES } from './places.js';

const BUSY = [
  ...PLACES.filter((p) => p.building).map((p) => ({ x0: p.x - 3, x1: p.x + p.w + 3, y0: p.front - (p.depth ?? 32) - 3, y1: p.front + 4 })),
  ...PLACES.filter((p) => p.y0 !== undefined).map((p) => ({ x0: p.x - 6, x1: p.x + p.w + 6, y0: p.y0 - 6, y1: (p.front ?? p.y1) + 6 })),
  ...TREES.map((t) => ({ x0: t.x - 16, x1: t.x + 16, y0: t.y - 10, y1: t.y + 4 })),
];
/** Ground at (x, y) with nothing on it within r: no way, no building, no open place, inside the xóm. */
export function groundIsFree(x, y, r) {
  if (x < 10 || x > MAP.w - 10 || y < RAIL_Y + 24 || y > 664) return false;
  if (nodesNear({ x, y }, r + 8).length > 0) return false;
  return !BUSY.some((b) => x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1);
}
