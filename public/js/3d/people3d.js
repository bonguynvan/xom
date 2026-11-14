// The people of the 3D xóm. The simulation (world.js) still decides where everyone is; this file only shows
// them. The ~60 people nearest the camera are real skinned characters (glTF: Remy and Nathan) that walk, run and
// stand idle, each tinted by their own colour, some with a nón lá or a đòn gánh on the shoulder; everybody
// further away is a cheap instanced figure. Speech bubbles and name tags are HTML over the canvas.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/three/SkeletonUtils.js';
import { toX, toZ, turnTowards, yawOf, heightOf } from './coords.js';
import { MID_REACH, cellOf, ridePose, sidestep, talkPose, tierOf } from './crowd-plan.js';
import { swing, waveArm } from './gesture.js';
import { createImpostors } from './impostor.js';
import { STOOL_TOP } from './interact.js';
import { CLIP } from './locomotion.js';
import { walker } from './models.js';
import { MIXAMO, RENDERPEOPLE, adoptSkeleton, borrowClip } from './retarget.js';
import { surfaceY } from './terrain.js';

const PEOPLE = new Set(['keeper', 'walker', 'kid', 'vendor', 'guest']);
const HAT = new Set(['aoDai', 'ganhHang', 'nongDan', 'baTrau', 'baTraDa', 'coTapHoa']);
const SIDE_STEPPERS = new Set(['keeper', 'walker', 'kid', 'vendor', 'guest']);
const visible = (a) => a.state !== 'inside' && a.state !== 'away' && a.state !== 'gone';
const SLOTS = 60;
const NEAR_MAX = 30; // how many at once (the pool is bigger so a change of rig never waits)
const SHADOW_MAX = 10;
const NEAR_REACH = 24; // metres from the focus within which people are real skinned characters
const NEAR_FROM = 45; // camera further than this from its focus (the overview): nobody is, they are a few pixels tall
const SHADOW_REACH = 14; // skinned characters only cast a shadow this close (each one is 22-31 k triangles, drawn again for the shadow)
const FAR_MAX = 2200;
const BROLLIES = 500;
const hashOf = (key) => { let h = 7; for (let k = 0; k < key.length; k += 1) h = (h * 31 + key.charCodeAt(k)) >>> 0; return h; };
const TOP_LIFT = 2.6; // Remy's top is charcoal: lifted to a mid grey so the person's colour shows on it
const SHEET_HALF = { man: 0, youth: 1 }; // which half of the impostor sheet a rig is drawn in
const WALK_SPEED = 1.35; // m/s the walk clip is made for
const RUN_SPEED = 3.6;

/** In a character with a material for its top (Remy's `Topmat`) only that takes the person's colour; else everything does. */
export const tintable = (materials) => { const tops = materials.filter((m) => /top/i.test(m.mat.name)); return tops.length ? tops : materials; };

/**
 * Load the characters and the clips they all play. `clips.glb` is a Mixamo skeleton with nothing on it and
 * the idle, walk and run; each character's own skeleton is converted to it (retarget.js). Remy is the man;
 * the young man (`nathan.glb`, a Renderpeople scan) is there only if his file is. Returns { man, youth? }.
 */
export async function loadRigs(base = '/models/') {
  const loader = new GLTFLoader();
  const [moves, man, youth] = await Promise.all([loader.loadAsync(`${base}clips.glb`), loader.loadAsync(`${base}remy.glb`), loader.loadAsync(`${base}nathan.glb`).catch(() => null)]);
  // The clips' skeleton faces -Z, the characters +Z (their toes say so): turn it round, or everybody walks backwards.
  moves.scene.children[0].quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
  const clips = Object.fromEntries(['Idle', 'Walk', 'Run'].map((n) => [n.toLowerCase(), moves.animations.find((c) => c.name === n)]));
  const rest = moves.animations.find((c) => c.name === 'TPose');
  const rig = (gltf, map) => {
    const fit = adoptSkeleton(gltf.scene, moves.scene, map, rest);
    gltf.scene.updateMatrixWorld(true);
    let tris = 0;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material.transparent) { o.material.transparent = false; o.material.alphaTest = 0.5; o.material.depthWrite = true; } // hair cards: cut out, not blended
      if (/top/i.test(o.material.name) && !o.material.userData.lifted) { o.material.color.multiplyScalar(TOP_LIFT); o.material.userData.lifted = true; }
      // culled like anything else, by a sphere round the T-pose made roomy enough for any stride or wave
      if (o.isSkinnedMesh) { o.computeBoundingBox(); o.computeBoundingSphere(); o.boundingSphere.radius *= 1.5; }
      tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    // every rig the height the clips were made for, whatever units its file came in (Remy arrives 3.7 m tall):
    // hats and things carried are built in metres for a head and shoulders of that size
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const k = CLIP.height / (box.max.y - box.min.y);
    for (const child of gltf.scene.children) { child.scale.multiplyScalar(k); child.position.multiplyScalar(k); }
    gltf.scene.updateMatrixWorld(true);
    // stride: how far this rig's feet reach with these clips, per metre of height, against the skeleton the clips were made on
    return { scene: gltf.scene, height: CLIP.height, tris, stride: 1, clips: Object.fromEntries(Object.entries(clips).map(([k, c]) => [k, borrowClip(c, fit)])) };
  };
  return { man: rig(man, MIXAMO), ...(youth ? { youth: rig(youth, RENDERPEOPLE) } : {}) };
}

const canopyGeo = new THREE.ConeGeometry(0.62, 0.22, 12, 1, true);
const stickGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.95, 5);
const ponchoGeo = new THREE.CylinderGeometry(0.17, 0.46, 1.0, 12, 1, true);
const RAIN_COLORS = [0x2d6fb5, 0xc1121f, 0x1b1b1b, 0x2f8f5a, 0xe07a1f, 0x6a4c93, 0xd9d2c0];
const PONCHO_COLORS = [0x9ad1f0, 0xf2b0c0, 0xbfe3a6, 0xf5e39a, 0xc9b8f0];

/** An umbrella held over the head, as tall as the rig it is made for (`height` in the rig's own units). */
export function umbrella(height) {
  const g = new THREE.Group();
  const k = height / 1.7;
  const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({ color: 0x2d6fb5, roughness: 0.45, side: THREE.DoubleSide }));
  canopy.position.y = height + 0.3 * k;
  canopy.scale.setScalar(k);
  const stick = new THREE.Mesh(stickGeo, new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }));
  stick.position.set(0, height - 0.12 * k, 0);
  stick.scale.setScalar(k);
  g.add(canopy, stick);
  g.position.set(0.16 * k, 0, 0.1 * k);
  g.userData.canopy = canopy.material;
  return g;
}

/** Áo mưa: the thin plastic cape everybody on a Vietnamese street pulls on when it starts to rain. */
export function poncho(height) {
  const k = height / 1.7;
  const m = new THREE.Mesh(ponchoGeo, new THREE.MeshStandardMaterial({ color: 0x9ad1f0, roughness: 0.25, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false }));
  m.position.y = height * 0.6;
  m.scale.setScalar(k);
  return m;
}

export function nonLa() {
  const g = new THREE.ConeGeometry(0.29, 0.2, 20, 1, true);
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd8c48c, roughness: 0.85, side: THREE.DoubleSide }));
}

/** Đòn gánh: the bamboo shoulder pole with a basket hanging from each end. */
export function donGanh() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0xb58d52, roughness: 0.8 }));
  pole.rotation.z = Math.PI / 2;
  g.add(pole);
  for (const x of [-0.8, 0.8]) {
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.28, 14), new THREE.MeshStandardMaterial({ color: 0x9c7a45, roughness: 0.9 }));
    basket.position.set(x, -0.75, 0);
    g.add(basket);
    const goods = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), new THREE.MeshStandardMaterial({ color: x < 0 ? 0xe9a23b : 0x6aa84f, roughness: 0.8 }));
    goods.scale.y = 0.45;
    goods.position.set(x, -0.6, 0);
    g.add(goods);
    for (const dz of [-0.2, 0.2]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 3), new THREE.MeshBasicMaterial({ color: 0x3a2e20 }));
      rope.position.set(x, -0.33, dz);
      rope.rotation.x = dz * 1.2;
      g.add(rope);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** One skinned character slot: a clone of a rig with its own mixer, materials and accessories. */
function makeSlot(rig, scene) {
  const root = SkeletonUtils.clone(rig.scene);
  const materials = [];
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    o.material = o.material.clone();
    materials.push({ mat: o.material, base: o.material.color.clone() });
  });
  const tinted = tintable(materials);
  let head = null;
  let spine = null;
  let arm = null;
  let fore = null;
  const limbs = {}; // the bones the seated, riding and talking poses turn
  root.traverse((o) => {
    if (!o.isBone) return;
    for (const name of ['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftArm', 'LeftForeArm', 'Spine']) if (new RegExp(`${name}$`).test(o.name)) limbs[name] = o;
    if (/Head$/.test(o.name)) head = o;
    if (/Spine2$/.test(o.name)) spine = o;
    if (/RightArm$/.test(o.name)) arm = o;
    if (/RightForeArm$/.test(o.name)) fore = o;
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(Object.entries(rig.clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  for (const a of Object.values(actions)) { a.play(); a.setEffectiveWeight(0); }
  actions.idle.setEffectiveWeight(1);
  root.visible = false;
  scene.add(root);
  root.updateMatrixWorld(true);
  const unit = new THREE.Vector3();
  head?.getWorldScale(unit);
  const hat = nonLa();
  hat.castShadow = false; // a thin double-sided cone only speckles itself with shadow
  const pole = donGanh();
  const boneScale = unit.x || 1;
  if (head) { hat.scale.setScalar(1 / boneScale); hat.position.set(0, 0.2 / boneScale, 0.03 / boneScale); head.add(hat); }
  const spineScale = new THREE.Vector3();
  spine?.getWorldScale(spineScale);
  if (spine) { pole.scale.setScalar(1 / (spineScale.x || 1)); pole.position.set(0, 0.12 / (spineScale.x || 1), 0); pole.rotation.y = Math.PI / 2; spine.add(pole); }
  const brolly = umbrella(rig.height);
  const cape = poncho(rig.height);
  brolly.visible = false;
  cape.visible = false;
  root.add(brolly, cape);
  return { rig, root, mixer, actions, materials: tinted, meshes, arm, fore, head, limbs, shadow: true, hat, pole, brolly, cape, gear: '', key: null, yaw: 0, weights: { idle: 1, walk: 0, run: 0 }, last: null };
}

/** `skinned` = how many neighbours at once are real characters (the quality tier's number). */
export function buildPeople(scene, rigs, overlay, { skinned = NEAR_MAX, budget = Infinity, renderer = null, seats = [] } = {}) {
  let raining = false;
  const mid = renderer ? createImpostors(scene, renderer, rigs) : null; // the middle distance: pictures of the same characters
  const tiers = new Map(); // key -> 'mid' | 'far' last frame
  const riding = new Set(); // riders shown as real characters this frame (vehicles3d.js leaves their box rider out)
  const side = new THREE.Vector3();
  const white = new THREE.Color('#ffffff');
  let shown = 0;
  /** Legs up on a seat `seatY` metres up; returns nothing, turns the slot's bones. `legs` = { left, right } thigh and shin angles. */
  const seatLegs = (s, legs) => {
    for (const [name, leg] of [['Left', legs.left], ['Right', legs.right]]) {
      const [thigh, shin] = [s.limbs[`${name}UpLeg`], s.limbs[`${name}Leg`]];
      if (!thigh || !shin) continue;
      swing(thigh, side, leg.thigh);
      thigh.updateMatrixWorld(true);
      swing(shin, side, leg.shin);
    }
  };
  /** Which rig someone is: the thanh niên and every other grown-up the young man, everybody else (the kids too) Remy. */
  const rigKey = (p) => (rigs.youth && p.kind !== 'kid' && (p.painter === 'anhRadio' || hashOf(p.key) % 2 === 0) ? 'youth' : 'man');
  const slots = [];
  for (let k = 0; k < SLOTS; k += 1) slots.push(makeSlot(k % 5 < 2 && rigs.youth ? rigs.youth : rigs.man, scene));
  const farGeo = walker();
  const far = new THREE.InstancedMesh(farGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), FAR_MAX);
  far.castShadow = true;
  far.receiveShadow = true;
  far.frustumCulled = false;
  scene.add(far);
  // a soft dark disc under everybody: contact with the ground at night, in the rain, and on machines with no shadow maps
  const disc = new THREE.CircleGeometry(0.34, 10);
  disc.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -24 });
  const blobs = new THREE.InstancedMesh(disc, blobMat, FAR_MAX + SLOTS);
  blobs.frustumCulled = false;
  blobs.renderOrder = 2;
  scene.add(blobs);
  const brollies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide }), BROLLIES);
  brollies.frustumCulled = false;
  brollies.count = 0;
  brollies.setColorAt(0, new THREE.Color(0xffffff));
  scene.add(brollies);
  const swimmers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0x5a3b28, roughness: 0.6 }), 80);
  swimmers.frustumCulled = false;
  scene.add(swimmers);
  const memory = new Map(); // key -> { yaw, x, z } for headings of far figures and smooth turning
  const tint = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const bubbles = overlay ? makeBubbles(overlay) : null;
  let lastNear = [];
  let reaction = null; // someone you greeted: { key, X, Z (you), t, seconds, hold } stops, turns to you and waves
  let clock = 0;

  /** Everyone who should be seen this frame, with world positions (metres) and what they are doing. */
  function gather(world, prev, alpha, extras, me, remoteOf) {
    const out = [];
    for (const a of world.agents) {
      if (!PEOPLE.has(a.kind) || (me !== null && a.guestId === me)) continue; // you are your own avatar
      // another visitor who says where they really are is shown there, whatever the simulation has their stand-in doing
      const far = a.guestId ? remoteOf(a.guestId) : null;
      if (far) { out.push({ key: `a${a.i}`, a, x: far.x, y: far.y, moving: far.speed > 2, partner: null, kind: a.kind, painter: a.painter, color: a.color, size: a.size, remote: far, sit: far.a === 'sit' }); continue; }
      if (!visible(a)) continue;
      const b = prev?.agents[a.i];
      const smooth = b && visible(b) && Math.hypot(b.x - a.x, b.y - a.y) < 20;
      let x = smooth ? b.x + (a.x - b.x) * alpha : a.x;
      let y = smooth ? b.y + (a.y - b.y) * alpha : a.y;
      if (SIDE_STEPPERS.has(a.kind) && a.state !== 'stay') { const off = ((a.i * 37) % 11 - 5) * 0.8; x -= a.hy * off; y += a.hx * off; }
      const partner = a.state === 'chat' && a.chatWith !== null ? world.agents[a.chatWith] : null;
      out.push({ key: `a${a.i}`, a, x, y, moving: a.state === 'walk', partner, kind: a.kind, painter: a.painter, color: a.color, size: a.size });
    }
    for (const e of extras) {
      out.push({ key: `e${e.n}`, a: null, x: e.x, y: e.y, moving: e.moving, sit: e.sit, swim: e.swim, kind: 'extra', painter: e.agent.painter, color: e.agent.color, size: e.agent.size });
    }
    return out;
  }

  /** Show everyone; `focus` is the point the camera looks at (metres). Returns the near list (for greetings). */
  function update(world, prev, alpha, extras, camera, focus, dt, me = null, said = [], { riders = [], avoid = null, light = 1, remoteOf = () => null } = {}) {
    const list = gather(world, prev, alpha, extras, me, remoteOf);
    for (const v of riders) list.push({ key: v.key, a: null, x: 0, y: 0, X: v.X, Z: v.Z, moving: false, kind: 'rider', painter: v.hat === 'non' ? 'nongDan' : '', color: v.color, size: 1, ride: v });
    clock += dt;
    if (reaction) { reaction.t += dt; if (reaction.t > reaction.seconds + reaction.back) reaction = null; }
    for (const p of list) {
      if (!p.ride) { p.X = toX(p.x); p.Z = toZ(p.y); }
      if (reaction && p.key === reaction.key) { // shown standing where they were greeted, then walking back to where the simulation has them
        reaction.hold ??= { X: p.X, Z: p.Z };
        const away = Math.hypot(p.X - reaction.hold.X, p.Z - reaction.hold.Z);
        if (reaction.t <= reaction.seconds) reaction.back = Math.max(0.5, away / 2);
        const back = Math.max(0, Math.min(1, (reaction.t - reaction.seconds) / reaction.back));
        p.X = reaction.hold.X + (p.X - reaction.hold.X) * back;
        p.Z = reaction.hold.Z + (p.Z - reaction.hold.Z) * back;
        p.greeting = back === 0;
        if (p.greeting) p.moving = false;
      }
      if (!p.moving && !p.ride && p.swim === undefined && (p.sit || (p.a?.state === 'stay' && !p.remote))) { // on a stool: sit on it, facing the table
        const seat = seats.find((q2) => Math.abs(q2.X - p.X) < 0.5 && Math.abs(q2.Z - p.Z) < 0.5);
        p.seat = seat ?? null;
        if (seat) { p.X = seat.X; p.Z = seat.Z; }
      }
      if (avoid && !p.ride && !p.seat && p.swim === undefined) { const s = sidestep(p.X, p.Z, avoid.x, avoid.z); p.X = s.X; p.Z = s.Z; } // they step round you
      p.d = Math.hypot(p.X - focus.x, p.Z - focus.z);
      const mem = memory.get(p.key);
      const dx = mem ? p.X - mem.X : 0;
      const dz = mem ? p.Z - mem.Z : 0;
      const step = Math.hypot(dx, dz);
      const speed = dt > 0 ? step / dt : 0;
      let yaw = mem?.yaw ?? 0;
      if (p.ride) yaw = p.ride.yaw;
      else if (p.seat) yaw = p.seat.heading;
      else if (p.remote) yaw = p.remote.h;
      else if (p.greeting) yaw = yawOf(reaction.X - p.X, reaction.Z - p.Z);
      else if (p.partner) yaw = yawOf(toX(p.partner.x) - p.X, toZ(p.partner.y) - p.Z);
      else if (step > 0.004) yaw = yawOf(dx, dz);
      p.yaw = mem && !p.ride ? turnTowards(mem.yaw, yaw, dt * (p.greeting ? 9 : 6)) : yaw;
      p.speed = mem && step < 3 ? mem.speed * 0.8 + speed * 0.2 : 0;
      memory.set(p.key, { X: p.X, Z: p.Z, yaw: p.yaw, speed: p.speed });
    }
    // the nearest get a real character; keep the ones already shown so nobody pops between models
    const reach = camera.position.distanceTo(focus) > NEAR_FROM ? 0 : NEAR_REACH;
    far.castShadow = reach === 0; // from above the crowd's shadows read; at street level the far figures get the disc only
    let b = 0;
    const blob = (X, y, Z, size) => { blobs.setMatrixAt(b, m4.makeScale(size, 1, size).setPosition(X, y + 0.012, Z)); b += 1; };
    riding.clear();
    let near = list.filter((p) => p.swim === undefined && p.d < (p.ride ? Math.min(reach, 16) : reach))
      .sort((a, b) => a.d - b.d).slice(0, Math.min(NEAR_MAX, skinned));
    // the characters are heavy (22-31 k triangles, drawn again for each shadow map near you): stop at the tier's budget
    let spent = 0;
    for (let k = 0; k < near.length; k += 1) {
      const p = near[k];
      spent += rigs[rigKey(p)].tris * (k < SHADOW_MAX && p.d < SHADOW_REACH ? 2.5 : 1);
      if (spent > budget && k >= 4) { near.length = k; break; }
    }
    near.forEach((p, k) => { p.rank = k; });
    const wanted = new Set(near.map((p) => p.key));
    const byKey = new Map(near.map((p) => [p.key, p]));
    for (const s of slots) if (s.key && !wanted.has(s.key)) s.key = null;
    const taken = new Set(slots.filter((s) => s.key).map((s) => s.key));
    for (const p of near) {
      if (taken.has(p.key)) continue;
      const mine = rigs[rigKey(p)];
      const free = slots.find((s) => !s.key && s.rig === mine) ?? slots.find((s) => !s.key);
      if (!free) break;
      free.key = p.key;
      free.fresh = true;
      taken.add(p.key);
    }
    for (const s of slots) {
      const p = s.key ? byKey.get(s.key) : null;
      s.root.visible = Boolean(p);
      if (!p) continue;
      const h = heightOf(p.kind === 'extra' ? 'walker' : p.kind, p.size);
      const scale = h / s.rig.height;
      s.root.scale.setScalar(scale);
      const tall = scale * s.rig.height;
      const ground = p.ride ? 0 : p.seat ? p.seat.y : surfaceY(p.x, p.y);
      const drop = p.ride ? 0.534 * tall - p.ride.seat : p.seat ? Math.max(0, 0.534 * tall - (STOOL_TOP + 0.09)) : 0; // hips down onto the saddle or the stool
      s.root.position.set(p.X, ground - drop, p.Z);
      if (p.ride) riding.add(p.key);
      s.root.rotation.y = p.yaw;
      blob(p.X, ground, p.Z, tall / 1.7);
      const shadow = p.d < SHADOW_REACH && p.rank < SHADOW_MAX;
      if (shadow !== s.shadow) { for (const mesh of s.meshes) mesh.castShadow = shadow; s.shadow = shadow; }
      if (s.fresh || s.last !== p.color) {
        tint.set(p.color ?? '#ffffff').lerp(new THREE.Color('#ffffff'), 0.62);
        for (const m of s.materials) m.mat.color.copy(m.base).multiply(tint);
        s.hat.visible = HAT.has(p.painter) && p.kind !== 'kid';
        s.pole.visible = p.painter === 'ganhHang';
        s.last = p.color;
      }
      const moving = p.moving || p.speed > 0.3;
      const run = moving && (p.kind === 'kid' || p.kind === 'guest') && p.speed > 2.2;
      const target = { idle: moving ? 0 : 1, walk: moving && !run ? 1 : 0, run: run ? 1 : 0 };
      for (const [k, act] of Object.entries(s.actions)) {
        s.weights[k] = s.fresh ? target[k] : s.weights[k] + (target[k] - s.weights[k]) * Math.min(1, dt * 6);
        act.setEffectiveWeight(s.weights[k]);
      }
      const pace = run ? p.speed / RUN_SPEED : Math.max(0.55, Math.min(1.6, (p.speed || WALK_SPEED * 0.8) / WALK_SPEED / (h / 1.7)));
      s.actions.walk.setEffectiveTimeScale(pace);
      s.actions.run.setEffectiveTimeScale(Math.max(0.7, Math.min(1.4, pace)));
      s.mixer.update(dt);
      if (p.ride || p.seat || p.partner || p.a?.bubble) { // poses laid over the clip: on a saddle, on a stool, hands while talking
        s.root.updateMatrixWorld(true);
        side.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
        if (p.ride) {
          const pose = ridePose(p.ride.phase, p.ride.pedal);
          seatLegs(s, pose);
          if (s.limbs.Spine) swing(s.limbs.Spine, side, pose.lean);
          for (const [a2, f2] of [[s.arm, s.fore], [s.limbs.LeftArm, s.limbs.LeftForeArm]]) {
            if (!a2 || !f2) continue;
            a2.parent.updateMatrixWorld(true);
            swing(a2, side, pose.arm);
            a2.updateMatrixWorld(true);
            swing(f2, side, pose.fore);
          }
        } else {
          if (p.seat) seatLegs(s, { left: { thigh: -1.5, shin: 1.5 }, right: { thigh: -1.5, shin: 1.5 } });
          const talking = p.partner || (p.a?.bubble && world.t >= p.a.bubble.from);
          if (talking && !p.greeting && s.arm && s.fore) {
            const talk = talkPose(clock, hashOf(p.key) % 17);
            swing(s.arm, side, talk.arm);
            s.arm.updateMatrixWorld(true);
            swing(s.fore, side, talk.fore);
            if (s.head) swing(s.head, side, talk.nod);
          }
        }
      }
      if (p.greeting) waveArm(s.root, s.arm, s.fore, Math.min(1, reaction.t / 0.3, (reaction.seconds - reaction.t) / 0.3), clock);
      const gear = !raining || p.kind === 'extra' && p.moving === false ? '' : (p.kind === 'kid' || hashOf(p.key) % 5 < 2 ? 'cape' : 'brolly');
      if (gear !== s.gear || s.fresh) {
        s.gear = gear;
        s.brolly.visible = gear === 'brolly';
        s.cape.visible = gear === 'cape';
        s.brolly.userData.canopy.color.setHex(RAIN_COLORS[hashOf(p.key) % RAIN_COLORS.length]);
        s.cape.material.color.setHex(PONCHO_COLORS[hashOf(p.key) % PONCHO_COLORS.length]);
      }
      s.fresh = false;
      p.slot = s;
    }
    // everybody else: one instanced figure each
    let n = 0;
    let w = 0;
    let u = 0;
    mid?.begin();
    const walking = reach > 0;
    const nearKeys = new Set(slots.filter((s) => s.key).map((s) => s.key));
    for (const p of list) {
      if (p.swim !== undefined) {
        if (w < 80) { swimmers.setMatrixAt(w, m4.makeTranslation(p.X, 0.1 + (p.swim ?? 0) * 0.03, p.Z)); w += 1; }
        continue;
      }
      if (nearKeys.has(p.key) || p.ride || p.d > 160 || n >= FAR_MAX) continue;
      const tier = walking && mid ? tierOf(p.d, tiers.get(p.key)) : 'far';
      tiers.set(p.key, tier);
      if (tier === 'mid' && mid.count < mid.max) { // a picture of a real character, turned to the camera
        const tall = heightOf(p.kind === 'extra' ? 'walker' : p.kind, p.size);
        const toCamera = Math.atan2(camera.position.x - p.X, camera.position.z - p.Z);
        const moving = p.moving || p.speed > 0.3;
        const base = p.seat ? p.seat.y - 0.35 * tall : surfaceY(p.x, p.y);
        mid.add(p.X, base, p.Z, tall, toCamera, cellOf(p.yaw, toCamera, clock * 1.7 + (hashOf(p.key) % 100) / 100, moving, SHEET_HALF[rigKey(p)]), tint.set(p.color ?? '#ffffff').lerp(white, 0.62));
        blob(p.X, p.seat ? p.seat.y : base, p.Z, tall / 1.7);
        continue;
      }
      const h = heightOf(p.kind === 'extra' ? 'walker' : p.kind, p.size) / 1.75;
      const bob = p.moving ? Math.abs(Math.sin(performance.now() / 180 + p.x)) * 0.04 : 0;
      q.setFromAxisAngle(up, p.yaw);
      far.setMatrixAt(n, m4.compose(new THREE.Vector3(p.X, surfaceY(p.x, p.y) + bob, p.Z), q, new THREE.Vector3(h, h, h)));
      far.setColorAt(n, tint.set(p.color ?? '#cccccc'));
      if (raining && u < BROLLIES && p.d < 90 && hashOf(p.key) % 5 >= 2) { // out in the rain: an umbrella over each far figure too
        brollies.setMatrixAt(u, m4.makeScale(h, h, h).setPosition(p.X, surfaceY(p.x, p.y) + 1.95 * h, p.Z));
        brollies.setColorAt(u, tint.setHex(RAIN_COLORS[hashOf(p.key) % RAIN_COLORS.length]));
        u += 1;
      }
      if (p.d < 70) blob(p.X, surfaceY(p.x, p.y), p.Z, h);
      n += 1;
    }
    far.count = n;
    far.instanceMatrix.needsUpdate = true;
    if (far.instanceColor) far.instanceColor.needsUpdate = true;
    mid?.end(light);
    shown = n + (mid?.count ?? 0) + nearKeys.size;
    if (tiers.size > 4000) tiers.clear();
    brollies.count = u;
    brollies.visible = u > 0;
    brollies.instanceMatrix.needsUpdate = true;
    if (brollies.instanceColor) brollies.instanceColor.needsUpdate = true;
    blobs.count = b;
    blobs.instanceMatrix.needsUpdate = true;
    swimmers.count = w;
    swimmers.instanceMatrix.needsUpdate = true;
    lastNear = near;
    // other visitors too far to be a full character still carry their name
    const tags = list.filter((p) => p.a?.kind === 'guest' && !nearKeys.has(p.key) && p.d < 70).map((p) => ({ text: p.a.name, X: p.X, Y: 2.05, Z: p.Z, cls: 'tag' }));
    if (bubbles) bubbles.draw(world, near, camera, me, [...said, ...tags]);
    return near;
  }

  /** The neighbour `key` stops, turns towards (x, z) and waves for `seconds` (a greeting answered). Shown only: the simulation goes on. */
  const react = (key, towards, seconds = 2.8) => { reaction = { key, X: towards.x, Z: towards.z, t: 0, seconds, back: 0.5, hold: null }; };

  return { update, react, riding, get near() { return lastNear; }, /** How many people were drawn last frame, all tiers. */ get shown() { return shown; }, /** How dark the disc under people is (0..1). */ ground(opacity) { blobMat.opacity = opacity; }, /** Raining: umbrellas and ponchos come out. */ rain(on) { raining = on; } };
}

/** HTML speech bubbles and name tags, positioned over heads each frame (CSSOM only: the CSP forbids inline styles). */
function makeBubbles(layer) {
  const pool = [];
  const v = new THREE.Vector3();
  const get = (k) => {
    if (!pool[k]) {
      const el = document.createElement('div');
      el.className = 'bubble3d';
      layer.appendChild(el);
      pool[k] = el;
    }
    return pool[k];
  };
  return {
    draw(world, near, camera, me, said) {
      const rect = layer.getBoundingClientRect();
      let k = 0;
      const placed = []; // people chatting stand close: lift a bubble over one it would cover, else leave it out
      const show = (text, X, Y, Z, cls) => {
        v.set(X, Y, Z).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
        const sx = ((v.x + 1) / 2) * rect.width;
        let sy = ((1 - v.y) / 2) * rect.height;
        const w = Math.min(220, text.length * 6.5 + 20);
        const hits = () => placed.some((b) => Math.abs(b.x - sx) < (b.w + w) / 2 && Math.abs(b.y - sy) < 24);
        if (hits()) sy -= 26;
        if (hits()) return;
        placed.push({ x: sx, y: sy, w });
        const el = get(k);
        k += 1;
        if (el.textContent !== text) el.textContent = text;
        el.className = `bubble3d ${cls}`;
        el.hidden = false;
        el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
      };
      for (const p of near.slice(0, 40)) {
        const line = p.a?.bubble;
        const h = p.slot ? p.slot.root.scale.x * p.slot.rig.height : 1.7;
        if (line && world.t >= line.from && k < 14) show(line.text, p.X, h + 0.35 + (p.slot?.root.position.y ?? 0), p.Z, line.angry ? 'angry' : '');
        else if (p.a?.kind === 'guest' && k < 20) show(p.a.guestId === me ? `★ ${p.a.name}` : p.a.name, p.X, h + 0.25, p.Z, 'tag');
      }
      for (const b of said) show(b.text, b.X, b.Y, b.Z, b.cls ?? '');
      for (; k < pool.length; k += 1) pool[k].hidden = true;
    },
  };
}
