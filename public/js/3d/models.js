// Low-poly models built in code, each one merged geometry with vertex colours so hundreds can be drawn as one
// instanced mesh: the Honda Cub, the bicycle, the cyclo, the ba gác cargo trike, the bò cart, the train,
// riders (with a nón lá or a mũ cối) and the far-away walkers. Parts painted pure white take the instance
// colour (the Cub's body, a rider's shirt); every other part keeps its own colour.
import * as THREE from '../vendor/three/three.module.min.js';
import { Builder } from './geom.js';

const C = (hex) => new THREE.Color(hex);
const WHITE = C('#ffffff');
const TYRE = C('#1b1b1b');
const CHROME = C('#9a9a9a');
const SEAT = C('#2a1d16');
const SKIN = C('#c58c62');
const PANTS = C('#2e3440');
const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const put = (b, geo, pos, scale, color, rot = null) => b.add(geo, m.compose(pos, rot ?? q.identity(), scale), color);

const box = new THREE.BoxGeometry(1, 1, 1);
const ball = new THREE.SphereGeometry(0.5, 10, 8);
const farHead = new THREE.SphereGeometry(0.5, 6, 4); // seen from thirty metres: 40 triangles are plenty
const tube = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const wheelGeo = new THREE.TorusGeometry(0.5, 0.18, 6, 16);
const cone = new THREE.ConeGeometry(0.5, 1, 14, 1, true);
const sideways = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
const wheelRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

/** Models face +Z (forward), wheels on y = 0. */
function wheel(b, z, r, color = TYRE) {
  put(b, wheelGeo, v(0, r, z), v(r * 1.6, r * 1.6, r * 1.2), color, wheelRot);
  put(b, tube, v(0, r, z), v(r * 0.35, 0.1, r * 0.35), CHROME, sideways);
}

export function cub() {
  const b = new Builder();
  wheel(b, 0.6, 0.29);
  wheel(b, -0.6, 0.29);
  put(b, box, v(0, 0.55, -0.15), v(0.32, 0.38, 0.9), WHITE); // the step-through body
  put(b, box, v(0, 0.48, 0.18), v(0.22, 0.16, 0.5), WHITE);
  put(b, box, v(0, 0.82, -0.25), v(0.28, 0.1, 0.62), SEAT); // the seat
  put(b, box, v(0, 0.78, 0.42), v(0.34, 0.5, 0.18), WHITE); // leg shield
  put(b, tube, v(0, 0.75, 0.55), v(0.06, 0.7, 0.06), CHROME, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.35)); // fork
  put(b, tube, v(0, 1.08, 0.48), v(0.04, 0.68, 0.04), CHROME, sideways); // handlebar
  put(b, ball, v(0, 1.08, 0.58), v(0.16, 0.14, 0.12), CHROME); // headlamp
  put(b, box, v(0.12, 0.35, -0.45), v(0.08, 0.08, 0.6), CHROME); // exhaust
  put(b, box, v(0, 0.95, -0.72), v(0.3, 0.05, 0.35), CHROME); // the rack for the chicken cage and the sack of rice
  return b.build();
}

export function bicycle() {
  const b = new Builder();
  wheel(b, 0.52, 0.34, TYRE);
  wheel(b, -0.52, 0.34, TYRE);
  const frame = WHITE;
  const bar = (from, to, r = 0.025) => {
    const dir = new THREE.Vector3().subVectors(to, from);
    put(b, tube, from.clone().add(to).multiplyScalar(0.5), v(r * 2, dir.length(), r * 2), frame, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  };
  bar(v(0, 0.34, -0.52), v(0, 0.75, -0.1));
  bar(v(0, 0.75, -0.1), v(0, 0.8, 0.42));
  bar(v(0, 0.34, -0.1), v(0, 0.8, 0.42));
  bar(v(0, 0.34, 0.52), v(0, 0.95, 0.42));
  bar(v(0, 0.34, -0.52), v(0, 0.34, -0.1));
  put(b, box, v(0, 0.8, -0.12), v(0.12, 0.05, 0.22), SEAT);
  put(b, tube, v(0, 0.98, 0.42), v(0.03, 0.55, 0.03), CHROME, sideways);
  put(b, box, v(0, 0.7, -0.62), v(0.3, 0.03, 0.3), CHROME); // carrier
  return b.build();
}

/** The cyclo: the passenger seat in front, the driver pedalling behind. */
export function cyclo() {
  const b = new Builder();
  wheel(b, 0.55, 0.32);
  for (const x of [-0.45, 0.45]) put(b, wheelGeo, v(x, 0.32, 0.55), v(0.5, 0.5, 0.4), TYRE, wheelRot);
  put(b, wheelGeo, v(0, 0.34, -0.85), v(0.55, 0.55, 0.4), TYRE, wheelRot);
  put(b, box, v(0, 0.62, 0.5), v(0.95, 0.12, 0.6), WHITE);
  put(b, box, v(0, 0.95, 0.25), v(0.95, 0.6, 0.1), WHITE);
  put(b, box, v(0, 0.7, 0.55), v(0.85, 0.1, 0.5), SEAT);
  put(b, box, v(0, 0.6, -0.25), v(0.06, 0.06, 1.2), CHROME);
  put(b, box, v(0, 0.95, -0.7), v(0.14, 0.05, 0.25), SEAT);
  put(b, box, v(0, 1.25, 0.5), v(1.0, 0.04, 0.7), C('#3d4a5c')); // the folding hood
  return b.build();
}

/** Ba gác: a cargo trike piled with sacks and baskets. */
export function baGac() {
  const b = new Builder();
  for (const x of [-0.55, 0.55]) put(b, wheelGeo, v(x, 0.32, -0.4), v(0.5, 0.5, 0.4), TYRE, wheelRot);
  wheel(b, 0.95, 0.3);
  put(b, box, v(0, 0.55, -0.4), v(1.2, 0.08, 1.3), C('#6b4f35'));
  put(b, box, v(0, 0.72, -0.4), v(1.2, 0.3, 1.3), WHITE);
  for (let k = 0; k < 4; k += 1) put(b, ball, v(-0.3 + (k % 2) * 0.6, 1.0, -0.7 + Math.floor(k / 2) * 0.6), v(0.5, 0.4, 0.5), C(['#c9b38a', '#a68b5b', '#d9c9a0', '#8f7a52'][k]));
  put(b, box, v(0, 0.75, 0.45), v(0.08, 0.08, 1.0), CHROME);
  put(b, tube, v(0, 1.05, 0.85), v(0.03, 0.6, 0.03), CHROME, sideways);
  return b.build();
}

/**
 * A seated rider for a Cub or a bicycle, in two parts so only the shirt takes the instance colour: `cloth`
 * (shirt and sleeves, white) and `body` (head, trousers and a nón lá, mũ cối or helmet, in their own colours).
 */
export function rider(hat = 'non') {
  const cloth = new Builder();
  const body = new Builder();
  put(cloth, box, v(0, 1.25, -0.2), v(0.38, 0.55, 0.24), WHITE); // shirt
  for (const x of [-0.22, 0.22]) put(cloth, box, v(x, 1.25, 0.12), v(0.09, 0.09, 0.55), WHITE); // arms reaching for the bars
  put(body, ball, v(0, 1.68, -0.15), v(0.22, 0.25, 0.23), SKIN); // head
  put(body, box, v(0, 0.92, 0.0), v(0.36, 0.14, 0.45), PANTS); // thighs
  for (const x of [-0.12, 0.12]) put(body, box, v(x, 0.62, 0.2), v(0.12, 0.5, 0.12), PANTS); // shins
  for (const x of [-0.22, 0.22]) put(body, ball, v(x, 1.25, 0.42), v(0.08, 0.08, 0.08), SKIN); // hands
  if (hat === 'non') put(body, cone, v(0, 1.86, -0.15), v(0.62, 0.28, 0.62), C('#d8c48c'));
  else if (hat === 'coi') { put(body, ball, v(0, 1.8, -0.15), v(0.34, 0.2, 0.38), C('#4e6b3a')); put(body, tube, v(0, 1.74, -0.15), v(0.46, 0.03, 0.5), C('#4e6b3a')); }
  else put(body, ball, v(0, 1.74, -0.15), v(0.3, 0.26, 0.32), C('#a51f24')); // a helmet
  return { cloth: cloth.build(), body: body.build() };
}

/** Someone far away: a standing figure, enough to read as a person on an alley thirty metres off. */
export function walker() {
  const b = new Builder();
  put(b, box, v(0, 1.18, 0), v(0.4, 0.6, 0.24), WHITE);
  put(b, farHead, v(0, 1.6, 0), v(0.22, 0.25, 0.23), SKIN);
  for (const x of [-0.1, 0.1]) put(b, box, v(x, 0.45, 0), v(0.13, 0.9, 0.14), PANTS);
  for (const x of [-0.25, 0.25]) put(b, box, v(x, 1.15, 0), v(0.09, 0.55, 0.1), WHITE);
  return b.build();
}

/** One car of the train: the dark green engine, or a blue carriage with its row of windows. */
export function trainCar(engine, length) {
  const b = new Builder();
  const body = engine ? C('#2f5d50') : C('#3a6ea5');
  put(b, box, v(0, 2.0, 0), v(2.7, 2.6, length - 0.6), body);
  put(b, box, v(0, 3.45, 0), v(2.5, 0.3, length - 0.8), engine ? C('#24443b') : C('#d9d6cc'));
  put(b, box, v(0, 0.95, 0), v(2.6, 0.12, length - 0.6), C('#f2b705'));
  put(b, box, v(0, 0.6, 0), v(2.2, 0.5, length - 1.2), C('#222222'));
  for (const z of [-(length / 2 - 1.6), length / 2 - 1.6]) {
    for (const x of [-0.5, 0.5]) put(b, tube, v(x, 0.42, z), v(0.84, 0.12, 0.84), C('#151515'), sideways);
  }
  const windows = engine ? [length / 2 - 1.2] : Array.from({ length: Math.floor((length - 2) / 1.6) }, (_, k) => -length / 2 + 1.6 + k * 1.6);
  for (const z of windows) for (const x of [-1.36, 1.36]) put(b, box, v(x, 2.35, z), v(0.04, 0.8, 1.0), C('#cfe3ea'));
  return b.build();
}

/** A plastic stool (red or blue by the instance colour) and the low table beside it. */
export function stool() {
  const b = new Builder();
  put(b, box, v(0, 0.42, 0), v(0.3, 0.04, 0.3), WHITE);
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) put(b, box, v(x, 0.2, z), v(0.04, 0.4, 0.04), WHITE);
  return b.build();
}
