// The ground of the 3D xóm: earth and grass, the asphalt main road with raised lá-nem pavements and kerbs,
// cement alleys, zebra crossings, the metre-gauge railway on its ballast, the pond (a real reflecting water
// surface with lotus leaves) and rice paddies running off to the horizon.
import * as THREE from '../vendor/three/three.module.min.js';
import { CROSSING_X, MAP, RAIL_Y, ROAD_HALF, ROAD_LINE, WAYS, ZEBRAS, yOn } from '../map.js';
import { PLACES } from '../places.js';
import { noise } from '../rng.js';
import { M, toX, toZ } from './coords.js';
import { Builder, ribbon } from './geom.js';
import { PAVE_OUT } from './sound-plan.js'; // the pavement runs from the kerb (ROAD_HALF) out to here, in map units
import { weathered } from './surface.js';
import { asphalt, ballast, concrete, embossed, groundMap, paddy, redTiles } from './textures.js';

export const KERB = 0.14; // the pavement stands this high above the road
const ALLEY_HALF = 7;

/** Height of the surface someone stands on at a map point: up on the pavement, else the ground. */
export function surfaceY(x, y) {
  const d = Math.abs(y - yOn(ROAD_LINE, x));
  return d > ROAD_HALF && d < PAVE_OUT ? KERB : 0.02;
}

/** A standard material whose colour map is multiplied by a tiling detail photo (close-up grass and grit). */
function detailed(params, detail, repeat) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detail };
    shader.uniforms.detailRepeat = { value: repeat };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detailMap;\nuniform float detailRepeat;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n  diffuseColor.rgb *= texture2D(detailMap, vMapUv * detailRepeat).rgb * 1.9;\n#endif');
  };
  return m;
}

const flat = (mesh) => { mesh.receiveShadow = true; return mesh; };
/** Surfaces laid on the ground: drawn in order, never fighting the ground (or each other) for depth. */
function overlay(material, order) {
  Object.assign(material, { polygonOffset: true, polygonOffsetFactor: -1 - order, polygonOffsetUnits: -4 * (order + 1) });
  return material;
}

export function buildTerrain(scene, { grass, waterNormals }) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // ---------------- the ground of the map, then paddies beyond ----------------
  const ground = flat(new THREE.Mesh(new THREE.PlaneGeometry(MAP.w * M, MAP.h * M), weathered(detailed({ map: groundMap(), roughness: 0.95 }, grass, 34), 'earth')));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(toX(MAP.w / 2), 0, toZ(MAP.h / 2));
  ground.name = 'ground';
  group.add(ground);

  const paddyTex = paddy();
  paddyTex.repeat.set(60, 60);
  const fields = flat(new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: paddyTex, roughness: 0.75, metalness: 0.0 })));
  fields.rotation.x = -Math.PI / 2;
  fields.position.y = -0.04;
  group.add(fields);

  // ---------------- the main road, kerbs and pavements ----------------
  const road = flat(new THREE.Mesh(ribbon(ROAD_LINE, { from: -ROAD_HALF, to: ROAD_HALF, y: 0.02, tileV: 12 }).build(),
    overlay(weathered(embossed(new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.86 }), 1.1), 'ground'), 1)));
  road.name = 'road';
  group.add(road);

  const tiles = redTiles(34);
  const paveMat = weathered(embossed(new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.8 }), 2.2), 'ground');
  const paveW = (PAVE_OUT - ROAD_HALF) * M;
  for (const [from, to] of [[ROAD_HALF, PAVE_OUT], [-PAVE_OUT, -ROAD_HALF]]) {
    group.add(flat(new THREE.Mesh(ribbon(ROAD_LINE, { from, to, y: KERB, tileV: paveW }).build(), paveMat)));
  }
  const kerb = new Builder();
  const kerbLine = (off) => ROAD_LINE.map((p, k) => {
    const a = ROAD_LINE[Math.max(0, k - 1)];
    const b = ROAD_LINE[Math.min(ROAD_LINE.length - 1, k + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return new THREE.Vector3(toX(p.x - ((b.y - a.y) / len) * off), 0, toZ(p.y + ((b.x - a.x) / len) * off));
  });
  for (const off of [ROAD_HALF, -ROAD_HALF]) {
    const pts = kerbLine(off);
    for (let k = 1; k < pts.length; k += 1) {
      const [a, b] = off > 0 ? [pts[k - 1], pts[k]] : [pts[k], pts[k - 1]];
      const lift = (p, y) => new THREE.Vector3(p.x, y, p.z);
      kerb.quad(lift(b, 0), lift(a, 0), lift(a, KERB), lift(b, KERB), [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
    }
  }
  group.add(flat(new THREE.Mesh(kerb.build(), weathered(new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.9, side: THREE.DoubleSide }), 'roof'))));

  // zebra crossings, painted across the road
  const zebra = new Builder();
  for (const x of ZEBRAS) {
    for (let s = -ROAD_HALF + 3; s < ROAD_HALF - 2; s += 4.4) {
      const y = yOn(ROAD_LINE, x) + s;
      const V = (dx, dy) => new THREE.Vector3(toX(x + dx), 0.03, toZ(y + dy));
      zebra.quad(V(-6, 1.3), V(6, 1.3), V(6, -1.3), V(-6, -1.3));
    }
  }
  group.add(flat(new THREE.Mesh(zebra.build(), overlay(weathered(new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.6 }), 'ground'), 3))));

  // ---------------- alleys ----------------
  const alleys = new Builder();
  for (const way of WAYS.filter((w) => w.kind === 'alley')) {
    alleys.merge(ribbon(way.line, { from: -ALLEY_HALF, to: ALLEY_HALF, y: 0.025, tileV: ALLEY_HALF * 2 * M }));
  }
  const alleyMat = overlay(weathered(embossed(new THREE.MeshStandardMaterial({ map: concrete('#9d978a', 3), roughness: 0.92 }), 1.3), 'ground'), 0);
  alleyMat.depthWrite = false;
  const alleyMesh = flat(new THREE.Mesh(alleys.build(), alleyMat));
  alleyMesh.renderOrder = 1;
  group.add(alleyMesh);

  // the market floor and the đình courtyard: cement and lá nem tiles
  for (const p of PLACES.filter((q) => q.kind === 'cho' || q.kind === 'dinh')) {
    const w = p.w * M;
    const d = (p.y1 - p.y0) * M;
    const tex = p.kind === 'cho' ? concrete('#8f8a80', 9) : redTiles(26);
    tex.repeat.set(w / (p.kind === 'cho' ? 6 : 3), d / (p.kind === 'cho' ? 6 : 3));
    const mat = overlay(weathered(embossed(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), p.kind === 'cho' ? 1.3 : 2.2), 'ground'), 2);
    const floor = flat(new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(toX(p.x + p.w / 2), 0.03, toZ((p.y0 + p.y1) / 2));
    group.add(floor);
  }

  // ---------------- the railway: ballast, concrete sleepers, metre-gauge rails ----------------
  const rail = buildRailway();
  group.add(rail.group);

  // ---------------- the pond ----------------
  const pond = PLACES.find((p) => p.pond).pond;
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, pond.rx * M, pond.ry * M, 0, Math.PI * 2, false, 0);
  // muddy village pond water: dark, glossy, rippled; it mirrors the sky through the scene's environment map
  waterNormals.repeat.set(4, 4);
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), new THREE.MeshStandardMaterial({
    color: 0x24301c, roughness: 0.06, metalness: 0.1, normalMap: waterNormals, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(toX(pond.cx), 0.05, toZ(pond.cy));
  water.receiveShadow = true;
  water.userData.tick = (t) => { waterNormals.offset.set(Math.sin(t * 0.05) * 0.3, t * 0.02); };
  group.add(water);
  const bank = new THREE.Shape();
  bank.absellipse(0, 0, pond.rx * M * 1.06, pond.ry * M * 1.08, 0, Math.PI * 2, false, 0);
  bank.holes.push(new THREE.Path().absellipse(0, 0, pond.rx * M * 0.995, pond.ry * M * 0.995, 0, Math.PI * 2, true, 0));
  const mud = flat(new THREE.Mesh(new THREE.ShapeGeometry(bank, 64), overlay(new THREE.MeshStandardMaterial({ color: 0x4c4130, roughness: 0.55 }), 2)));
  mud.rotation.x = -Math.PI / 2;
  mud.position.set(toX(pond.cx), 0.04, toZ(pond.cy));
  group.add(mud);
  group.add(lotus(pond));

  scene.add(group);
  return { group, water, barrier: rail.barrier, ground };
}

function buildRailway() {
  const group = new THREE.Group();
  const z = toZ(RAIL_Y);
  const x0 = toX(-400);
  const x1 = toX(MAP.w + 400);
  const bed = new Builder();
  const V = (x, y, zz) => new THREE.Vector3(x, y, zz);
  const top = 0.32;
  bed.quad(V(x0, top, z + 1.5), V(x1, top, z + 1.5), V(x1, top, z - 1.5), V(x0, top, z - 1.5), [[0, 0], [x1 - x0, 0], [x1 - x0, 3], [0, 3]]);
  bed.quad(V(x0, 0, z + 2.3), V(x1, 0, z + 2.3), V(x1, top, z + 1.5), V(x0, top, z + 1.5), [[0, 0], [x1 - x0, 0], [x1 - x0, 1], [0, 1]]);
  bed.quad(V(x1, 0, z - 2.3), V(x0, 0, z - 2.3), V(x0, top, z - 1.5), V(x1, top, z - 1.5), [[0, 0], [x1 - x0, 0], [x1 - x0, 1], [0, 1]]);
  const stone = ballast();
  stone.repeat.set(0.8, 0.8);
  group.add(flat(new THREE.Mesh(bed.build(), embossed(new THREE.MeshStandardMaterial({ map: stone, roughness: 1 }), 2.5))));

  const count = Math.floor((x1 - x0) / 0.62);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.14, 1.9), new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 0.9 }), count);
  const m = new THREE.Matrix4();
  for (let k = 0; k < count; k += 1) {
    m.makeTranslation(x0 + k * 0.62, top + 0.05, z + (noise(k, 401) - 0.5) * 0.04);
    sleepers.setMatrixAt(k, m);
  }
  sleepers.receiveShadow = true;
  sleepers.castShadow = true;
  group.add(sleepers);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c8a86, metalness: 0.85, roughness: 0.35 });
  for (const side of [-0.5, 0.5]) { // 1 000 mm gauge, as on the Thống Nhất line
    const railBar = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.14, 0.07), steel);
    railBar.position.set((x0 + x1) / 2, top + 0.19, z + side);
    railBar.castShadow = true;
    group.add(railBar);
  }

  // the level crossing: a striped barrier arm that drops when the train comes
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.6 }));
  const px = toX(CROSSING_X + 20);
  post.position.set(px, 0.55, z + 3.2);
  post.castShadow = true;
  group.add(post);
  const stripes = document.createElement('canvas');
  stripes.width = 256;
  stripes.height = 16;
  const sctx = stripes.getContext('2d');
  for (let k = 0; k < 8; k += 1) { sctx.fillStyle = k % 2 ? '#f4f1ea' : '#c1121f'; sctx.fillRect(k * 32, 0, 32, 16); }
  const armTex = new THREE.CanvasTexture(stripes);
  armTex.colorSpace = THREE.SRGBColorSpace;
  const pivot = new THREE.Group();
  pivot.position.set(px, 1.05, z + 3.2);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.1), new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.5 }));
  arm.position.x = -2.1;
  arm.castShadow = true;
  pivot.add(arm);
  group.add(pivot);
  return { group, barrier: pivot };
}

/** Lotus pads and a few pink flowers, floating near the banks of the pond. */
function lotus(pond) {
  const pads = 70;
  const geo = new THREE.CircleGeometry(0.35, 12, 0.3, Math.PI * 2 - 0.3);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x3f6a2c, roughness: 0.6, side: THREE.DoubleSide }), pads);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let k = 0; k < pads; k += 1) {
    const a = noise(k, 411) * Math.PI * 2;
    const r = 0.62 + noise(k, 412) * 0.33;
    if (Math.cos(a) > 0.4 && noise(k, 413) < 0.7) { m.makeScale(0, 0, 0); mesh.setMatrixAt(k, m); continue; } // keep open water to the east for the swimmers
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), noise(k, 414) * 6.3);
    const s = 0.7 + noise(k, 415) * 0.8;
    m.compose(new THREE.Vector3(toX(pond.cx + Math.cos(a) * pond.rx * r), 0.07, toZ(pond.cy + Math.sin(a) * pond.ry * r)), q, new THREE.Vector3(s, 1, s));
    mesh.setMatrixAt(k, m);
  }
  mesh.receiveShadow = true;
  return mesh;
}
