// Your body against the xóm, as pure maths (node:test): an upright capsule is a circle on the ground, the
// buildings are boxes (coords.js boxGrid), the pond an ellipse. Moving slides along walls and rolls round
// corners, in sub-steps short enough that nothing is ever jumped through. No three.js.

/** The boxes whose grid cells touch the rectangle (x0..x1, z0..z1). */
export function boxesIn(index, x0, z0, x1, z1) {
  const out = new Set();
  const c = index.cell;
  for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx += 1) {
    for (let gz = Math.floor(z0 / c); gz <= Math.floor(z1 / c); gz += 1) for (const k of index.grid.get(`${gx},${gz}`) ?? []) out.add(k);
  }
  return [...out].map((k) => index.boxes[k]);
}

/** Push a circle (x, z, r) out of one box: along the line from the box's nearest point, so corners are round. */
function outOfBox(x, z, r, b) {
  const nx = Math.max(b.x0, Math.min(b.x1, x));
  const nz = Math.max(b.z0, Math.min(b.z1, z));
  const dx = x - nx;
  const dz = z - nz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return null;
  if (d > 1e-9) return { x: nx + (dx / d) * r, z: nz + (dz / d) * r };
  // the centre itself is inside: leave by the nearest wall
  const ways = [[b.x0 - r, z, x - b.x0], [b.x1 + r, z, b.x1 - x], [x, b.z0 - r, z - b.z0], [x, b.z1 + r, b.z1 - z]];
  const [ox, oz] = ways.reduce((best, w) => (w[2] < best[2] ? w : best));
  return { x: ox, z: oz };
}

/** Where a circle of radius r can stand nearest to (X, Z): out of every box and pond, inside the bounds. */
export function settle(X, Z, r, index, ponds = [], bounds = null) {
  let x = X;
  let z = Z;
  for (let pass = 0; pass < 8; pass += 1) { // a push out of one wall may push into the next: go round again
    let moved = false;
    for (const b of boxesIn(index, x - r, z - r, x + r, z + r)) {
      const p = outOfBox(x, z, r, b);
      if (p) { x = p.x; z = p.z; moved = true; }
    }
    for (const p of ponds) {
      const ex = (x - p.cx) / (p.rx + r);
      const ez = (z - p.cz) / (p.rz + r);
      const d = Math.hypot(ex, ez);
      if (d < 1 && d > 1e-6) { x = p.cx + (ex / d) * (p.rx + r); z = p.cz + (ez / d) * (p.rz + r); moved = true; }
    }
    if (bounds) { x = Math.max(bounds.x0, Math.min(bounds.x1, x)); z = Math.max(bounds.z0, Math.min(bounds.z1, z)); }
    if (!moved) break;
  }
  return { X: x, Z: z };
}

/**
 * Move a circle from (X, Z) by (dx, dz): in steps no longer than half its radius, each settled against the
 * walls, so the part of the movement along a wall is kept (sliding) and nothing thin is skipped over.
 * Returns a new { X, Z, blocked } (`blocked` = 0..1, how much of the way was lost to walls).
 */
export function slide(X, Z, dx, dz, r, index, ponds = [], bounds = null) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return { ...settle(X, Z, r, index, ponds, bounds), blocked: 0 };
  const steps = Math.max(1, Math.ceil(len / (r * 0.5)));
  let p = { X, Z };
  for (let k = 0; k < steps; k += 1) p = settle(p.X + dx / steps, p.Z + dz / steps, r, index, ponds, bounds);
  return { ...p, blocked: Math.max(0, 1 - Math.hypot(p.X - X, p.Z - Z) / len) };
}

/** How deep a circle is inside the nearest box it overlaps (0 when clear): what the tests assert on. */
export function depthIn(X, Z, r, index) {
  let worst = 0;
  for (const b of boxesIn(index, X - r, Z - r, X + r, Z + r)) {
    const d = Math.hypot(X - Math.max(b.x0, Math.min(b.x1, X)), Z - Math.max(b.z0, Math.min(b.z1, Z)));
    worst = Math.max(worst, r - d);
  }
  return worst;
}
