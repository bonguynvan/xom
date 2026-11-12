// Everything else that stands in the xóm: concrete power poles and the famous tangle of wires, the loa
// phường, street lamps (real lights at night), the market stalls under tarpaulins, the đình with its curved
// roof, the well, the xe lam stop, quán cóc parasols, plastic stools on the pavement, parked Cubs, the
// phone booth, the ward banner, the xóm gate and the flag on the UBND.
import * as THREE from '../vendor/three/three.module.min.js';
import { TRAYS } from '../decor.js';
import { ROAD_HALF, ROAD_LINE, yOn } from '../map.js';
import { LAMPS, PLACES, POLES } from '../places.js';
import { noise } from '../rng.js';
import { BANNER_X, BIKES, GATE_X, STOOL_CLUSTERS } from '../street-life.js';
import { toX, toZ } from './coords.js';
import { Builder } from './geom.js';
import { cub, stool } from './models.js';
import { KERB, surfaceY } from './terrain.js';
import { roofTiles, signTexture, texture } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const shadow = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const box = new THREE.BoxGeometry(1, 1, 1);

export function buildProps(scene) {
  const group = new THREE.Group();
  group.name = 'props';
  const concreteB = new Builder();
  const woodB = new Builder();
  const darkB = new Builder();
  const redB = new Builder();
  const lamps = [];
  const bulbB = new Builder(); // every lamp's bulb in one mesh: they all glow together
  const shade = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const bulbGeo = new THREE.SphereGeometry(0.11, 10, 8);

  // ---------------- poles, wires and the loudspeaker ----------------
  const tops = POLES.map((p) => {
    const x = toX(p.x);
    const z = toZ(p.y);
    concreteB.add(cyl, m4.compose(V(x, 4.25 + KERB, z), q.identity(), V(0.26, 8.5, 0.26)));
    for (const h of [7.4, 7.9]) darkB.box(x - 0.6, h + KERB, z - 0.05, x + 0.6, h + 0.08 + KERB, z + 0.05); // cross arms
    if (p.loa) { // two horn speakers pointing up and down the street
      for (const dir of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 14, 1, true), mat(0x9aa0a6, { metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
        horn.position.set(x + dir * 0.4, 6.8 + KERB, z);
        horn.rotation.z = (dir * Math.PI) / 2 - dir * 0.25;
        group.add(horn);
      }
    }
    return { x, z };
  });
  const wires = [];
  const sag = (a, b, drop, count = 18) => {
    const pts = [];
    for (let k = 0; k <= count; k += 1) {
      const t = k / count;
      pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(V(0, -Math.sin(Math.PI * t) * drop, 0)));
    }
    wires.push(new THREE.CatmullRomCurve3(pts));
  };
  for (let k = 0; k < tops.length - 1; k += 1) {
    const [a, b] = [tops[k], tops[k + 1]];
    for (let w = 0; w < 7; w += 1) { // wires and fat cable bundles, each sagging its own way
      const y = 7.45 + (w % 3) * 0.24 + KERB;
      const dx = (w % 2 ? 0.5 : -0.5) * (w / 7);
      sag(V(a.x + dx, y, a.z), V(b.x + dx, y, b.z), 0.6 + noise(k, w, 601) * 0.9);
    }
  }
  const houses = PLACES.filter((p) => p.building && p.floors);
  for (const t of tops) { // service drops from each pole to houses nearby
    const near = houses.filter((p) => Math.abs(toX(p.x + p.w / 2) - t.x) < 18).slice(0, 6);
    for (const h of near) sag(V(t.x, 7.3 + KERB, t.z), V(toX(h.x + h.w * 0.3), 3.6, toZ(h.front) + 0.05), 0.4);
  }
  for (const [k, curve] of wires.entries()) {
    darkB.add(new THREE.TubeGeometry(curve, 24, k % 5 === 0 ? 0.03 : 0.013, 4, false), m4.identity());
  }

  // ---------------- street lamps ----------------
  for (const l of LAMPS) {
    const x = toX(l.x);
    const z = toZ(l.y);
    const y0 = surfaceY(l.x, l.y);
    darkB.add(cyl, m4.compose(V(x, y0 + 3, z), q.identity(), V(0.09, 6, 0.09)));
    darkB.box(x, y0 + 5.9, z - 0.04, x + 1.3, y0 + 6.0, z + 0.04);
    darkB.add(shade, m4.compose(V(x + 1.3, y0 + 5.95, z), q.setFromAxisAngle(V(1, 0, 0), Math.PI), V(1, 1, 1)));
    bulbB.add(bulbGeo, m4.compose(V(x + 1.3, y0 + 5.82, z), q.identity(), V(1, 1, 1)));
    const light = new THREE.PointLight(0xffb36b, 0, 26, 1.6);
    light.position.set(x + 1.3, y0 + 5.6, z);
    group.add(light);
    lamps.push(light);
  }

  // ---------------- the market: stalls under tarpaulins, trays of produce ----------------
  const cho = PLACES.find((p) => p.kind === 'cho');
  const tarps = new Builder();
  for (const [k, s] of cho.stalls.entries()) {
    const x = toX(s.x);
    const z = toZ(s.y);
    woodB.box(x - 1.1, 0.75, z - 0.6, x + 1.1, 0.82, z + 0.6, { faces: 'nsewt' });
    for (const [dx, dz] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) woodB.box(x + dx - 0.04, 0, z + dz - 0.04, x + dx + 0.04, 0.75, z + dz + 0.04, { faces: 'nsew' });
    for (const [dx, dz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.3], [1.4, 1.3]]) woodB.box(x + dx - 0.035, 0, z + dz - 0.035, x + dx + 0.035, dz < 0 ? 2.6 : 2.2, z + dz + 0.035, { faces: 'nsew' });
    const c = new THREE.Color(['#2d6fb5', '#c1121f', '#2f8f5a', '#e07a1f', '#2d6fb5', '#6a4c93'][k % 6]);
    tarps.quad(V(x - 1.6, 2.15, z + 1.45), V(x + 1.6, 2.15, z + 1.45), V(x + 1.6, 2.65, z - 1.3), V(x - 1.6, 2.65, z - 1.3), undefined, c);
    for (let g = 0; g < 6; g += 1) { // goods on the table: baskets of fruit, greens, fish
      const gc = new THREE.Color(['#e9a23b', '#6aa84f', '#c0392b', '#d4b483', '#9bc1a4', '#f1c232'][(k + g) % 6]);
      redB.add(cyl, m4.compose(V(x - 0.8 + (g % 3) * 0.8, 0.9, z - 0.3 + Math.floor(g / 3) * 0.6), q.identity(), V(0.5, 0.14, 0.5)), gc);
    }
  }
  for (const t of TRAYS) { // mẹt: flat bamboo trays on the ground with a little heap on each
    redB.add(cyl, m4.compose(V(toX(t.x), 0.06, toZ(t.y)), q.identity(), V(0.7, 0.05, 0.7)), new THREE.Color('#b08a55'));
    redB.add(new THREE.SphereGeometry(0.5, 8, 6), m4.compose(V(toX(t.x), 0.12, toZ(t.y)), q.identity(), V(0.5, 0.16, 0.5)), new THREE.Color(['#e9a23b', '#6aa84f', '#c0392b', '#f1c232'][t.k % 4]));
  }
  group.add(shadow(new THREE.Mesh(tarps.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }))));

  // ---------------- the đình ----------------
  group.add(dinh(PLACES.find((p) => p.kind === 'dinh'), woodB, redB));

  // ---------------- the well and the xe lam stop ----------------
  const well = PLACES.find((p) => p.kind === 'gieng');
  const wx = toX(well.x + well.w / 2);
  const wz = toZ((well.y0 + well.y1) / 2);
  concreteB.add(new THREE.CylinderGeometry(0.75, 0.8, 0.85, 20, 1, true), m4.compose(V(wx, 0.42, wz), q.identity(), V(1, 1, 1)));
  concreteB.add(new THREE.TorusGeometry(0.77, 0.08, 6, 20), m4.compose(V(wx, 0.85, wz), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2), V(1, 1, 1)));
  const dark = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), mat(0x0d1410, { roughness: 0.1 }));
  dark.rotation.x = -Math.PI / 2;
  dark.position.set(wx, 0.5, wz);
  group.add(dark);
  for (const dx of [-0.9, 0.9]) woodB.box(wx + dx - 0.05, 0, wz - 0.05, wx + dx + 0.05, 2.0, wz + 0.05, { faces: 'nsew' });
  woodB.add(cyl, m4.compose(V(wx, 1.7, wz), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2), V(0.1, 1.9, 0.1)));
  const bus = PLACES.find((p) => p.kind === 'benXe');
  const [bx0, bx1, bz0, bz1] = [toX(bus.x), toX(bus.x + bus.w), toZ(bus.y0), toZ(bus.y1)];
  for (const [x, z] of [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]]) darkB.box(x - 0.05, 0, z - 0.05, x + 0.05, 2.5, z + 0.05, { faces: 'nsew' });
  darkB.box(bx0 - 0.3, 2.5, bz0 - 0.3, bx1 + 0.3, 2.56, bz1 + 0.4);
  woodB.box(bx0 + 0.4, 0.42, bz0 + 0.2, bx1 - 0.4, 0.48, bz0 + 0.65);

  // ---------------- quán cóc, stools on the pavement, parked Cubs ----------------
  const stools = [];
  const parasols = new Builder();
  for (const quan of PLACES.filter((p) => p.kind === 'quanCoc')) {
    const x = toX(quan.cx);
    const z = toZ(quan.cy);
    woodB.box(x - 0.45, 0.32, z - 0.3, x + 0.45, 0.36, z + 0.3);
    for (const s of quan.spots) stools.push({ x: toX(s.x), y: 0, z: toZ(s.y), red: noise(s.x, s.y, 82) < 0.5 });
    darkB.add(cyl, m4.compose(V(x, 1.25, z), q.identity(), V(0.04, 2.5, 0.04)));
    const color = new THREE.Color(['#e63946', '#2d9cdb', '#f2b705', '#3f8f6b'][Math.floor(noise(quan.cx, 81) * 4)]);
    parasols.add(new THREE.ConeGeometry(1.5, 0.6, 16, 1, true), m4.compose(V(x, 2.55, z), q.identity(), V(1, 1, 1)), color);
    concreteB.add(cyl, m4.compose(V(x + 0.9, 0.15, z - 0.6), q.identity(), V(0.3, 0.3, 0.3))); // the honeycomb-coal stove
  }
  group.add(shadow(new THREE.Mesh(parasols.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }))));
  for (const c of STOOL_CLUSTERS) {
    woodB.box(toX(c.x) - 0.4, KERB + 0.3, toZ(c.y) - 0.25, toX(c.x) + 0.4, KERB + 0.34, toZ(c.y) + 0.25);
    for (const s of c.stools) stools.push({ x: toX(s.x), y: KERB, z: toZ(s.y), red: s.color === '#e63946' });
  }
  const stoolMesh = new THREE.InstancedMesh(stool(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }), stools.length);
  stools.forEach((s, k) => {
    stoolMesh.setMatrixAt(k, m4.makeTranslation(s.x, s.y, s.z));
    stoolMesh.setColorAt(k, new THREE.Color(s.red ? '#d62828' : '#1f78c8'));
  });
  group.add(shadow(stoolMesh));
  const bikes = new THREE.InstancedMesh(cub(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.3 }), BIKES.length);
  BIKES.forEach((b, k) => {
    q.setFromAxisAngle(V(0, 1, 0), (b.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (noise(b.x, 75) - 0.5) * 0.5);
    bikes.setMatrixAt(k, m4.compose(V(toX(b.x), KERB, toZ(b.y)), q, V(1, 1, 1)));
    bikes.setColorAt(k, new THREE.Color(b.color));
  });
  group.add(shadow(bikes));

  // ---------------- the phone booth, the banner, the gate, the flag ----------------
  const phone = PLACES.find((p) => p.kind === 'phone');
  if (phone) {
    const px = toX(phone.x + phone.w / 2);
    const pz = toZ(phone.front) - 0.6;
    redB.box(px - 0.5, KERB, pz - 0.5, px + 0.5, KERB + 2.3, pz + 0.5, { color: new THREE.Color('#f2b705') });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.22), new THREE.MeshStandardMaterial({ map: signTexture('Điện thoại', '#1f4e9c') }));
    s.position.set(px, KERB + 2.05, pz + 0.51);
    group.add(s);
  }
  const by = yOn(ROAD_LINE, BANNER_X) + ROAD_HALF + 4;
  for (const dx of [-42, 42]) woodB.add(cyl, m4.compose(V(toX(BANNER_X + dx), 2.2, toZ(by)), q.identity(), V(0.06, 4.4, 0.06)));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(84 * 0.15, 1.25), new THREE.MeshStandardMaterial({ map: signTexture('Xóm Peti đoàn kết, văn minh', '#da251d', '#ffde00'), side: THREE.DoubleSide, roughness: 0.8 }));
  cloth.position.set(toX(BANNER_X), 3.5, toZ(by));
  group.add(shadow(cloth));
  group.add(gate(woodB, redB));
  const flag = flagOn(PLACES.find((p) => p.kind === 'uyBan'), darkB);
  if (flag) group.add(flag.mesh);

  group.add(shadow(new THREE.Mesh(concreteB.build(), mat(0xa9a59c, { roughness: 0.9 }))));
  group.add(shadow(new THREE.Mesh(woodB.build(), mat(0x6b4a2e, { roughness: 0.85 }))));
  group.add(shadow(new THREE.Mesh(darkB.build(), mat(0x262626, { roughness: 0.6, metalness: 0.3 }))));
  group.add(shadow(new THREE.Mesh(redB.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }))));
  const bulbs = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb060, emissiveIntensity: 0 });
  group.add(new THREE.Mesh(bulbB.build(), bulbs));
  scene.add(group);

  return {
    group,
    setNight(dark) {
      for (const l of lamps) l.intensity = dark * 150;
      bulbs.emissiveIntensity = dark * 6;
    },
    tick(t) { if (flag) flag.wave(t); },
  };
}

/** The đình: a raised stone floor, red lacquered columns and a great tiled roof with its corners curling up. */
function dinh(p, woodB, paintB) {
  const g = new THREE.Group();
  const mid = toX(p.x + p.w / 2);
  const x0 = mid - 6.5; // a 13 m hall at the south end of its courtyard
  const x1 = mid + 6.5;
  const z1 = toZ(p.front) - 0.5;
  const z0 = z1 - 4.2;
  // plinth, lacquered columns and the back wall go into the painted builder (one mesh, one shadow draw)
  paintB.box(x0 - 0.6, 0, z0 - 1.0, x1 + 0.6, 0.6, z1 + 0.6, { color: new THREE.Color(0x8d877b) });
  const red = new THREE.Color(0x7a1e1a);
  const column = new THREE.CylinderGeometry(0.17, 0.19, 3.0, 12);
  for (let k = 0; k <= 6; k += 1) {
    for (const z of [z0 + 0.4, z1 - 0.6]) paintB.add(column, m4.makeTranslation(x0 + ((x1 - x0) * k) / 6, 2.1, z), red);
  }
  paintB.box(x0, 0.6, z0 + 0.025, x1, 3.6, z0 + 0.275, { color: new THREE.Color(0x9b5a40) });
  woodB.box(x0, 3.55, z0, x1, 3.75, z1, { faces: 'nsewt' }); // the beams under the roof
  // the roof: a hip roof whose four corners sweep up (đao cong)
  const b = new Builder();
  const ex = 1.1;
  const ez = 1.0;
  const [rx0, rx1, rz0, rz1] = [x0 - ex, x1 + ex, z0 - ez, z1 + ez];
  const yEave = 3.7;
  const yRidge = 6.2;
  const curl = 0.7;
  const ridge0 = V(x0 + 1.6, yRidge, (z0 + z1) / 2);
  const ridge1 = V(x1 - 1.6, yRidge, (z0 + z1) / 2);
  const c = { sw: V(rx0, yEave + curl, rz1), se: V(rx1, yEave + curl, rz1), ne: V(rx1, yEave + curl, rz0), nw: V(rx0, yEave + curl, rz0) };
  const ms = V((rx0 + rx1) / 2, yEave, rz1);
  const mn = V((rx0 + rx1) / 2, yEave, rz0);
  const W = (rx1 - rx0) / 3;
  b.quad(c.sw, ms, V(ridge0.x + (ridge1.x - ridge0.x) / 2, yRidge, ridge0.z), ridge0, [[0, 0], [W / 2, 0], [W / 2, 2], [0, 2]]);
  b.quad(ms, c.se, ridge1, V(ridge0.x + (ridge1.x - ridge0.x) / 2, yRidge, ridge0.z), [[W / 2, 0], [W, 0], [W, 2], [W / 2, 2]]);
  b.quad(c.ne, mn, V(ridge0.x + (ridge1.x - ridge0.x) / 2, yRidge, ridge0.z), ridge1, [[0, 0], [W / 2, 0], [W / 2, 2], [0, 2]]);
  b.quad(mn, c.nw, ridge0, V(ridge0.x + (ridge1.x - ridge0.x) / 2, yRidge, ridge0.z), [[W / 2, 0], [W, 0], [W, 2], [W / 2, 2]]);
  b.quad(c.se, c.ne, ridge1, ridge1, [[0, 0], [1.5, 0], [0.75, 2], [0.75, 2]]);
  b.quad(c.nw, c.sw, ridge0, ridge0, [[0, 0], [1.5, 0], [0.75, 2], [0.75, 2]]);
  const tiles = roofTiles();
  const roof = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.8, side: THREE.DoubleSide, color: 0x9a8070 }));
  g.add(shadow(roof));
  paintB.box(ridge0.x - 0.5, yRidge - 0.025, ridge0.z - 0.175, ridge1.x + 0.5, yRidge + 0.325, ridge0.z + 0.175, { faces: 'nsewtb', color: new THREE.Color(0x5a3a2a) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshStandardMaterial({ map: signTexture('Đình làng', '#7a1e1a', '#f2c94c') }));
  sign.position.set((x0 + x1) / 2, 3.3, z1 - 0.45);
  g.add(sign);
  return g;
}

/** The gate where the road enters the xóm: two pillars and a curved roof carrying the name. */
function gate(woodB, paintB) {
  const g = new THREE.Group();
  const y = yOn(ROAD_LINE, GATE_X);
  const zn = toZ(y - ROAD_HALF - 6);
  const zs = toZ(y + ROAD_HALF + 6);
  const x = toX(GATE_X);
  const stone = new THREE.Color(0xe3d6b8);
  for (const z of [zn, zs]) paintB.box(x - 0.3, 0, z - 0.3, x + 0.3, 5.4, z + 0.3, { color: stone });
  paintB.box(x - 0.25, 5.15, zn - 0.5, x + 0.25, 6.05, zs + 0.5, { faces: 'nsewtb', color: stone });
  woodB.box(x - 0.7, 6.05, zn - 1.0, x + 0.7, 6.2, zs + 1.0);
  const name = signTexture('Xóm Peti', '#f2e2b6', '#c1121f');
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(zs - zn - 1.5, 0.6), new THREE.MeshStandardMaterial({ map: name }));
    plate.position.set(x + side * 0.26, 5.6, (zn + zs) / 2);
    plate.rotation.y = side * Math.PI / 2;
    g.add(plate);
  }
  return g;
}

/** The red flag with the yellow star on a pole above the UBND, rippling (vertices moved on the CPU, it is small). */
function flagOn(p, darkB) {
  if (!p) return null;
  const x = toX(p.x + p.w / 2);
  const z = toZ(p.front - 16);
  const top = 3.4 + 3 * 3.2 + 4;
  darkB.add(cyl, m4.compose(V(x, top - 3, z), q.identity(), V(0.06, 6, 0.06)));
  const c = Object.assign(document.createElement('canvas'), { width: 300, height: 200 });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#da251d';
  ctx.fillRect(0, 0, 300, 200);
  ctx.fillStyle = '#ffde00';
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const r = k % 2 ? 26 : 64;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(150 + Math.cos(a) * r, 100 + Math.sin(a) * r);
  }
  ctx.fill();
  const geo = new THREE.PlaneGeometry(1.8, 1.2, 12, 6).translate(0.9, 0, 0);
  const base = geo.attributes.position.array.slice();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texture(c, { repeat: false }), side: THREE.DoubleSide, roughness: 0.8 }));
  mesh.position.set(x + 0.05, top - 0.7, z);
  mesh.castShadow = true;
  const wave = (t) => {
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k += 1) {
      const px = base[k * 3];
      pos.array[k * 3 + 2] = Math.sin(px * 3 - t * 4) * 0.12 * px;
    }
    pos.needsUpdate = true;
  };
  return { mesh, wave };
}
