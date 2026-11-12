// Who and what is within reach, as pure maths (node:test): the plastic stools you can sit on, the neighbour
// nearest to greet, and how far the head may turn towards someone talking. No DOM, no three.js.
import { M, toX, toZ } from './coords.js';

export const SEAT_REACH = 1.5; // metres from which a stool can be taken
export const GREET_REACH = 3;
export const STOOL_TOP = 0.44; // metres (models.js stool)
const HEAD_YAW = 1.15; // radians the head and neck turn at most
const HEAD_PITCH = 0.4;

/**
 * Every stool in the xóm: round the quán cóc tables and in the clusters on the pavements. Metres:
 * { X, Z, y (the ground it stands on), heading (facing its table) }.
 */
export function seatsOf(places, clusters, kerb = 0.14) {
  const facing = (s, cx, cy) => Math.atan2(cx - s.x, cy - s.y);
  const quan = places.filter((p) => p.kind === 'quanCoc').flatMap((p) => p.spots.map((s) => ({ X: toX(s.x), Z: toZ(s.y), y: 0.02, heading: facing(s, p.cx, p.cy) })));
  const pavement = clusters.flatMap((c) => c.stools.map((s) => ({ X: toX(s.x), Z: toZ(s.y), y: kerb, heading: facing(s, c.x, c.y) })));
  return [...quan, ...pavement];
}

/**
 * The nearest free stool within reach of (X, Z), or null. `sitters` = [{ x, y }] in map units (the people
 * already seated): a stool with one of them on it is taken.
 */
export function nearestSeat(seats, X, Z, sitters = [], reach = SEAT_REACH) {
  let best = null;
  for (const s of seats) {
    const d = Math.hypot(s.X - X, s.Z - Z);
    if (d > reach || (best && d >= best.d)) continue;
    if (sitters.some((p) => Math.hypot(toX(p.x) - s.X, toZ(p.y) - s.Z) < 3 * M)) continue;
    best = { ...s, d };
  }
  return best;
}

/** The nearest of `people` ([{ key, X, Z, … }]) within reach of (X, Z), with its distance `d`; or null. */
export function nearestPerson(people, X, Z, reach = GREET_REACH) {
  let best = null;
  for (const p of people) {
    const d = Math.hypot(p.X - X, p.Z - Z);
    if (d <= reach && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}

/**
 * How the head turns to look at a point: { yaw, pitch } relative to the body (yaw + = to the body's left),
 * clamped to what a neck can do; zeros when the point is behind or too close to matter.
 * `eye` = { x, y, z }, `heading` = the body's facing, `target` = { x, y, z }.
 */
export function headTurn(eye, heading, target) {
  if (!target) return { yaw: 0, pitch: 0 };
  const dx = target.x - eye.x;
  const dz = target.z - eye.z;
  const flat = Math.hypot(dx, dz);
  if (flat < 0.25) return { yaw: 0, pitch: 0 };
  const yaw = ((Math.atan2(dx, dz) - heading + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  if (Math.abs(yaw) > 2) return { yaw: 0, pitch: 0 }; // behind: do not wring the neck
  const pitch = Math.atan2(target.y - eye.y, flat);
  return { yaw: Math.max(-HEAD_YAW, Math.min(HEAD_YAW, yaw)), pitch: Math.max(-HEAD_PITCH, Math.min(HEAD_PITCH, pitch)) };
}
