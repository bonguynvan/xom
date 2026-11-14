// The houses of the 3D xóm. Every tube house, shop and public building on the map becomes a real building:
// lime-washed walls in its own colour, floors of louvred windows (some with chuồng cọp cages), balconies, and
// one of three roofs (clay tiles, corrugated iron, or a flat concrete roof with its water tank, a TV aerial
// and sometimes a stair hut). All walls of one colour share one merged mesh, so the whole xóm is a few dozen
// draw calls. Windows glow at night through emissive maps.
import * as THREE from '../vendor/three/three.module.min.js';
import { NODES, nodesNear } from '../map.js';
import { PLACES } from '../places.js';
import { noise } from '../rng.js';
import { FLOOR_H, HOUSE_DEPTH_EXTRA, M, footprint, toX, toZ } from './coords.js';
import { hasBalcony, shopOpening } from './detail-plan.js';
import { Builder } from './geom.js';
import { weathered } from './surface.js';
import { concrete, corrugated, embossed, facadeBay, groundBay, plaster, roofTiles, signTexture } from './textures.js';

export const OPEN_KINDS = new Set(['cayBang', 'cayPhuong', 'phone']);
const BAY = 4; // metres of facade per window bay (the texture's width)
const GROUND_H = 3.4;
const PARAPET = 0.7;
const SIGN_COLORS = { traDa: '#1f6f4a', suaXe: '#1f4e9c', tapHoa: '#c1121f', hieuAnh: '#5b2a86', pho: '#c1121f', catToc: '#1f4e9c',
  bangDia: '#111111', buuDien: '#e0a100', che: '#d1495b', hieuMay: '#2a5f5a', truong: '#1f4e9c', tramYTe: '#ffffff', uyBan: '#c1121f' };
const SIGN_TEXT = { truong: 'Trường tiểu học', tramYTe: 'Trạm y tế phường', uyBan: 'UBND phường' };
const NEON = new Set(['bangDia', 'hieuAnh', 'pho', 'che', 'catToc']); // shops with a lit sign after dark
const CIVIC_COLOR = { truong: '#f0cf6a', tramYTe: '#f1ece0', uyBan: '#e9c46a' };

/** How deep a house really is: it grows backwards over free ground, as tube houses do. */
function deepen(p, others) {
  const fp = footprint(p);
  const extra = HOUSE_DEPTH_EXTRA;
  const back = { ...fp, z0: fp.z0 - extra };
  const cx = p.x + p.w / 2;
  const behind = nodesNear({ x: cx, y: p.front - p.depth - extra / M / 2 }, p.w / 2 + extra / M).some((id) => {
    const n = NODES[id];
    return toX(n.x) > fp.x0 - 0.6 && toX(n.x) < fp.x1 + 0.6 && toZ(n.y) > back.z0 - 1.2 && toZ(n.y) < fp.z0;
  });
  if (behind) return fp;
  const hit = others.some((o) => o !== fp && o.x0 < back.x1 && back.x0 < o.x1 && o.z0 < fp.z0 && back.z0 < o.z1);
  return hit ? fp : back;
}

const pick = (p, salt, n) => Math.floor(noise(p.x, p.front, salt) * n);

export function buildBuildings(scene, { anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const places = PLACES.filter((p) => p.building && !OPEN_KINDS.has(p.kind));
  const raw = places.map((p) => footprint(p));
  // each box also says how tall it stands (h, to the ridge): the camera's swept sphere passes over lower roofs
  const boxes = places.map((p, k) => {
    const box = p.kind === 'house' ? deepen(p, raw.filter((_, j) => j !== k)) : raw[k];
    const floors = Math.max(1, p.floors ?? 2);
    // what detail3d.js and the sound need to know about the building, kept on its box: kind, floors, the open shop front
    return { ...box, h: GROUND_H + (floors - 1) * FLOOR_H + 1.6, kind: p.kind, floors, px: p.x, shop: p.kind !== 'house' && !p.civic ? shopOpening(box) : null };
  });

  const palette = new Map(); // colour -> builders and materials for that colour
  const plasterTex = plaster();
  const plasterBumps = embossed(new THREE.MeshStandardMaterial({ map: plasterTex }), 1.2); // one set of bumps for every wall colour
  const sheet = (color) => {
    if (palette.has(color)) return palette.get(color);
    const v = palette.size;
    const upper = facadeBay(color, v);
    const lower = groundBay(color, v);
    const bumps = (map) => { const m = embossed(new THREE.MeshStandardMaterial({ map }), 1.6); return m.normalMap ? { normalMap: m.normalMap, roughnessMap: m.roughnessMap } : {}; };
    const upperBumps = bumps(upper.map);
    const lowerBumps = bumps(lower.map);
    const entry = {
      walls: new Builder(), upper: [new Builder(), new Builder()], lower: new Builder(),
      wallMat: weathered(new THREE.MeshStandardMaterial({ map: plasterTex, normalMap: plasterBumps.normalMap, roughnessMap: plasterBumps.roughnessMap, color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.15), roughness: 0.92, side: THREE.DoubleSide }), 'wall'),
      upperMat: [0, 1].map(() => weathered(new THREE.MeshStandardMaterial({ map: upper.map, emissiveMap: upper.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85, ...upperBumps }), 'roof')),
      lowerMat: weathered(new THREE.MeshStandardMaterial({ map: lower.map, emissiveMap: lower.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85, ...lowerBumps }), 'wall'),
    };
    palette.set(color, entry);
    return entry;
  };
  const tile = new Builder();
  const tin = new Builder();
  const slab = new Builder();
  const iron = new Builder();
  const tanks = new Builder();
  const signs = [];
  const room = new Builder(); // the insides of the open shops, all one mesh
  const WALL_TINT = new THREE.Color(0xd8ccb0);
  const FLOOR_TINT = new THREE.Color(0x8a8378);
  const tvs = [new Builder(), new Builder(), new Builder()]; // three sets of windows, each flickering to its own programme

  places.forEach((p, k) => {
    const box = boxes[k];
    const civic = Boolean(p.civic);
    const color = CIVIC_COLOR[p.kind] ?? p.color ?? ['#f0cf6a', '#e9c46a', '#efe3c2', '#e8b4a0'][pick(p, 1, 4)];
    const s = sheet(color);
    const floors = Math.max(1, p.floors ?? 2);
    const top = GROUND_H + (floors - 1) * FLOOR_H;
    const { x0, x1, z0, z1 } = box;
    const w = x1 - x0;
    const bays = Math.max(1, Math.round(w / BAY));
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // the street front: ground floor, then the upper floors (lit or dark at night, by house)
    const o = box.shop;
    if (o) { // a shop: its front stands open on a real room (piers, a lintel, floor, walls, ceiling); detail3d.js furnishes it
      const T = 4; // metres per repeat of the plaster
      const front = (xa, xb, ya, yb) => s.walls.quad(V(xa, ya, z1), V(xb, ya, z1), V(xb, yb, z1), V(xa, yb, z1), [[xa / T, ya / T], [xb / T, ya / T], [xb / T, yb / T], [xa / T, yb / T]]);
      front(x0, o.x0, 0, GROUND_H);
      front(o.x1, x1, 0, GROUND_H);
      front(o.x0, o.x1, o.top, GROUND_H);
      const u = (a, b2) => [[0, 0], [a / 3, 0], [a / 3, b2 / 3], [0, b2 / 3]];
      const [rw, rd] = [o.x1 - o.x0, o.front - o.back];
      room.quad(V(o.x0, 0.03, o.front), V(o.x1, 0.03, o.front), V(o.x1, 0.03, o.back), V(o.x0, 0.03, o.back), u(rw, rd), FLOOR_TINT);
      room.quad(V(o.x0, 0, o.back), V(o.x1, 0, o.back), V(o.x1, o.top, o.back), V(o.x0, o.top, o.back), u(rw, o.top), WALL_TINT);
      room.quad(V(o.x0, 0, o.front), V(o.x0, 0, o.back), V(o.x0, o.top, o.back), V(o.x0, o.top, o.front), u(rd, o.top), WALL_TINT);
      room.quad(V(o.x1, 0, o.back), V(o.x1, 0, o.front), V(o.x1, o.top, o.front), V(o.x1, o.top, o.back), u(rd, o.top), WALL_TINT);
      room.quad(V(o.x0, o.top, o.back), V(o.x1, o.top, o.back), V(o.x1, o.top, o.front), V(o.x0, o.top, o.front), u(rw, rd), WALL_TINT);
    } else s.lower.quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, GROUND_H, z1), V(x0, GROUND_H, z1), [[0, 0], [bays, 0], [bays, 1], [0, 1]]);
    if (floors > 1) {
      const lit = noise(p.x, p.front, 5) < 0.6 ? 0 : 1;
      s.upper[lit].quad(V(x0, GROUND_H, z1), V(x1, GROUND_H, z1), V(x1, top, z1), V(x0, top, z1), [[0, 0], [bays, 0], [bays, floors - 1], [0, floors - 1]]);
    }
    const roof = p.roof ?? (p.kind === 'house' ? ['flat', 'flat', 'tile', 'tile', 'tin'][pick(p, 6, 5)] : civic ? 'tile' : ['flat', 'tile'][pick(p, 6, 2)]);
    box.roof = roof; // (the box was made a few lines up, in this function: the roof kind is part of making it)
    const wallTop = roof === 'flat' ? top + PARAPET : top;
    s.walls.box(x0, 0, z0, x1, wallTop, z1, { faces: 'new', tile: [4, 4] });
    if (roof === 'flat') {
      slab.box(x0 + 0.15, top, z0 + 0.15, x1 - 0.15, top + 0.05, z1 - 0.15, { faces: 't', tile: [5, 5] });
      s.walls.box(x0, top, z1 - 0.15, x1, top + PARAPET, z1, { faces: 'st', tile: [4, 4] }); // the parapet over the street
      if (noise(p.x, 7) < 0.75) { // the brick water tank on the roof
        const tx = x0 + 0.4 + noise(p.x, 8) * Math.max(0.1, w - 2);
        tanks.box(tx, top, z0 + 0.5, tx + 1.3, top + 1.1, z0 + 1.6, { tile: [2, 2] });
      }
      if (noise(p.x, 9) < 0.35 && w > 4.5) { // a stair hut with its own little tile roof
        const hx = x1 - 2.4;
        s.walls.box(hx, top, z0 + 0.3, x1 - 0.3, top + 2.4, z0 + 2.6, { tile: [4, 4] });
        tileRoof(tile, hx - 0.15, x1 - 0.15, z0 + 0.15, z0 + 2.75, top + 2.4, 0.7);
      }
      aerial(iron, x0 + w * (0.3 + noise(p.x, 10) * 0.4), top, z0 + 1.2 + noise(p.x, 11));
    } else if (roof === 'tile') {
      tileRoof(tile, x0 - 0.25, x1 + 0.25, z0 - 0.3, z1 + 0.45, top, Math.min(2.2, (z1 - z0) * 0.32));
      gables(s.walls, x0, x1, z0, z1, top, Math.min(2.2, (z1 - z0) * 0.32));
    } else {
      shedRoof(tin, x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.5, top + 0.9, top + 0.2);
    }
    if (p.kind === 'house' && floors > 1 && noise(p.x, p.front, 14) < 0.16) { // somebody is watching television behind this window
      const bay = w / bays;
      const bx = x0 + Math.floor(noise(p.x, 15) * bays) * bay;
      const [tx0, tx1] = [bx + bay * 0.33, bx + bay * 0.67];
      tvs[k % tvs.length].quad(V(tx0, GROUND_H + 0.95, z1 + 0.02), V(tx1, GROUND_H + 0.95, z1 + 0.02), V(tx1, GROUND_H + 2.3, z1 + 0.02), V(tx0, GROUND_H + 2.3, z1 + 0.02));
    }
    // balconies with iron railings on the upper floors of some houses (never on shops' first floor sign)
    if (p.kind === 'house' && floors > 1) {
      for (let f = 1; f < floors; f += 1) {
        if (!hasBalcony(p.x, f)) continue;
        const y = GROUND_H + (f - 1) * FLOOR_H;
        slab.box(x0 + 0.2, y - 0.12, z1, x1 - 0.2, y, z1 + 0.85, { faces: 'nsewtb', tile: [3, 3] });
        railing(iron, x0 + 0.25, x1 - 0.25, z1 + 0.82, y, 1.0);
      }
    }
    if (p.kind !== 'house') {
      const text = SIGN_TEXT[p.kind] ?? p.name;
      signs.push({ text, color: SIGN_COLORS[p.kind] ?? '#c1121f', x0, x1, z1, y: GROUND_H - 0.1, civic, neon: NEON.has(p.kind) });
      if (p.kind !== 'house' && !civic) awning(tin, x0, x1, z1, GROUND_H - 0.9, p.kind);
    }
  });

  // The houses are drawn as dozens of meshes (one per colour and part) but their shadow is cast by one plain
  // copy of all their walls and roofs: each shadow map draws the whole xóm's houses in a single call.
  const caster = new Builder();
  const shadowed = (mesh) => { mesh.castShadow = false; mesh.receiveShadow = true; return mesh; };
  const windows = [];
  for (const s of palette.values()) {
    caster.merge(s.walls).merge(s.lower);
    for (const b of s.upper) caster.merge(b);
    group.add(shadowed(new THREE.Mesh(s.walls.build(), s.wallMat)));
    if (!s.lower.empty) group.add(shadowed(new THREE.Mesh(s.lower.build(), s.lowerMat)));
    s.upper.forEach((b, lit) => { if (!b.empty) group.add(shadowed(new THREE.Mesh(b.build(), s.upperMat[lit]))); });
    windows.push({ lower: s.lowerMat, upper: s.upperMat });
  }
  const tileTex = roofTiles();
  const tinTex = corrugated();
  const slabTex = concrete('#9a958b', 21);
  for (const t of [tileTex, tinTex, slabTex]) t.anisotropy = anisotropy;
  group.add(shadowed(new THREE.Mesh(tile.build(), weathered(embossed(new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.8 }), 2.6), 'roof'))));
  group.add(shadowed(new THREE.Mesh(tin.build(), weathered(embossed(new THREE.MeshStandardMaterial({ map: tinTex, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }), 2.4), 'roof'))));
  group.add(shadowed(new THREE.Mesh(slab.build(), weathered(embossed(new THREE.MeshStandardMaterial({ map: slabTex, roughness: 0.9 }), 1.2), 'roof'))));
  group.add(shadowed(new THREE.Mesh(tanks.build(), new THREE.MeshStandardMaterial({ map: concrete('#8d8478', 31), roughness: 0.95 }))));
  group.add(shadowed(new THREE.Mesh(iron.build(), new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 0.6, metalness: 0.6 }))));
  const roomMat = new THREE.MeshStandardMaterial({ map: plasterTex, vertexColors: true, roughness: 0.9, emissive: 0xffb866, emissiveIntensity: 0 });
  if (!room.empty) { const mesh = new THREE.Mesh(room.build(), roomMat); mesh.receiveShadow = true; group.add(mesh); }
  const neon = [];
  for (const sg of signs) { const mesh = sign(sg); group.add(mesh); if (sg.neon) neon.push(mesh.material); }
  const glows = tvs.filter((b) => !b.empty).map((b) => {
    const mesh = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  for (const b of [tile, tin, slab, tanks]) caster.merge(b);
  const shade = new THREE.Mesh(caster.build(), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  shade.name = 'house-shadows';
  shade.castShadow = true;
  group.add(shade);

  scene.add(group);
  /** Night (dark 0..1, t seconds): tungsten behind some windows, the blue flicker of a television behind others, neon signs that stutter. */
  const setNight = (dark, t = 0) => {
    for (const w of windows) {
      w.lower.emissiveIntensity = dark * 0.4;
      w.upper[0].emissiveIntensity = dark * 0.05;
      w.upper[1].emissiveIntensity = dark * 1.7;
    }
    roomMat.emissiveIntensity = dark * 0.5; // the shops keep a light on
    neon.forEach((m, k) => { // a tube that drops out for a moment now and then
      const out = Math.sin(t * 9.1 + k * 5.3) * Math.sin(t * 2.3 + k * 1.7) > 0.8;
      m.emissiveIntensity = dark * (out ? 0.25 : 1.5 + 0.12 * Math.sin(t * 50 + k));
    });
    glows.forEach((mesh, k) => { // the picture changes: steps of brightness, not a smooth wave
      mesh.visible = dark > 0.3;
      const step = Math.floor(t * (2.2 + k * 0.7) + k * 3);
      mesh.material.opacity = dark * (0.35 + 0.5 * noise(step, k, 16));
    });
  };
  return { group, boxes, setNight };
}

/** A gable roof of clay tiles, the ridge running along the street. */
function tileRoof(b, x0, x1, z0, z1, y, rise) {
  const V = (x, yy, z) => new THREE.Vector3(x, yy, z);
  const mid = (z0 + z1) / 2;
  const slope = Math.hypot(rise, (z1 - z0) / 2);
  const w = x1 - x0;
  b.quad(V(x0, y, z1), V(x1, y, z1), V(x1, y + rise, mid), V(x0, y + rise, mid), [[0, 0], [w / 2, 0], [w / 2, slope / 2], [0, slope / 2]]);
  b.quad(V(x1, y, z0), V(x0, y, z0), V(x0, y + rise, mid), V(x1, y + rise, mid), [[0, 0], [w / 2, 0], [w / 2, slope / 2], [0, slope / 2]]);
}

/** The triangular wall ends under a gable roof. */
function gables(b, x0, x1, z0, z1, y, rise) {
  const mid = (z0 + z1) / 2;
  for (const [x, flip] of [[x0, true], [x1, false]]) {
    const a = new THREE.Vector3(x, y, flip ? z0 : z1);
    const c = new THREE.Vector3(x, y, flip ? z1 : z0);
    const t = new THREE.Vector3(x, y + rise, mid);
    b.quad(a, c, t, t, [[0, 0], [1, 0], [0.5, 0.4], [0.5, 0.4]]);
  }
}

/** A lean-to of corrugated iron, high at the back and dripping towards the street. */
function shedRoof(b, x0, x1, z0, z1, yBack, yFront) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const len = Math.hypot(z1 - z0, yBack - yFront);
  b.quad(V(x0, yFront, z1), V(x1, yFront, z1), V(x1, yBack, z0), V(x0, yBack, z0), [[0, 0], [(x1 - x0) / 3, 0], [(x1 - x0) / 3, len / 3], [0, len / 3]]);
}

/** A shop's tin or canvas awning over the pavement. */
function awning(b, x0, x1, z1, y, kind) {
  if (!['traDa', 'pho', 'che', 'tapHoa', 'suaXe', 'catToc'].includes(kind)) return;
  shedRoof(b, x0 + 0.1, x1 - 0.1, z1, z1 + 1.6, y + 0.5, y);
}

/** A wrought-iron railing: top rail, bottom rail and balusters, all merged into the iron mesh. */
function railing(b, x0, x1, z, y, h) {
  b.box(x0, y + h - 0.04, z - 0.03, x1, y + h, z + 0.03, { tile: [1, 1] });
  b.box(x0, y + 0.08, z - 0.02, x1, y + 0.11, z + 0.02, { tile: [1, 1] });
  for (let x = x0; x <= x1; x += 0.14) b.box(x, y, z - 0.012, x + 0.024, y + h, z + 0.012, { faces: 'nsew', tile: [1, 1] });
}

/** The TV aerial every 90s roof had: a mast and a few cross bars. */
function aerial(b, x, y, z) {
  b.box(x - 0.02, y, z - 0.02, x + 0.02, y + 3.2, z + 0.02, { faces: 'nsew' });
  for (let k = 0; k < 4; k += 1) {
    const h = y + 2.2 + k * 0.28;
    const half = 0.65 - k * 0.12;
    b.box(x - half, h, z - 0.012, x + half, h + 0.025, z + 0.012, { faces: 'nsewt' });
  }
}

function sign({ text, color, x0, x1, z1, y, civic, neon }) {
  const fg = color === '#ffffff' ? '#c1121f' : color === '#e0a100' ? '#1d1a2f' : '#fff6e5';
  const w = Math.min(x1 - x0 - 0.3, civic ? 7 : 6);
  const map = signTexture(text, color, fg);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.156), new THREE.MeshStandardMaterial({ map, roughness: 0.6, ...(neon ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0 } : { emissive: 0x000000 }) }));
  mesh.position.set((x0 + x1) / 2, y - 0.1, z1 + 0.06);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
