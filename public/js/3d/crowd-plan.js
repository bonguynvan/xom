// How the crowd is shown, as pure maths (node:test): which of three ways each person is drawn (a skinned
// character near you, a picture of one in the middle distance, a few boxes far away) without flickering at the
// borders, which picture of the sheet a middle-distance person shows, and the small step neighbours take
// round you. Presentation only: the simulation never hears of any of it.

export const MID_REACH = 62; // metres: nearer than this (and not skinned) a person is a picture of a character
const BAND = 6; // metres of hysteresis at that border

/** 'mid' or 'far' for someone `d` metres away who was `was` last frame: the border has a band, so nobody flickers on it. */
export const tierOf = (d, was = 'far') => (d < MID_REACH - (was === 'mid' ? 0 : BAND / 2) ? 'mid' : d > MID_REACH + (was === 'mid' ? BAND / 2 : 0) ? 'far' : was);

export const SHEET = { dirs: 8, frames: 4, rows: 5, cols: 16 }; // per rig: 8 directions across; 4 walk frames and an idle row up

/**
 * Which cell of the sheet shows a person: they face `yaw` (0 = +Z, turning towards +X), the camera is at
 * angle `toCamera` from them (same convention), `phase` 0..1 through their stride, `woman` picks the right
 * half of the sheet. Returns { col, row }.
 */
export function cellOf(yaw, toCamera, phase, moving, woman = false) {
  const turn = ((toCamera - yaw) / (Math.PI * 2)) % 1;
  const dir = Math.round(((turn + 1) % 1) * SHEET.dirs) % SHEET.dirs;
  const row = moving ? Math.floor((((phase % 1) + 1) % 1) * SHEET.frames) % SHEET.frames : SHEET.frames;
  return { col: dir + (woman ? SHEET.dirs : 0), row };
}

/**
 * A neighbour at (X, Z) and you at (px, pz): if they would stand inside `r` metres of you they are shown
 * pushed out to that distance (straight away from you; to your right if they are exactly on you). Smooth at
 * the border. Returns a new { X, Z }.
 */
export function sidestep(X, Z, px, pz, r = 0.75) {
  const dx = X - px;
  const dz = Z - pz;
  const d = Math.hypot(dx, dz);
  if (d >= r) return { X, Z };
  if (d < 1e-6) return { X: px + r, Z: pz };
  return { X: px + (dx / d) * r, Z: pz + (dz / d) * r };
}

/**
 * The pose of someone on a saddle: thigh and shin angles (radians about the body's side axis, the thigh up
 * forward is negative) for each leg, the arms reaching for the bars, a slight lean. `phase` turns the pedals
 * when `pedal` is true (a bicycle or a cyclo); on a motorbike the legs are still.
 */
export function ridePose(phase, pedal) {
  const a = pedal ? Math.sin(phase) * 0.42 : 0;
  return {
    left: { thigh: -1.15 + a, shin: 1.2 - a * 0.9 },
    right: { thigh: -1.15 - a, shin: 1.2 + a * 0.9 },
    arm: -1.05, fore: -0.25, lean: 0.22,
  };
}

/** Hands while talking: the upper arm and forearm angles and a nod, for a clock (seconds) and a per-person offset. */
export function talkPose(clock, k = 0) {
  return { arm: -0.35 - 0.2 * Math.sin(clock * 2.6 + k), fore: -0.9 + 0.45 * Math.sin(clock * 4.3 + k * 1.7), nod: 0.07 * Math.sin(clock * 3.7 + k) };
}
