// Every character plays the same clips (public/models/clips.glb: a Mixamo skeleton with idle, walk and run),
// whatever skeleton it came with: another Mixamo download whose armature stands differently, or a
// Renderpeople scan (bones `hip`, `upperarm_l`, … each with its own axes). Rather than convert every clip,
// the skeleton is converted once at load: each bone that has a counterpart in the clips' skeleton is renamed
// after it and given that bone's axes in the T-pose, its joint staying where it is, and the skin's inverse
// bind matrices are rewritten to match, so nothing moves. After that a rotation track means the same thing on
// both skeletons, and everything that looks bones up by their Mixamo names (hats, sitting, the wave) finds them.
import * as THREE from '../vendor/three/three.module.min.js';

const SIDES = [['Left', 'l'], ['Right', 'r']];
const LIMBS = [['Shoulder', 'shoulder'], ['Arm', 'upperarm'], ['ForeArm', 'lowerarm'], ['Hand', 'hand'], ['UpLeg', 'upperleg'], ['Leg', 'lowerleg'], ['Foot', 'foot'], ['ToeBase', 'ball']];
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

/** Mixamo bone name (without its `mixamorig` prefix) -> Renderpeople bone name. */
export const RENDERPEOPLE = Object.freeze(Object.fromEntries([
  ['Hips', 'hip'], ['Spine', 'spine_01'], ['Spine1', 'spine_02'], ['Spine2', 'spine_03'], ['Neck', 'neck'], ['Head', 'head'],
  ...SIDES.flatMap(([S, s]) => [
    ...LIMBS.map(([M, r]) => [`${S}${M}`, `${r}_${s}`]),
    ...FINGERS.flatMap((F) => [1, 2, 3].map((k) => [`${S}Hand${F}${k}`, `${F.toLowerCase()}_0${k}_${s}`])),
  ]),
]));
/** The same bones on another Mixamo character (as GLTFLoader names them: `mixamorig:Hips` -> `mixamorigHips`). */
export const MIXAMO = Object.freeze(Object.fromEntries(Object.keys(RENDERPEOPLE).map((name) => [name, `mixamorig${name}`])));

const bonesOf = (root) => { const out = []; root.traverse((o) => { if (o.isBone) out.push(o); }); return out; }; // parents first

/**
 * Give `target`'s skeleton the names and axes of `source`'s (both scenes at the origin, facing the same
 * way, both in a T-pose; `restClip` puts the source in its T-pose first when its file pose is something else).
 * `map` = source bone name ending -> target bone name. Mutates `target`. Returns what `borrowClip` needs:
 * { names (the target's bones that now answer to a source name), hips: { name, from, to, scale, turn } }
 * (`turn` takes something said in the frame the source's hips hang in to the frame the target's hang in).
 */
export function adoptSkeleton(target, source, map = RENDERPEOPLE, restClip = null) {
  const mixer = restClip ? new THREE.AnimationMixer(source) : null;
  if (mixer) { mixer.clipAction(restClip).play(); mixer.update(0); }
  source.updateMatrixWorld(true);
  target.updateMatrixWorld(true);
  const from = bonesOf(source);
  const to = bonesOf(target);
  const was = new Map(to.map((b) => [b, b.matrixWorld.clone()]));
  const wanted = new Map(); // target bone -> the world rotation it should rest in
  const names = new Set();
  let hips = null;
  for (const [ending, name] of Object.entries(map)) {
    const s = from.find((b) => b.name === ending || b.name === `mixamorig${ending}` || b.name.endsWith(`:${ending}`)) ?? null;
    const t = to.find((b) => b.name === name) ?? null;
    if (!s || !t) continue;
    wanted.set(t, s.getWorldQuaternion(new THREE.Quaternion()));
    t.name = s.name;
    names.add(s.name);
    if (ending === 'Hips') hips = { s, t };
  }
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const m = new THREE.Matrix4();
  for (const b of to) {
    was.get(b).decompose(p, q, s);
    m.compose(p, wanted.get(b) ?? q, s);
    b.matrix.copy(b.parent.matrixWorld).invert().multiply(m);
    b.matrix.decompose(b.position, b.quaternion, b.scale);
    b.matrixWorld.copy(m);
  }
  const done = new Set(); // several meshes (body, hair, clothes) share one skeleton: its matrices are rewritten once
  target.traverse((o) => {
    if (!o.isSkinnedMesh || done.has(o.skeleton)) return;
    done.add(o.skeleton);
    o.skeleton.bones.forEach((b, k) => {
      if (was.has(b)) o.skeleton.boneInverses[k].premultiply(was.get(b)).premultiply(m.copy(b.matrixWorld).invert());
    });
  });
  target.updateMatrixWorld(true);
  let fit = null;
  if (hips) {
    const height = (b) => b.getWorldPosition(new THREE.Vector3()).y;
    const unit = (b) => b.parent.getWorldScale(new THREE.Vector3()).x || 1;
    const turn = hips.t.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hips.s.parent.getWorldQuaternion(new THREE.Quaternion()));
    fit = { name: hips.s.name, from: hips.s.position.clone(), to: hips.t.position.clone(), scale: (height(hips.t) / (height(hips.s) || 1)) * (unit(hips.s) / unit(hips.t)), turn };
  }
  if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(source); }
  return { names, hips: fit };
}

/**
 * The source rig's clip for a skeleton that went through `adoptSkeleton`: the rotations of the bones it
 * has (the hips' said in the frame they hang in here), and the hips' rise and fall scaled to its leg length.
 * Returns a new clip.
 */
export function borrowClip(clip, { names, hips }) {
  const tracks = [];
  const q = new THREE.Quaternion();
  const d = new THREE.Vector3();
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.');
    const [bone, what] = [t.name.slice(0, dot), t.name.slice(dot + 1)];
    if (!names.has(bone)) continue;
    if (what === 'quaternion') {
      const turned = t.clone();
      if (hips && bone === hips.name) {
        const v = turned.values;
        for (let k = 0; k < v.length; k += 4) q.fromArray(v, k).premultiply(hips.turn).toArray(v, k);
      }
      tracks.push(turned);
    }
    if (what === 'position' && hips && bone === hips.name) {
      const moved = t.clone();
      const v = moved.values;
      for (let k = 0; k < v.length; k += 3) d.fromArray(v, k).sub(hips.from).applyQuaternion(hips.turn).multiplyScalar(hips.scale).add(hips.to).toArray(v, k);
      tracks.push(moved);
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
