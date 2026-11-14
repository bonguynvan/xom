import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/js/vendor/three/three.module.min.js';
import { MIXAMO, RENDERPEOPLE, adoptSkeleton, borrowClip } from '../public/js/3d/retarget.js';

const bone = (name, parent, [x, y, z], euler = [0, 0, 0]) => {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  b.rotation.set(...euler);
  parent.add(b);
  return b;
};

/** A Mixamo-like source: a turned, centimetre-scaled node with hips, spine and one leg under it. */
function source() {
  const scene = new THREE.Group();
  const character = new THREE.Group();
  character.rotation.x = -Math.PI / 2;
  character.scale.setScalar(0.01);
  scene.add(character);
  const hips = bone('mixamorigHips', character, [0, 0, 100], [Math.PI / 2, 0, 0]);
  bone('mixamorigSpine', hips, [0, 10, 0]);
  bone('mixamorigLeftLeg', bone('mixamorigLeftUpLeg', hips, [10, -5, 0], [Math.PI, 0, 0]), [0, 45, 0]);
  return scene;
}

/** The same body on a skeleton with other names and other axes, a root bone above the hips and a twist bone nothing maps to. */
function target() {
  const scene = new THREE.Group();
  const armature = new THREE.Group();
  armature.scale.setScalar(0.02);
  scene.add(armature);
  const root = bone('root', armature, [0, 0, 0], [0.3, 0.2, 0]);
  const hip = bone('hip', root, [0, 40, 12], [0, 0.4, 1.2]);
  const spine = bone('spine_01', hip, [6, 0, 0], [0.1, 0, 0]);
  const thigh = bone('upperleg_l', hip, [-1, 0, -5], [0, 0, 0.7]);
  const shin = bone('lowerleg_l', thigh, [-20, 0, 0]);
  const twist = bone('upperleg_twist_l', thigh, [-10, 0, 0], [0.5, 0, 0]);
  const bones = [root, hip, spine, thigh, shin, twist];
  scene.updateMatrixWorld(true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  armature.add(mesh);
  mesh.bind(new THREE.Skeleton(bones));
  const hair = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); // a second mesh on the same skeleton, as clothes and hair are
  armature.add(hair);
  hair.bind(mesh.skeleton);
  return { scene, bones, mesh };
}

const worldQ = (o) => o.getWorldQuaternion(new THREE.Quaternion());
const worldP = (o) => o.getWorldPosition(new THREE.Vector3());
const same = (a, b, eps = 1e-6) => a.toArray().every((v, k) => Math.abs(v - b.toArray()[k]) < eps);
const sameTurn = (a, b) => Math.abs(Math.abs(a.dot(b)) - 1) < 1e-9;

test('the bone map covers the body and both hands, each target bone once', () => {
  const names = Object.values(RENDERPEOPLE);
  assert.equal(new Set(names).size, names.length);
  for (const n of ['hip', 'spine_03', 'head', 'upperarm_r', 'lowerleg_l', 'ball_r', 'thumb_03_l', 'pinky_01_r']) assert.ok(names.includes(n), n);
  assert.equal(RENDERPEOPLE.RightForeArm, 'lowerarm_r');
  assert.equal(MIXAMO.RightForeArm, 'mixamorigRightForeArm');
  assert.deepEqual(Object.keys(MIXAMO), Object.keys(RENDERPEOPLE));
});

test('an adopted skeleton keeps every joint and its skin where they were, with the source\'s names and axes', () => {
  const from = source();
  const { scene, bones, mesh } = target();
  const before = bones.map((b) => ({ p: worldP(b), q: worldQ(b), skin: b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[bones.indexOf(b)]) }));
  const fit = adoptSkeleton(scene, from);
  scene.updateMatrixWorld(true);
  from.updateMatrixWorld(true);
  bones.forEach((b, k) => {
    assert.ok(same(worldP(b), before[k].p), `${b.name} moved`);
    const skin = b.matrixWorld.clone().multiply(mesh.skeleton.boneInverses[k]);
    assert.ok(skin.elements.every((v, e) => Math.abs(v - before[k].skin.elements[e]) < 1e-6), `${b.name}: the skin moved`);
  });
  assert.deepEqual(bones.map((b) => b.name), ['root', 'mixamorigHips', 'mixamorigSpine', 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', 'upperleg_twist_l']);
  assert.deepEqual([...fit.names].sort(), ['mixamorigHips', 'mixamorigLeftLeg', 'mixamorigLeftUpLeg', 'mixamorigSpine']);
  for (const name of fit.names) assert.ok(sameTurn(worldQ(scene.getObjectByName(name)), worldQ(from.getObjectByName(name))), name);
  assert.ok(sameTurn(worldQ(bones[0]), before[0].q), 'what the hips hang from is left alone');
  assert.ok(sameTurn(worldQ(bones[5]), before[5].q), 'a bone with no counterpart keeps its own axes');
});

test('after adopting, the source\'s rotations mean the same on both: every mapped bone turns the same way in the world', () => {
  const from = source();
  const { scene } = target();
  const fit = adoptSkeleton(scene, from);
  const pose = { mixamorigHips: [0.2, 0.5, -0.1], mixamorigSpine: [0.4, 0, 0.3], mixamorigLeftUpLeg: [-0.9, 0.2, 0], mixamorigLeftLeg: [1.1, 0, 0] };
  // the source is posed, a clip is made of that pose, and the target plays the borrowed clip
  for (const [name, e] of Object.entries(pose)) from.getObjectByName(name).quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...e)));
  from.updateMatrixWorld(true);
  const held = new THREE.AnimationClip('Pose', 1, Object.keys(pose).map((name) => {
    const q = from.getObjectByName(name).quaternion.toArray();
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [...q, ...q]);
  }));
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(borrowClip(held, fit)).play();
  mixer.update(0.5);
  scene.updateMatrixWorld(true);
  for (const name of fit.names) assert.ok(sameTurn(worldQ(scene.getObjectByName(name)), worldQ(from.getObjectByName(name))), name);
});

test('a borrowed clip keeps the rotations of the bones the skeleton has and scales the rise of the hips', () => {
  const from = source();
  const { scene } = target();
  const fit = adoptSkeleton(scene, from);
  assert.ok(Math.abs(fit.hips.scale - (worldP(scene.getObjectByName('mixamorigHips')).y / 1) * (0.01 / 0.02)) < 1e-9, 'hip height ratio, in the target\'s units');
  scene.updateMatrixWorld(true);
  const clip = new THREE.AnimationClip('Walk', 1, [
    new THREE.QuaternionKeyframeTrack('mixamorigSpine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new THREE.QuaternionKeyframeTrack('mixamorigRightArm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new THREE.VectorKeyframeTrack('mixamorigSpine.position', [0, 1], [0, 10, 0, 0, 10, 0]),
    new THREE.VectorKeyframeTrack('mixamorigSpine.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
    new THREE.VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 0, 100, 0, 0, 104]),
  ]);
  const out = borrowClip(clip, fit);
  assert.deepEqual(out.tracks.map((t) => t.name), ['mixamorigSpine.quaternion', 'mixamorigHips.position']);
  const v = out.tracks[1].values;
  const rest = fit.hips.to;
  assert.ok(Math.abs(v[0] - rest.x) < 1e-4 && Math.abs(v[1] - rest.y) < 1e-4 && Math.abs(v[2] - rest.z) < 1e-4, 'at rest in the source, at rest here'); // tracks are float32
  const rise = new THREE.Vector3(0, 0, 4).applyQuaternion(fit.hips.turn).multiplyScalar(fit.hips.scale).add(rest); // 4 up the source's hips' frame, said in this one
  assert.ok(Math.abs(v[3] - rise.x) < 1e-4 && Math.abs(v[4] - rise.y) < 1e-4 && Math.abs(v[5] - rise.z) < 1e-4);
  // in the world it is the same rise, scaled: straight up
  const up = (k) => scene.getObjectByName('root').localToWorld(new THREE.Vector3(v[k], v[k + 1], v[k + 2]));
  const lifted = up(3).sub(up(0));
  assert.ok(Math.abs(lifted.x) < 1e-6 && Math.abs(lifted.z) < 1e-6 && lifted.y > 0, JSON.stringify(lifted.toArray()));
  assert.equal(clip.tracks[4].values[5], 104, 'the source clip is left alone');
  assert.equal(out.duration, 1);
});
