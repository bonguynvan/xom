// Everything on wheels or four legs: the ~200 riders of the main road (Cubs, bicycles, cyclos, the ba gác,
// the ice-cream bike), their riders with nón lá or mũ cối, the dogs, cats, chickens, ducks and buffalo, the
// birds overhead and the train with its level-crossing barrier. All instanced: a few draw calls in total.
import * as THREE from '../vendor/three/three.module.min.js';
import { CROSSING_X, MAP } from '../map.js';
import { RAIL_Y } from '../map.js';
import { TRAIN_LENGTH, trainAt } from '../world.js';
import { M, toX, toZ, turnTowards, yawOf } from './coords.js';
import { Builder } from './geom.js';
import { baGac, bicycle, cub, cyclo, rider, trainCar } from './models.js';

const visible = (a) => a.state !== 'inside' && a.state !== 'away' && a.state !== 'gone';
export const KIND_OF = { xeOm: 'cub', vespa: 'cub', duaThu: 'cub', coGiao: 'bike', flowerBike: 'bike', banKem: 'bike', cyclo: 'cyclo', baGac: 'baGac', xeBo: 'baGac' };
const RIDER_AT = { cub: [0, -0.05, -0.3], bike: [0, -0.18, -0.15], cyclo: [0, -0.05, -0.75], baGac: [0, -0.12, 0.4] };

const c = (h) => new THREE.Color(h);
const put = (b, geo, x, y, z, sx, sy, sz, color) => b.add(geo, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)), color);
const boxG = new THREE.BoxGeometry(1, 1, 1);
const ballG = new THREE.SphereGeometry(0.5, 10, 8);

/** Animals facing +Z, feet on the ground; white parts take the instance colour. */
function animal(kind) {
  const b = new Builder();
  const W = c('#ffffff');
  if (kind === 'dog' || kind === 'cat') {
    const s = kind === 'dog' ? 1 : 0.65;
    put(b, boxG, 0, 0.42 * s, 0, 0.26 * s, 0.24 * s, 0.62 * s, W);
    put(b, boxG, 0, 0.58 * s, 0.38 * s, 0.2 * s, 0.2 * s, 0.24 * s, W);
    put(b, boxG, 0, 0.55 * s, 0.53 * s, 0.11 * s, 0.1 * s, 0.12 * s, c('#2a2420'));
    for (const [x, z] of [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.22], [0.09, -0.22]]) put(b, boxG, x * s, 0.17 * s, z * s, 0.07 * s, 0.34 * s, 0.07 * s, W);
    put(b, boxG, 0, 0.55 * s, -0.36 * s, 0.05 * s, 0.05 * s, 0.26 * s, W);
    for (const x of [-0.07, 0.07]) put(b, boxG, x * s, 0.72 * s, 0.34 * s, 0.05 * s, 0.09 * s, 0.03 * s, W);
  } else if (kind === 'chicken' || kind === 'duck') {
    const duck = kind === 'duck';
    put(b, ballG, 0, duck ? 0.12 : 0.24, 0, 0.26, 0.22, duck ? 0.4 : 0.3, W);
    put(b, ballG, 0, duck ? 0.26 : 0.42, 0.14, 0.13, 0.14, 0.13, W);
    put(b, boxG, 0, duck ? 0.24 : 0.41, 0.24, 0.05, 0.03, duck ? 0.1 : 0.06, c('#e9a23b'));
    if (!duck) {
      put(b, boxG, 0, 0.52, 0.14, 0.03, 0.07, 0.08, c('#c1121f'));
      for (const x of [-0.05, 0.05]) put(b, boxG, x, 0.07, 0, 0.02, 0.14, 0.02, c('#e9a23b'));
      put(b, ballG, 0, 0.34, -0.16, 0.1, 0.18, 0.1, W);
    }
  } else { // buffalo
    put(b, boxG, 0, 1.0, 0, 0.75, 0.7, 1.7, W);
    put(b, boxG, 0, 1.05, 1.0, 0.42, 0.42, 0.55, W);
    for (const x of [-1, 1]) put(b, boxG, x * 0.38, 1.3, 1.0, 0.45, 0.07, 0.07, c('#3a3530'));
    for (const [x, z] of [[-0.26, 0.6], [0.26, 0.6], [-0.26, -0.6], [0.26, -0.6]]) put(b, boxG, x, 0.33, z, 0.15, 0.66, 0.15, W);
  }
  return b.build();
}

function bird() {
  const b = new Builder();
  const W = c('#ffffff');
  put(b, ballG, 0, 0, 0, 0.18, 0.14, 0.42, W);
  put(b, boxG, 0, 0, 0, 0.9, 0.02, 0.2, W);
  return b.build();
}

export function buildMovers(scene, { barrier }) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
  const fleshy = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const make = (geo, count, mat = material) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  };
  const rides = { cub: make(cub(), 260), bike: make(bicycle(), 90), cyclo: make(cyclo(), 10), baGac: make(baGac(), 10) };
  const riders = Object.fromEntries(['non', 'coi', 'helmet'].map((h) => {
    const g = rider(h);
    const pair = { cloth: make(g.cloth, 200, fleshy), body: make(g.body, 200, fleshy) };
    pair.cloth.castShadow = false; // the bike's shadow carries the rider: two fewer meshes of 200 in every shadow map
    pair.body.castShadow = false;
    return [h, pair];
  }));
  const animals = { dog: make(animal('dog'), 20, fleshy), cat: make(animal('cat'), 10, fleshy), chicken: make(animal('chicken'), 20, fleshy), duck: make(animal('duck'), 20, fleshy), cow: make(animal('cow'), 10, fleshy) };
  const birds = make(bird(), 40, fleshy);
  const cars = [];
  const carLen = (TRAIN_LENGTH / 5) * M;
  for (let k = 0; k < 5; k += 1) {
    const mesh = new THREE.Mesh(trainCar(k === 0, carLen), material);
    mesh.castShadow = true;
    mesh.visible = false;
    scene.add(mesh);
    cars.push(mesh);
  }
  const memory = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const one = new THREE.Vector3(1, 1, 1);
  let barrierAngle = 0;

  function headingOf(a, X, Z, dt) {
    const mem = memory.get(a.i);
    let yaw = mem?.yaw ?? (a.dir < 0 ? -Math.PI / 2 : Math.PI / 2);
    if (mem) {
      const dx = X - mem.X;
      const dz = Z - mem.Z;
      if (Math.hypot(dx, dz) > 0.01 && Math.hypot(dx, dz) < 5) yaw = turnTowards(mem.yaw, yawOf(dx, dz), dt * 5);
    }
    memory.set(a.i, { X, Z, yaw });
    return yaw;
  }

  /** `skinned` = keys ('v' + agent index) of riders people3d.js is showing as real characters: their box rider is left out. Returns every rider's seat. */
  function update(world, prev, alpha, t, dt, skinned = new Set()) {
    const seats = [];
    const counts = new Map();
    const next = (mesh) => { const n = counts.get(mesh) ?? 0; counts.set(mesh, n + 1); return n; };
    for (const a of world.agents) {
      if (!visible(a)) continue;
      const isVehicle = a.kind === 'vehicle';
      if (!isVehicle && a.kind !== 'animal' && a.kind !== 'flyer') continue;
      const b = prev?.agents[a.i];
      const smooth = b && visible(b) && Math.hypot(b.x - a.x, b.y - a.y) < 30;
      const x = smooth ? b.x + (a.x - b.x) * alpha : a.x;
      const y = smooth ? b.y + (a.y - b.y) * alpha : a.y;
      const X = toX(x);
      const Z = toZ(y);
      if (a.kind === 'flyer') {
        const n = next(birds);
        if (n >= 40) continue;
        const flap = 1 + Math.sin(t / 90 + a.i) * 0.5;
        q.setFromAxisAngle(up, a.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        birds.setMatrixAt(n, m4.compose(new THREE.Vector3(X, 9 + Math.sin(t / 900 + a.i) * 1.5, Z), q, new THREE.Vector3(flap, 1, 1)));
        birds.setColorAt(n, col.set(a.painter === 'crow' ? '#222' : '#f4f1ea'));
        continue;
      }
      const yaw = headingOf(a, X, Z, dt);
      q.setFromAxisAngle(up, yaw);
      if (isVehicle) {
        const kind = KIND_OF[a.painter] ?? 'cub';
        const mesh = rides[kind];
        const n = next(mesh);
        if (n >= mesh.instanceMatrix.count) continue;
        mesh.setMatrixAt(n, m4.compose(new THREE.Vector3(X, 0.02, Z), q, one));
        mesh.setColorAt(n, col.set(kind === 'bike' ? ['#2d6fb5', '#c94f3d', '#3f8f6b', '#1d1d1d'][a.i % 4] : a.color));
        const hat = ['non', 'coi', 'helmet'][a.i % 3];
        const rm = riders[hat];
        const [ox, oy, oz] = RIDER_AT[kind];
        const offset = new THREE.Vector3(ox, oy, oz).applyQuaternion(q);
        const key = `v${a.i}`;
        const shirt = ['#f4f1ea', '#3f6fb5', '#6b8f4e', '#c1121f', '#e9dcc0', '#2b2d42'][(a.i * 7) % 6];
        seats.push({ key, X: X + offset.x, Z: Z + offset.z, seat: oy + 0.9, yaw, pedal: kind === 'bike' || kind === 'cyclo', phase: a.phase ?? 0, color: shirt, hat });
        if (skinned.has(key)) continue;
        const rn = next(rm.cloth);
        next(rm.body);
        m4.compose(new THREE.Vector3(X + offset.x, oy, Z + offset.z), q, one);
        rm.cloth.setMatrixAt(rn, m4);
        rm.body.setMatrixAt(rn, m4);
        rm.cloth.setColorAt(rn, col.set(shirt));
        rm.body.setColorAt(rn, col.set('#ffffff'));
        continue;
      }
      const kind = { dog: 'dog', cat: 'cat', chicken: 'chicken', duck: 'duck', cow: 'cow' }[a.painter];
      if (!kind) continue;
      const mesh = animals[kind];
      const n = next(mesh);
      if (n >= mesh.instanceMatrix.count) continue;
      const onWater = kind === 'duck' && a.pond !== false;
      const bob = a.state === 'walk' ? Math.abs(Math.sin(t / 120 + a.i)) * 0.03 : 0;
      mesh.setMatrixAt(n, m4.compose(new THREE.Vector3(X, (onWater ? 0.03 : 0.02) + bob, Z), q, one));
      mesh.setColorAt(n, col.set(a.color));
    }
    for (const mesh of [...Object.values(rides), ...Object.values(riders).flatMap((r) => [r.cloth, r.body]), ...Object.values(animals), birds]) {
      mesh.count = Math.min(counts.get(mesh) ?? 0, mesh.instanceMatrix.count);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // the train and the barrier
    const train = trainAt(world.minute);
    const len = TRAIN_LENGTH / 5;
    cars.forEach((car, k) => {
      car.visible = Boolean(train);
      if (!train) return;
      const left = train.dir > 0 ? train.x - (k + 1) * len : train.x + k * len;
      car.position.set(toX(left + len / 2), 0.5, toZ(RAIL_Y));
      car.rotation.y = train.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    const near = train && train.x > CROSSING_X - 260 - TRAIN_LENGTH && train.x < CROSSING_X + 260 + TRAIN_LENGTH && train.x > -TRAIN_LENGTH && train.x < MAP.w + TRAIN_LENGTH;
    barrierAngle += ((near ? 0 : 1.35) - barrierAngle) * Math.min(1, dt * 1.5);
    barrier.rotation.z = -barrierAngle;
    return seats;
  }
  return { update };
}
