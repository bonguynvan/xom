// The trees of the xóm: the banyan behind the đình, the bàng with its tiers of big leaves, the flame tree
// (phượng) red in summer, bamboo clumps along the pond and the paddies, banana plants in every gap, guava and
// star-fruit by the houses, and grass tufts. Canopies are clouds of leaf cards, all of one kind in a single
// instanced mesh, swaying a little in the wind (a vertex shader nudge, no CPU cost).
import * as THREE from '../vendor/three/three.module.min.js';
import { groundIsFree } from '../greenery.js';
import { MAP } from '../map.js';
import { PLACES, TREES } from '../places.js';
import { noise } from '../rng.js';
import { HEDGE } from '../street-life.js';
import { toX, toZ } from './coords.js';
import { Builder } from './geom.js';
import { leafCard, texture } from './textures.js';

const wind = { value: 0 };

/** Leaves that sway: each card moves with the wind, more at its tips. */
function swaying(material, amount = 0.06) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = wind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float windTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
  transformed.x += sin(windTime * 1.6 + phase) * ${amount.toFixed(3)} * (0.5 + position.y);
  transformed.z += cos(windTime * 1.3 + phase * 1.7) * ${(amount * 0.7).toFixed(3)} * (0.5 + position.y);
#endif`);
  };
  return material;
}

function bark() {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 256 });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5b4a3a';
  ctx.fillRect(0, 0, 128, 256);
  for (let k = 0; k < 220; k += 1) {
    ctx.fillStyle = `rgba(${noise(k, 501) < 0.5 ? '30,24,18' : '150,135,115'},${0.15 + noise(k, 502) * 0.25})`;
    ctx.fillRect(noise(k, 503) * 128, noise(k, 504) * 256, 2 + noise(k, 505) * 5, 20 + noise(k, 506) * 80);
  }
  return texture(c);
}

function bananaLeaf() {
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 256 });
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#3f6b22');
  g.addColorStop(0.5, '#6f9a35');
  g.addColorStop(1, '#3f6b22');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.quadraticCurveTo(66, 60, 56, 250);
  ctx.lineTo(8, 250);
  ctx.quadraticCurveTo(-2, 60, 32, 0);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out'; // the wind tears banana leaves into strips
  for (let k = 0; k < 9; k += 1) {
    const y = 40 + noise(k, 511) * 200;
    ctx.fillRect(noise(k, 512) < 0.5 ? 0 : 40, y, 26, 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#c9d28a';
  ctx.fillRect(30, 0, 4, 250);
  return texture(c, { repeat: false });
}

const KINDS = {
  da: { trunk: [0.7, 4.2], canopy: [7, 7.5, 3.8], cards: 260, card: 2.6, hue: 105 },
  bang: { trunk: [0.35, 3.6], canopy: [4.6, 5.6, 2.2], cards: 120, card: 2.2, hue: 95, tiers: true },
  phuong: { trunk: [0.4, 3.4], canopy: [5.2, 5.8, 2.0], cards: 140, card: 2.2, hue: 90, flowers: 0.45 },
  oi: { trunk: [0.12, 1.3], canopy: [1.6, 2.4, 1.2], cards: 26, card: 1.1, hue: 88 },
  khe: { trunk: [0.12, 1.4], canopy: [1.7, 2.6, 1.3], cards: 28, card: 1.1, hue: 100 },
};

export function buildTrees(scene) {
  const group = new THREE.Group();
  group.name = 'trees';
  const trunks = new Builder();
  const cards = { leaf: [], flower: [], banana: [], bamboo: [], grass: [] };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const card = (list, pos, size, salt) => {
    q.setFromEuler(new THREE.Euler((noise(salt, 521) - 0.5) * 1.2, noise(salt, 522) * Math.PI * 2, (noise(salt, 523) - 0.5) * 1.2));
    list.push(new THREE.Matrix4().compose(pos, q.clone(), new THREE.Vector3(size, size, size)));
  };
  const cylinder = new THREE.CylinderGeometry(0.7, 1, 1, 9, 1, true);

  const leafy = (x, z, kind, salt) => {
    const k = KINDS[kind];
    const s = 0.85 + noise(salt, 531) * 0.3;
    const [r, h] = [k.trunk[0] * s, k.trunk[1] * s];
    trunks.add(cylinder, m.compose(new THREE.Vector3(x, h / 2, z), q.identity(), new THREE.Vector3(r, h * 1.1, r)));
    if (kind === 'da') { // the banyan's aerial roots and buttresses
      for (let a = 0; a < 14; a += 1) {
        const ang = (a / 14) * Math.PI * 2;
        const d = 1.2 + noise(a, salt, 532) * 3;
        trunks.add(cylinder, m.compose(new THREE.Vector3(x + Math.cos(ang) * d, 2.5, z + Math.sin(ang) * d), q.identity(), new THREE.Vector3(0.06, 5, 0.06)));
      }
    }
    const [radius, height, thick] = k.canopy.map((v) => v * s);
    for (let c = 0; c < k.cards; c += 1) {
      const a = noise(c, salt, 541) * Math.PI * 2;
      const rr = Math.sqrt(noise(c, salt, 542)) * radius;
      const tier = k.tiers ? Math.floor(noise(c, salt, 543) * 3) * thick * 0.55 : (noise(c, salt, 543) - 0.5) * thick * 1.3;
      const yy = height + tier - (rr / radius) ** 2 * thick * 0.6;
      const flower = k.flowers && noise(c, salt, 544) < k.flowers;
      card(flower ? cards.flower : cards.leaf, new THREE.Vector3(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr), k.card * (0.75 + noise(c, salt, 545) * 0.5), c * 31 + salt);
    }
    for (let b = 0; b < (kind === 'oi' || kind === 'khe' ? 3 : 6); b += 1) { // a few big branches into the canopy
      const a = (b / 6) * Math.PI * 2 + noise(b, salt, 546);
      const len = radius * 0.7;
      q.setFromUnitVectors(up, new THREE.Vector3(Math.cos(a) * 0.8, 0.7, Math.sin(a) * 0.8).normalize());
      trunks.add(cylinder, m.compose(new THREE.Vector3(x + Math.cos(a) * len * 0.4, h + len * 0.3, z + Math.sin(a) * len * 0.4), q, new THREE.Vector3(r * 0.4, len, r * 0.4)));
    }
  };

  const banana = (x, z, salt, scale = 1) => {
    const h = (2.4 + noise(salt, 551) * 1.2) * scale;
    trunks.add(cylinder, m.compose(new THREE.Vector3(x, h / 2, z), q.identity(), new THREE.Vector3(0.14 * scale, h, 0.14 * scale)));
    for (let l = 0; l < 7; l += 1) {
      const a = (l / 7) * Math.PI * 2 + noise(l, salt, 552);
      const tilt = 0.6 + noise(l, salt, 553) * 0.7;
      q.setFromEuler(new THREE.Euler(tilt, a, 0, 'YXZ'));
      cards.banana.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), q.clone(), new THREE.Vector3(0.55 * scale, 2.2 * scale, 1)));
    }
  };

  const bamboo = (x, z, salt, culms = 22) => {
    for (let c = 0; c < culms; c += 1) {
      const a = noise(c, salt, 561) * Math.PI * 2;
      const d = Math.sqrt(noise(c, salt, 562)) * 1.2;
      const h = 7 + noise(c, salt, 563) * 4;
      const lean = new THREE.Vector3(Math.cos(a) * 0.25, 1, Math.sin(a) * 0.25).normalize();
      q.setFromUnitVectors(up, lean);
      const base = new THREE.Vector3(x + Math.cos(a) * d, 0, z + Math.sin(a) * d);
      trunks.add(cylinder, m.compose(base.clone().addScaledVector(lean, h / 2), q, new THREE.Vector3(0.045, h, 0.045)));
      for (let f = 0; f < 6; f += 1) card(cards.bamboo, base.clone().addScaledVector(lean, h * (0.55 + f * 0.08)), 1.6, c * 7 + f + salt);
    }
  };

  const at = (p) => [toX(p.x), toZ(p.y)];
  TREES.forEach((t, k) => {
    const [x, z] = at(t);
    if (t.kind === 'da') leafy(x, z, 'da', k);
    else if (t.kind === 'tre') bamboo(x, z, k);
    else banana(x, z, k);
  });
  for (const p of PLACES.filter((pl) => pl.kind === 'cayBang' || pl.kind === 'cayPhuong')) {
    leafy(toX(p.x + p.w / 2), toZ(p.front - 8), p.kind === 'cayBang' ? 'bang' : 'phuong', p.x);
  }
  // guava, star-fruit and young bananas wherever the ground is free
  for (let k = 0; k < 520; k += 1) {
    const p = { x: 12 + noise(k, 231) * (MAP.w - 24), y: 60 + noise(k, 232) * 600 };
    if (noise(k, 233) >= 0.35 || !groundIsFree(p.x, p.y, 7)) continue;
    const [x, z] = at(p);
    const kind = ['oi', 'khe', 'chuoiNon', 'oi'][Math.floor(noise(k, 234) * 4)];
    if (kind === 'chuoiNon') banana(x, z, k + 900, 0.6);
    else leafy(x, z, kind, k + 900);
  }
  HEDGE.forEach((h, k) => bamboo(toX(h.x), toZ(h.y), k + 1500, 10));
  for (let k = 0; k < 3200; k += 1) { // tufts of grass
    const p = { x: noise(k, 571) * MAP.w, y: 40 + noise(k, 572) * (MAP.h - 40) };
    if (!groundIsFree(p.x, p.y, 1)) continue;
    q.setFromAxisAngle(up, noise(k, 573) * Math.PI);
    const s = 0.35 + noise(k, 574) * 0.35;
    cards.grass.push(new THREE.Matrix4().compose(new THREE.Vector3(toX(p.x), s * 0.45, toZ(p.y)), q.clone(), new THREE.Vector3(s, s, s)));
  }

  const trunkMesh = new THREE.Mesh(trunks.build(), new THREE.MeshStandardMaterial({ map: bark(), roughness: 0.95, color: 0xbfae98 }));
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  const plane = new THREE.PlaneGeometry(1, 1);
  const bananaPlane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const leafMat = (map, amount, extra = {}) => swaying(new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, ...extra }), amount);
  const layers = [
    [cards.leaf, plane, leafMat(leafCard(100, 0), 0.05)],
    [cards.flower, plane, leafMat(leafCard(4, 9), 0.05, { color: 0xffd0c0 })],
    [cards.banana, bananaPlane, leafMat(bananaLeaf(), 0.08)],
    [cards.bamboo, plane, leafMat(leafCard(82, 4), 0.1, { color: 0xd8e8a8 })],
    [cards.grass, plane, leafMat(grassCard(), 0.03)],
  ];
  for (const [list, geo, mat] of layers) {
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((mm, k) => mesh.setMatrixAt(k, mm));
    mesh.castShadow = list !== cards.grass;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  scene.add(group);
  return { group, tick: (t) => { wind.value = t; } };
}

function grassCard() {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
  const ctx = c.getContext('2d');
  for (let k = 0; k < 40; k += 1) {
    const x = 20 + noise(k, 581) * 88;
    ctx.strokeStyle = `hsl(${75 + noise(k, 582) * 30}, 45%, ${22 + noise(k, 583) * 22}%)`;
    ctx.lineWidth = 2 + noise(k, 584) * 2;
    ctx.beginPath();
    ctx.moveTo(x, 128);
    ctx.quadraticCurveTo(x + (noise(k, 585) - 0.5) * 30, 70, x + (noise(k, 586) - 0.5) * 50, 20 + noise(k, 587) * 50);
    ctx.stroke();
  }
  return texture(c, { repeat: false });
}
