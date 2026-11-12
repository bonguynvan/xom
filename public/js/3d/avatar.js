// Your own character, dressed: one of the two rigs, tinted by the shirt colour, with headwear (nón lá, mũ cối,
// mũ phớt) and one thing carried (cloth bag, scarf, đòn gánh), all built in code. Used twice: on the plinth
// of the title screen and in the street. The clips are blended by ground speed (locomotion.js blendSpace: walk
// and run share one stride phase, so the feet do not slide); leaning, sitting, the head turning and the wave are
// added to the bones after the mixer.
import * as THREE from '../vendor/three/three.module.min.js';
import * as SkeletonUtils from '../vendor/three/SkeletonUtils.js';
import { STOOL_TOP } from './interact.js';
import { swing, waveArm } from './gesture.js';
import { CLIP, blendSpace } from './locomotion.js';
import { donGanh, nonLa } from './people3d.js';

const std = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

/** Mũ cối: the green pith helmet, a dome on an oval brim. */
function muCoi() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x55693a, 0.7));
  dome.scale.set(1, 0.9, 1.15);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.018, 22), std(0x4a5c33, 0.75));
  brim.scale.z = 1.2;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.137, 0.137, 0.022, 18, 1, true), std(0x6d7f4a, 0.7));
  band.scale.z = 1.15;
  band.position.y = 0.02;
  g.add(dome, brim, band);
  return g;
}

/** Mũ phớt: a felt hat with a pinched crown and a ribbon. */
function muPhot() {
  const g = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.12, 18), std(0x5a4636, 0.95));
  crown.position.y = 0.06;
  crown.scale.z = 1.12;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.014, 24), std(0x4d3b2d, 0.95));
  brim.scale.z = 1.1;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.127, 0.129, 0.03, 18, 1, true), std(0x2a211b, 0.8));
  ribbon.position.y = 0.022;
  ribbon.scale.z = 1.12;
  g.add(crown, brim, ribbon);
  return g;
}

/** Túi vải: a cloth bag on the hip, its strap across the chest. */
function tuiVai() {
  const g = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.26), std(0x8a7a52, 0.95));
  bag.position.set(-0.25, -0.42, 0.02);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.09, 0.27), std(0x74663f, 0.95));
  flap.position.set(-0.25, -0.33, 0.02);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.014, 5, 28), std(0x74663f, 0.9));
  strap.scale.set(0.62, 1, 0.5);
  strap.rotation.z = -0.62;
  strap.position.set(0, -0.12, 0.02);
  g.add(bag, flap, strap);
  return g;
}

/** Khăn quàng: a scarf round the neck with one end hanging in front. */
function khan() {
  const g = new THREE.Group();
  const mat = std(0xb23a48, 0.95);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.035, 6, 18), mat);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 1.15, 1);
  ring.position.y = 0.2;
  const end = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.26, 0.025), mat);
  end.position.set(0.05, 0.06, 0.12);
  end.rotation.z = 0.12;
  g.add(ring, end);
  return g;
}

const bone = (root, pattern) => { let found = null; root.traverse((o) => { if (!found && o.isBone && pattern.test(o.name)) found = o; }); return found; };

/** Hang a thing built in metres on a bone, whatever scale the rig's bones are in. */
function hang(on, thing, x, y, z) {
  const s = new THREE.Vector3();
  on.getWorldScale(s);
  const k = 1 / (s.x || 1);
  thing.scale.multiplyScalar(k);
  thing.position.set(x * k, y * k, z * k);
  thing.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  on.add(thing);
  return thing;
}

function makeBody(rig) {
  const root = SkeletonUtils.clone(rig.scene);
  const materials = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.castShadow = true;
    o.frustumCulled = false;
    materials.push({ mat: o.material, base: o.material.color.clone() });
  });
  root.updateMatrixWorld(true);
  const head = bone(root, /Head$/);
  const spine = bone(root, /Spine2$/);
  const hats = { nonLa: hang(head, nonLa(), 0, 0.2, 0.03), muCoi: hang(head, muCoi(), 0, 0.13, 0.02), muPhot: hang(head, muPhot(), 0, 0.14, 0.02) };
  hats.nonLa.traverse((o) => { o.castShadow = false; }); // a thin double-sided cone only speckles itself
  const pole = donGanh();
  pole.rotation.y = Math.PI / 2;
  const extras = { tuiVai: hang(spine, tuiVai(), 0, 0.1, 0), khan: hang(spine, khan(), 0, 0.02, 0.02), donGanh: hang(spine, pole, 0, 0.12, 0) };
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(Object.entries(rig.clips).map(([k, c]) => [k, mixer.clipAction(c)]));
  for (const a of Object.values(actions)) { a.play(); a.setEffectiveWeight(0); }
  actions.idle.setEffectiveWeight(1);
  for (const name of ['walk', 'run']) actions[name].setEffectiveTimeScale(0); // their time is set from the stride phase
  const bones = Object.fromEntries(['RightArm', 'RightForeArm', 'Spine', 'Neck', 'Head', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'Hips'].map((n) => [n, bone(root, new RegExp(`${n}$`))]));
  return { rig, root, materials, hats, extras, mixer, actions, bones };
}

export function createAvatar(rigs) {
  const group = new THREE.Group();
  const bodies = {};
  let body = null;
  let wave = 0; // 0..1, how far the greeting arm is up
  let waving = 0; // seconds left
  let clock = 0;
  let phase = 0; // 0..1 through one stride cycle; 0 = the left foot furthest forward
  const look = { yaw: 0, pitch: 0 };
  const tint = new THREE.Color();
  const white = new THREE.Color('#ffffff');
  const q = new THREE.Quaternion();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  /** Wear this choice ({ rig, height, color, hat, extra } from select-state's choiceOf). */
  function set(choice) {
    const name = rigs[choice.rig] ? choice.rig : 'man';
    if (!bodies[name]) { bodies[name] = makeBody(rigs[name]); group.add(bodies[name].root); }
    body = bodies[name];
    for (const b of Object.values(bodies)) b.root.visible = b === body;
    body.root.scale.setScalar(choice.height / body.rig.height);
    tint.set(choice.color).lerp(white, 0.35);
    for (const m of body.materials) m.mat.color.copy(m.base).multiply(tint);
    for (const [id, hat] of Object.entries(body.hats)) hat.visible = id === choice.hat;
    for (const [id, thing] of Object.entries(body.extras)) thing.visible = id === choice.extra;
  }
  const heightNow = () => (body ? body.root.scale.x * body.rig.height : 1.7);

  /**
   * Advance the animation. `drive` = { speed (m/s over the ground), pose (locomotion.js poseFor), look
   * ({ yaw, pitch } for the head, interact.js headTurn) }; with none the character stands idle (the title screen).
   */
  function update(dt, drive = {}) {
    if (!body) return;
    const { speed = 0, pose = { lean: 0, look: 0, shift: 0, sit: 0, shuffle: 0 }, look: wanted = { yaw: 0, pitch: 0 } } = drive;
    clock += dt;
    const height = heightNow();
    const blend = blendSpace(speed, height * body.rig.stride); // the woman's legs take the borrowed clips a little shorter
    const walk = Math.max(blend.walk, pose.shuffle) * (1 - pose.sit);
    const run = blend.run * (1 - pose.sit);
    const period = blend.stride > 0 ? blend.period : CLIP.walk.seconds * 1.15; // turning on the spot: an easy shuffle
    if (walk + run > 0.001) phase = (phase + dt / period) % 1;
    const { actions, bones } = body;
    actions.idle.setEffectiveWeight(Math.max(0, 1 - walk - run));
    actions.walk.setEffectiveWeight(walk);
    actions.run.setEffectiveWeight(run);
    actions.walk.time = ((phase + CLIP.walk.left) % 1) * CLIP.walk.seconds;
    actions.run.time = ((phase + CLIP.run.left) % 1) * CLIP.run.seconds;
    body.mixer.update(dt);

    // on top of the clips: lean, sit, the head, the wave
    const k = Math.min(1, dt * 9);
    look.yaw += (wanted.yaw + pose.look - look.yaw) * k;
    look.pitch += (wanted.pitch - look.pitch) * k;
    body.root.position.set(pose.shift * 0.025, -pose.sit * Math.max(0, 0.534 * height - (STOOL_TOP + 0.09)), -pose.sit * 0.08);
    const posed = Math.abs(pose.lean) > 0.002 || pose.sit > 0.002 || Math.abs(look.yaw) > 0.002 || Math.abs(look.pitch) > 0.002;
    if (posed) {
      group.updateMatrixWorld(true);
      side.set(1, 0, 0).applyQuaternion(group.getWorldQuaternion(q)); // turning about this tips the body forward
      if (bones.Spine) { swing(bones.Spine, side, pose.lean + pose.sit * 0.12); bones.Spine.updateMatrixWorld(true); }
      if (pose.sit > 0.002) {
        for (const leg of ['Left', 'Right']) {
          const [thigh, shin] = [bones[`${leg}UpLeg`], bones[`${leg}Leg`]];
          if (!thigh || !shin) continue;
          swing(thigh, side, -1.5 * pose.sit); // the thigh comes up level
          thigh.updateMatrixWorld(true);
          swing(shin, side, 1.5 * pose.sit); // the shin hangs back down
        }
      }
      for (const b of [bones.Neck, bones.Head]) {
        if (!b) continue;
        b.parent.updateMatrixWorld(true);
        swing(b, up, look.yaw / 2);
        swing(b, side, -look.pitch / 2);
      }
    }
    waving = Math.max(0, waving - dt);
    wave += ((waving > 0 ? 1 : 0) - wave) * Math.min(1, dt * 7);
    waveArm(group, bones.RightArm, bones.RightForeArm, wave, clock);
  }

  return {
    group, set, update,
    /** Raise the right hand and wave for a moment. */
    wave(seconds = 1.8) { waving = seconds; },
    get height() { return heightNow(); },
    /** 0..1 through the stride (two steps): the camera's bob follows it. */
    get phase() { return phase; },
  };
}
