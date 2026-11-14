// The third-person camera as pure maths (node:test): a spring arm from a point by your shoulder back to the
// camera, shortened by a sphere swept against the buildings so the lens is never inside a wall, critically
// damped smoothing, re-centring behind you when the view is left alone, and the small sprint effects.
// No three.js. Angles: the camera sits at pivot + dir(yaw, pitch) * arm, dir = (sin yaw cos p, sin p, cos yaw cos p).
import { boxesIn } from './capsule.js';

export const LENS = 0.28; // metres: the radius of the sphere swept for the camera
export const SHOULDER = 0.42; // metres the pivot stands to the right of the head
export const ARM = { min: 1.6, max: 12, start: 4.4 };
export const PITCH = { min: -0.3, max: 1.35 };
export const FOV = { base: 50, kick: 6 };
const RECENTRE_AFTER = 2.6; // seconds without touching the view
const DEFAULT_H = 9; // a box with no height is taken to be this tall

/**
 * Critically damped spring towards a target (no overshoot, frame-rate independent): returns [value, velocity].
 * `time` is roughly how long it takes to get there.
 */
export function damp(value, velocity, target, time, dt) {
  const omega = 2 / Math.max(1e-4, time);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = value - target;
  const temp = (velocity + omega * change) * dt;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

const shortWay = (from, to) => from + (((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);

/** `damp` for an angle, the short way round. */
export const dampAngle = (value, velocity, target, time, dt) => damp(value, velocity, shortWay(value, target), time, dt);

export const dirOf = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });
/** The camera's right-hand side on the ground for a yaw. */
export const rightOf = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

/**
 * Sweep a sphere of `radius` from `from` along the unit vector `dir` for at most `far` metres: how far its
 * centre gets before the sphere touches a building (a box x0..x1, z0..z1 from the ground up to h). `far` if
 * nothing is in the way; 0 if it starts already touching.
 */
export function sweep(from, dir, far, radius, index) {
  const tx = from.x + dir.x * far;
  const tz = from.z + dir.z * far;
  let best = far;
  for (const b of boxesIn(index, Math.min(from.x, tx) - radius, Math.min(from.z, tz) - radius, Math.max(from.x, tx) + radius, Math.max(from.z, tz) + radius)) {
    const lo = [b.x0 - radius, -Infinity, b.z0 - radius];
    const hi = [b.x1 + radius, (b.h ?? DEFAULT_H) + radius, b.z1 + radius];
    const o = [from.x, from.y, from.z];
    const d = [dir.x, dir.y, dir.z];
    let t0 = 0;
    let t1 = best;
    for (let a = 0; a < 3 && t0 <= t1; a += 1) { // the slab test against the box grown by the radius
      if (Math.abs(d[a]) < 1e-9) { if (o[a] <= lo[a] || o[a] >= hi[a]) t0 = Infinity; continue; }
      const u = (lo[a] - o[a]) / d[a];
      const v = (hi[a] - o[a]) / d[a];
      t0 = Math.max(t0, Math.min(u, v));
      t1 = Math.min(t1, Math.max(u, v));
    }
    if (t0 <= t1) best = Math.min(best, t0);
  }
  return Math.max(0, best);
}

/**
 * Where the camera goes: from the head, step sideways to the shoulder (less if a wall is there, less still
 * when the arm is short), then back along the view as far as the swept sphere allows.
 * `head` = { x, y, z }; returns { pivot, arm, position } (plain objects).
 */
export function place(head, yaw, pitch, wanted, index, { shoulder = SHOULDER, radius = LENS, floor = 0.3 } = {}) {
  const r = rightOf(yaw);
  const side = shoulder * Math.max(0, Math.min(1, (wanted - 1.2) / 2));
  const reach = side > 0.01 ? Math.max(0, sweep(head, { x: r.x, y: 0, z: r.z }, side, radius, index) - 0.02) : 0; // a hair short of the wall
  const pivot = { x: head.x + r.x * reach, y: head.y, z: head.z + r.z * reach };
  const dir = dirOf(yaw, pitch);
  let arm = sweep(pivot, dir, wanted, radius, index);
  if (dir.y < 0) arm = Math.min(arm, Math.max(0, (pivot.y - floor) / -dir.y)); // looking up from below: stay above the ground
  return { pivot, arm, position: { x: pivot.x + dir.x * arm, y: pivot.y + dir.y * arm, z: pivot.z + dir.z * arm } };
}

/** The arm as drawn: it comes in at once when something is in the way and eases back out afterwards. */
export const easeArm = (shown, allowed, dt) => (allowed < shown ? allowed : shown + (allowed - shown) * Math.min(1, dt * 4.5));

/**
 * The yaw the camera drifts to when the view is left alone while you walk: round behind you. Returns the
 * target yaw, or null when it should stay (the view was touched lately, you stand still, or you are walking
 * towards the camera, where turning it would turn you).
 */
export function recentre(yaw, heading, sinceLook, speed) {
  if (sinceLook < RECENTRE_AFTER || speed < 0.6) return null;
  const behind = heading + Math.PI;
  const off = Math.abs(shortWay(yaw, behind) - yaw);
  return off < 0.05 || off > 2.2 ? null : shortWay(yaw, behind);
}

/** Field of view (degrees) at a ground speed: a little wider at a run. `on` = false turns the kick off. */
export const fovAt = (speed, runSpeed, on = true) => FOV.base + (on ? FOV.kick * Math.max(0, Math.min(1, (speed - runSpeed * 0.62) / (runSpeed * 0.38))) : 0);

/** The camera's gentle bob for a stride phase (0..1, two steps a cycle): { y, x } in metres. */
export function bobAt(phase, speed, runSpeed, on = true) {
  if (!on || speed < 0.2) return { x: 0, y: 0 };
  const k = Math.min(1, speed / runSpeed);
  return { x: Math.sin(phase * Math.PI * 2) * 0.012 * k, y: Math.abs(Math.sin(phase * Math.PI * 2)) * (0.012 + 0.022 * k) };
}
