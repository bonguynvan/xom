// The street from two steps away: what is inside the open shops (shelves of goods, a counter, a turning
// ceiling fan, a television), what hangs on the balconies (washing, a bird cage, pots), bicycles by the doors.
// detail-plan.js (pure) says what goes where; here it is built square by square (CHUNK metres) only when you
// come near, one square a frame at most, shown within the tier's radius and hidden beyond it. Each square is
// one merged mesh; all the fans together are one instanced mesh.
import * as THREE from '../vendor/three/three.module.min.js';
import { CHUNK, FLOOR_H, GROUND_H, balconyFor, bicycleSpots, chunkKey, hasBalcony, interiorFor, visibleChunks } from './detail-plan.js';
import { Builder } from './geom.js';
import { bicycle } from './models.js';
import { KERB } from './terrain.js';

const FANS = 48;
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** `boxes` are buildings3d.js's (with kind, floors, px, shop). `radius` = metres within which details show (0 = none). */
export function buildDetail(scene, { boxes, radius }) {
  const group = new THREE.Group();
  group.name = 'detail';
  scene.add(group);
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const lights = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, toneMapped: false });
  const blades = new Builder();
  for (let k = 0; k < 3; k += 1) blades.add(new THREE.BoxGeometry(0.6, 0.02, 0.13).translate(0.34, 0, 0), m4.makeRotationY((k * Math.PI * 2) / 3), new THREE.Color(0xd9d2c0));
  blades.add(cyl, m4.compose(V(0, 0.12, 0), q.identity(), V(0.05, 0.3, 0.05)), new THREE.Color(0x8c8a86));
  const fans = new THREE.InstancedMesh(blades.build(), solid, FANS);
  fans.count = 0;
  fans.frustumCulled = false;
  group.add(fans);
  if (radius <= 0) return { group, materials: [solid], update: () => {}, built: 0 };

  // which buildings feed which square (by the middle of their street front)
  const sources = new Map();
  boxes.forEach((b, k) => {
    const key = chunkKey((b.x0 + b.x1) / 2, b.z1);
    if (b.shop || (b.kind === 'house' && b.floors > 1)) sources.set(key, [...(sources.get(key) ?? []), { b, k }]);
  });
  const spots = bicycleSpots(boxes.filter((b) => b.kind === 'house'));
  if (spots.length) { // the bicycles are few and small: one instanced mesh, always there
    const bikes = new THREE.InstancedMesh(bicycle(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }), spots.length);
    spots.forEach((s, k) => {
      q.setFromEuler(new THREE.Euler(0, s.yaw, 0.16)); // leaning on the wall
      bikes.setMatrixAt(k, m4.compose(V(s.x, KERB, s.z), q, V(1, 1, 1)));
      bikes.setColorAt(k, new THREE.Color(s.color));
    });
    bikes.castShadow = true;
    bikes.receiveShadow = true;
    group.add(bikes);
  }

  const chunks = new Map(); // key -> { mesh, glow, fans: [Vector3] }
  function build(key) {
    const b = new Builder();
    const g = new Builder();
    const fanAt = [];
    const put = (it) => {
      const [x, y, z] = it.p;
      const [sx, sy, sz] = it.d;
      const color = new THREE.Color(it.c);
      if (it.s === 'fan') fanAt.push(V(x, y, z));
      else if (it.s === 'glow' || it.s === 'bulb') g.box(x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2, { faces: 'nsewtb', color });
      else if (it.s === 'cyl') b.add(cyl, m4.compose(V(x, y, z), q.identity(), V(sx, sy, sz)), color);
      else b.box(x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2, { faces: 'nsewtb', color });
    };
    for (const { b: box, k } of sources.get(key) ?? []) {
      if (box.shop) for (const it of interiorFor(box.kind, box.shop, k)) put(it);
      if (box.kind === 'house') {
        for (let f = 1; f < box.floors; f += 1) {
          if (!hasBalcony(box.px, f)) continue;
          for (const it of balconyFor({ x0: box.x0 + 0.25, x1: box.x1 - 0.25, y: GROUND_H + (f - 1) * FLOOR_H, z: box.z1, out: 0.82 }, k * 7 + f)) put(it);
        }
      }
    }
    const entry = { mesh: null, glow: null, fans: fanAt };
    if (!b.empty) { entry.mesh = new THREE.Mesh(b.build(), solid); entry.mesh.receiveShadow = true; group.add(entry.mesh); }
    if (!g.empty) { entry.glow = new THREE.Mesh(g.build(), lights); group.add(entry.glow); }
    chunks.set(key, entry);
  }

  let shown = new Set();
  return {
    group,
    materials: [solid],
    get built() { return chunks.size; },
    /** Each frame: (x, z) = where you are (metres), `t` seconds, `dark` 0..1. */
    update(x, z, t, dark) {
      shown = visibleChunks(shown, x, z, radius, 6, CHUNK);
      const missing = [...shown].find((key) => !chunks.has(key) && sources.has(key));
      if (missing) build(missing); // one square a frame: no hitch as you walk
      let n = 0;
      for (const [key, c] of chunks) {
        const on = shown.has(key);
        if (c.mesh) c.mesh.visible = on;
        if (c.glow) c.glow.visible = on;
        if (!on) continue;
        for (const p of c.fans) {
          if (n >= FANS) break;
          fans.setMatrixAt(n, m4.makeRotationY(t * 7 + p.x).setPosition(p));
          n += 1;
        }
      }
      fans.count = n;
      fans.instanceMatrix.needsUpdate = true;
      lights.opacity = 0.35 + dark * 0.65;
    },
  };
}
