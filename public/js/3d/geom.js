// A small mesh builder: the xóm has hundreds of houses, so their walls, roofs and details are pushed into a
// handful of merged geometries (one per material) instead of thousands of meshes. UVs are in metres scaled by
// a texture's real size, so a wall 8 m wide shows two window bays, never one stretched bay.
import * as THREE from '../vendor/three/three.module.min.js';
import { toX, toZ } from './coords.js';

export class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }

  get empty() { return this.idx.length === 0; }

  /** A flat quad a-b-c-d (counter-clockwise seen from the front) with uvs for a, b, c, d. */
  quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], color = null) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    const base = this.pos.length / 3;
    for (const [k, p] of [a, b, c, d].entries()) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uv[k][0], uv[k][1]);
      if (color) this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return this;
  }

  /**
   * An axis-aligned box from (x0, y0, z0) to (x1, y1, z1). `faces` picks which sides (default all but the
   * bottom); `tile` = metres per texture repeat [u, v].
   */
  box(x0, y0, z0, x1, y1, z1, { faces = 'nsewt', tile = [1, 1], color = null } = {}) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const [tu, tv] = tile;
    const u = (a, b) => [[0, 0], [a / tu, 0], [a / tu, b / tv], [0, b / tv]];
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    if (faces.includes('s')) this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), u(w, h), color); // front, +Z
    if (faces.includes('n')) this.quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), u(w, h), color);
    if (faces.includes('e')) this.quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), u(d, h), color);
    if (faces.includes('w')) this.quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), u(d, h), color);
    if (faces.includes('t')) this.quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), u(w, d), color);
    if (faces.includes('b')) this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), u(w, d), color);
    return this;
  }

  /** Append an existing (non-indexed or indexed) geometry, moved by a matrix, optionally coloured. */
  add(geometry, matrix, color = null) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const t = g.attributes.uv;
    const base = this.pos.length / 3;
    for (let k = 0; k < p.count; k += 1) {
      this.pos.push(p.getX(k), p.getY(k), p.getZ(k));
      this.nor.push(n.getX(k), n.getY(k), n.getZ(k));
      this.uv.push(t ? t.getX(k) : 0, t ? t.getY(k) : 0);
      if (color) this.col.push(color.r, color.g, color.b);
      this.idx.push(base + k);
    }
    g.dispose();
    return this;
  }

  /** Append everything another builder holds. */
  merge(other) {
    const base = this.pos.length / 3;
    this.pos.push(...other.pos);
    this.nor.push(...other.nor);
    this.uv.push(...other.uv);
    this.col.push(...other.col);
    for (const i of other.idx) this.idx.push(base + i);
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length === this.pos.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * A flat strip along a map line (alleys, the road, pavements), `half` map units each side of it or between
 * offsets [inner, outer]; u runs across 0..1, v along in metres / `tileV`.
 */
export function ribbon(line, { from, to, y = 0.02, tileV = 4 }) {
  const b = new Builder();
  let along = 0;
  const edge = (k) => {
    const a = line[Math.max(0, k - 1)];
    const c = line[Math.min(line.length - 1, k + 1)];
    const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    const nx = -(c.y - a.y) / len;
    const ny = (c.x - a.x) / len;
    const p = line[k];
    return [new THREE.Vector3(toX(p.x + nx * from), y, toZ(p.y + ny * from)), new THREE.Vector3(toX(p.x + nx * to), y, toZ(p.y + ny * to))];
  };
  let prev = edge(0);
  for (let k = 1; k < line.length; k += 1) {
    const next = edge(k);
    const step = Math.hypot(toX(line[k].x) - toX(line[k - 1].x), toZ(line[k].y) - toZ(line[k - 1].y));
    const v0 = along / tileV;
    const v1 = (along + step) / tileV;
    // wound so the face looks up (+Y) whichever way the offsets run
    const up = new THREE.Vector3().subVectors(prev[1], prev[0]).cross(new THREE.Vector3().subVectors(next[0], prev[0])).y > 0;
    if (up) b.quad(prev[0], prev[1], next[1], next[0], [[0, v0], [1, v0], [1, v1], [0, v1]]);
    else b.quad(prev[1], prev[0], next[0], next[1], [[1, v0], [0, v0], [0, v1], [1, v1]]);
    along += step;
    prev = next;
  }
  return b;
}

/** Points along a map line in metres at height y (for kerbs, wires, rails). */
export const lineToWorld = (line, y = 0) => line.map((p) => new THREE.Vector3(toX(p.x), y, toZ(p.y)));
