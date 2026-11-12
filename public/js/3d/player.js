// Your own character and the camera. Two ways to look: "ngắm" (an orbit camera over the xóm that drifts by
// itself when left alone) and "đi" (walking your character, the camera on a spring arm behind one shoulder).
// The maths is in pure modules: locomotion.js (speed, facing, the animation states), capsule.js (sliding along
// walls), camera-rig.js (the arm, the swept sphere that keeps the lens out of walls, smoothing), interact.js.
import * as THREE from '../vendor/three/three.module.min.js';
import { slide, settle } from './capsule.js';
import { ARM, FOV, LENS, PITCH, SHOULDER, bobAt, damp, dampAngle, dirOf, easeArm, fovAt, place, recentre, sweep } from './camera-rig.js';
import { toMap, toX, toZ, turnTowards } from './coords.js';
import { FLY_SECONDS, ease, flyPose } from './flyin.js';
import { createInput } from './input.js';
import { headTurn } from './interact.js';
import { GAIT, nextAnim, poseFor, stepMotion } from './locomotion.js';
import { surfaceY } from './terrain.js';
import { MAP } from '../map.js';

const RADIUS = 0.3; // your body on the ground (wider than the camera's sphere, so the lens always fits where you do)
const EYE = 0.86; // the camera looks at this share of your height
const BOUNDS = { x0: toX(6), x1: toX(MAP.w - 6), z0: toZ(54), z1: toZ(MAP.h - 4) };
const OVERVIEW = { min: 8, max: 170 };

export function createControls({ camera, dom, body, scene, index, ponds, onAction = () => {} }) {
  const avatar = body.group; // the dressed character (avatar.js)
  avatar.visible = false;
  scene.add(avatar);

  const state = {
    mode: 'ngam',
    focus: new THREE.Vector3(toX(640), 0, toZ(330)),
    yaw: -0.5,
    pitch: 0.75,
    dist: 70,
    pos: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    anim: { name: 'idle', t: 0 },
    seat: null, // the stool you are on (interact.js seatsOf)
    drift: 1,
    fly: null, // { t, seconds, from, to }: the camera coming down from the sky
    effects: true, // the sprint's wider view and the gentle bob
  };
  const input = createInput({ dom, canLock: () => state.mode === 'di' && !state.fly, onAction });
  let arm = state.dist; // the camera's distance as drawn (state.dist is what is wanted)
  let ground = { y: 0, v: 0 }; // your feet, eased over the kerb
  let head = null; // the point the camera follows, eased: { x, y, z } with velocities
  let yawV = 0;
  let fov = { value: FOV.base, v: 0 };
  let sinceLook = 0;
  const tmp = new THREE.Vector3();
  const clampFocus = () => {
    state.focus.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, state.focus.x));
    state.focus.z = Math.max(BOUNDS.z0 - 10, Math.min(BOUNDS.z1, state.focus.z));
  };
  const groundAt = (X, Z) => { const m = toMap(X, Z); return surfaceY(m.x, m.y); };

  // ---------------- modes ----------------
  function walk(at) {
    state.mode = 'di';
    const spot = at ?? state.focus;
    const p = settle(spot.x, spot.z, RADIUS, index, ponds, BOUNDS);
    state.pos.set(p.X, 0, p.Z);
    state.dist = ARM.start;
    state.pitch = 0.3;
    state.fly = null;
    state.seat = null;
    state.speed = 0;
    state.anim = { name: 'idle', t: 0 };
    ground = { y: groundAt(p.X, p.Z), v: 0 };
    head = null;
    arm = state.dist;
    avatar.visible = true;
  }
  /**
   * Come down from the sky to behind the shoulder of the character standing at `spot` (metres) and facing
   * `heading`. `seconds` = 0 cuts straight there (prefers-reduced-motion). Input waits until it lands.
   */
  function fly(spot, heading, seconds = FLY_SECONDS) {
    const from = { x: state.focus.x, y: 0, z: state.focus.z, yaw: state.yaw, pitch: 1.25, dist: Math.max(110, state.dist) };
    walk(spot);
    state.heading = heading;
    const eye = { x: state.pos.x, y: ground.y + body.height * EYE, z: state.pos.z };
    const to = { ...eye, yaw: heading - Math.PI, pitch: 0.34, dist: ARM.start };
    // Land where the camera has room: straight behind if it can, else further round, never squeezed by a wall.
    let best = -1;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6]) {
      const free = sweep(eye, dirOf(heading - Math.PI + off, to.pitch), to.dist + 0.4, LENS, index);
      if (free > best + 0.3) { best = free; to.yaw = heading - Math.PI + off; }
      if (free >= to.dist + 0.4) break;
    }
    if (seconds <= 0) { state.yaw = to.yaw; state.pitch = to.pitch; state.dist = to.dist; return; }
    state.fly = { t: 0, seconds, from, to };
  }
  function look() {
    state.mode = 'ngam';
    state.fly = null;
    state.seat = null;
    state.focus.copy(state.pos);
    state.dist = Math.max(state.dist, 40);
    state.pitch = 0.75;
    avatar.visible = false;
    input.unlock();
    if (Math.abs(camera.fov - FOV.base) > 0.01) { camera.fov = FOV.base; camera.updateProjectionMatrix(); }
    fov = { value: FOV.base, v: 0 };
  }
  /** Sit down on a stool (interact.js nearestSeat), or stand up with null. */
  function sit(seat) { if (state.mode === 'di' && !state.fly) state.seat = seat; }

  // ---------------- each frame ----------------
  /** `eyes` = a point { x, y, z } worth looking at (someone talking nearby), or null. */
  function update(dt, now, eyes = null) {
    const inp = input.read(dt);
    const free = !state.fly;
    if (free) {
      state.yaw -= inp.yaw;
      const [lo, hi] = state.mode === 'di' ? [PITCH.min, PITCH.max] : [0.08, 1.45];
      state.pitch = Math.max(lo, Math.min(hi, state.pitch + inp.pitch));
      const [near, far] = state.mode === 'di' ? [ARM.min, ARM.max] : [OVERVIEW.min, OVERVIEW.max];
      state.dist = Math.max(near, Math.min(far, state.dist * inp.zoom));
    }
    sinceLook = inp.looked ? 0 : sinceLook + dt;
    // forward is where the camera looks, right is to its right; W is -z
    const mx = -Math.sin(state.yaw) * -inp.z + Math.cos(state.yaw) * inp.x;
    const mz = -Math.cos(state.yaw) * -inp.z - Math.sin(state.yaw) * inp.x;
    if (state.mode === 'di') walking(dt, free ? { x: mx, z: mz, analog: inp.analog, run: inp.run } : { x: 0, z: 0, analog: false, run: false }, eyes);
    else overview(dt, now, inp, mx, mz);
  }

  function walking(dt, push, eyes) {
    const strength = Math.hypot(push.x, push.z);
    if (state.seat && strength > 0.3) state.seat = null; // any push stands you up
    if (state.seat) {
      state.speed = 0;
      state.pos.x += (state.seat.X - state.pos.x) * Math.min(1, dt * 8);
      state.pos.z += (state.seat.Z - state.pos.z) * Math.min(1, dt * 8);
      state.heading = turnTowards(state.heading, state.seat.heading, dt * 6);
      state.anim = nextAnim(state.anim, { speed: 0, target: 0, turn: 0, sit: true }, dt);
    } else {
      const busy = state.anim.name === 'stand'; // getting up: feet stay put for a moment
      const top = push.run ? GAIT.run : push.analog ? GAIT.jog : GAIT.walk;
      const m = stepMotion({ speed: state.speed, heading: state.heading }, busy ? { x: 0, z: 0, top } : { ...push, top }, dt);
      state.speed = m.speed;
      state.heading = m.heading;
      if (state.speed > 0.01) {
        const p = slide(state.pos.x, state.pos.z, Math.sin(state.heading) * state.speed * dt, Math.cos(state.heading) * state.speed * dt, RADIUS, index, ponds, BOUNDS);
        state.pos.set(p.X, 0, p.Z);
        if (p.blocked > 0.6) state.speed *= 1 - Math.min(1, dt * 6) * p.blocked; // face-on into a wall: stop pushing
      }
      state.anim = nextAnim(state.anim, { speed: state.speed, target: m.target, turn: m.turn, sit: false }, dt);
    }
    const pose = poseFor(state.anim, state.speed);
    // the kerb is 0.14 m: the feet ease up it instead of popping
    const floor = state.seat ? state.seat.y : groundAt(state.pos.x, state.pos.z);
    [ground.y, ground.v] = damp(ground.y, ground.v, floor, 0.09, dt);
    avatar.position.set(state.pos.x, ground.y, state.pos.z);
    avatar.rotation.y = state.heading;
    const height = body.height;
    const eye = { x: state.pos.x, y: ground.y + height * (EYE - 0.24 * pose.sit), z: state.pos.z };
    body.update(dt, { speed: state.speed, pose, look: state.fly ? { yaw: 0, pitch: 0 } : headTurn({ ...eye, y: ground.y + height * 0.93 }, state.heading, eyes) });

    // ---- the camera ----
    if (!head) head = { x: eye.x, y: eye.y, z: eye.z, vx: 0, vy: 0, vz: 0 };
    [head.x, head.vx] = damp(head.x, head.vx, eye.x, 0.05, dt);
    [head.z, head.vz] = damp(head.z, head.vz, eye.z, 0.05, dt);
    [head.y, head.vy] = damp(head.y, head.vy, eye.y, 0.14, dt);
    let shoulder = SHOULDER;
    let collide = true;
    if (state.fly) {
      state.fly.t += dt / state.fly.seconds;
      const p = flyPose(state.fly.t, state.fly.from, { ...state.fly.to, x: eye.x, y: eye.y, z: eye.z });
      Object.assign(head, { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0 });
      state.yaw = p.yaw;
      state.pitch = p.pitch;
      state.dist = p.dist;
      shoulder = SHOULDER * ease(state.fly.t);
      collide = state.fly.t > 0.6; // high in the sky there is nothing between you and the camera
      if (state.fly.t >= 1) { state.fly = null; sinceLook = 0; }
    } else if (!input.locked) { // left alone while you walk, the view comes round behind you
      const behind = recentre(state.yaw, state.heading, sinceLook, state.speed);
      if (behind === null) yawV = 0;
      else [state.yaw, yawV] = dampAngle(state.yaw, yawV, behind, 1.2, dt);
    }
    const run = fovAt(state.speed, GAIT.run, state.effects);
    [fov.value, fov.v] = damp(fov.value, fov.v, run, 0.35, dt);
    if (Math.abs(camera.fov - fov.value) > 0.01) { camera.fov = fov.value; camera.updateProjectionMatrix(); }
    const bob = bobAt(body.phase, state.speed, GAIT.run, state.effects && !state.fly);
    const dir = dirOf(state.yaw, state.pitch);
    if (collide) {
      const rig = place(head, state.yaw, state.pitch, state.dist, index, { shoulder });
      arm = Math.max(0.35, easeArm(Math.min(arm, state.dist), rig.arm, dt));
      state.focus.set(rig.pivot.x, rig.pivot.y, rig.pivot.z);
    } else {
      arm = state.dist;
      state.focus.set(head.x, head.y, head.z);
    }
    camera.position.set(state.focus.x + dir.x * arm, Math.max(state.focus.y + dir.y * arm, ground.y + 0.25) + bob.y, state.focus.z + dir.z * arm);
    camera.lookAt(tmp.set(state.focus.x, state.focus.y + bob.y * 0.5, state.focus.z));
  }

  function overview(dt, now, inp, mx, mz) {
    if (inp.panX || inp.panY) { // grab the ground: it follows the pointer
      const s = state.dist * 0.0016;
      const [fx, fz] = [-Math.sin(state.yaw), -Math.cos(state.yaw)];
      const [rx, rz] = [Math.cos(state.yaw), -Math.sin(state.yaw)];
      state.focus.x += (fx * inp.panY - rx * inp.panX) * s;
      state.focus.z += (fz * inp.panY - rz * inp.panX) * s;
    }
    if (Math.hypot(inp.x, inp.z) > 0) { // WASD pans the overview
      state.focus.x += mx * state.dist * 0.8 * dt;
      state.focus.z += mz * state.dist * 0.8 * dt;
    }
    if (now - input.touched > 7000) { // left alone: stroll along the xóm
      state.focus.x += state.drift * dt * 2.2;
      state.yaw += dt * 0.02;
      if (state.focus.x > BOUNDS.x1 - 25 || state.focus.x < BOUNDS.x0 + 25) state.drift *= -1;
    }
    clampFocus();
    state.focus.y = 0;
    const dir = dirOf(state.yaw, state.pitch);
    camera.position.copy(state.focus).addScaledVector(tmp.set(dir.x, dir.y, dir.z), state.dist);
    camera.position.y = Math.max(camera.position.y, 0.6);
    camera.lookAt(state.focus);
  }

  return { state, update, walk, look, fly, sit, joystick: input.joystick, avatar, unlock: input.unlock, get locked() { return input.locked; } };
}
