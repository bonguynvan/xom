// The street's sound as pure maths (node:test): what is underfoot, when a foot lands, how a footstep, an
// engine and a street vendor's call are made of oscillators and noise, which of many sources get a voice,
// how loud the beds are by hour and weather, and how the bus ducks when the loudspeaker talks.
// sound3d.js turns these numbers into Web Audio nodes. Nothing here is recorded: every sound is synthesised.
import { ROAD_HALF, ROAD_LINE, nodesNear, yOn } from '../map.js';

export const PAVE_OUT = 34; // map units from the road's centre line to the pavement's outer edge (terrain.js uses the same)

/** What you are walking on at a map point: 'road' (asphalt), 'tiles' (the pavement), 'concrete' (an alley) or 'earth'. */
export function surfaceKind(x, y) {
  const d = Math.abs(y - yOn(ROAD_LINE, x));
  if (d <= ROAD_HALF) return 'road';
  if (d < PAVE_OUT) return 'tiles';
  return nodesNear({ x, y }, 9).length > 0 ? 'concrete' : 'earth';
}

const LANDINGS = [0.05, 0.55]; // the stride phases at which the left and the right foot land (avatar.js: phase 0 = the left foot furthest forward)

/** The feet that land as the stride phase goes from `before` to `after` (0..1, wrapping): [] | ['L'] | ['R'] | both. */
export function footfalls(before, after) {
  if (before === after) return [];
  const crossed = (at) => (after > before ? before < at && at <= after : before < at || at <= after);
  return LANDINGS.map((at, k) => (crossed(at) ? 'LR'[k] : null)).filter(Boolean);
}

/**
 * A footstep on a surface at a speed (m/s): a burst of noise through a band-pass at `freq` (Hz) with quality
 * `q`, `gain` 0..1, dying in `decay` seconds, with a `thump` (0..1) of low sine under it.
 */
export function footstep(kind, speed = 1.5) {
  const push = Math.max(0.5, Math.min(1.6, speed / 1.5));
  const base = {
    road: { freq: 1700, q: 0.9, gain: 0.16, decay: 0.07, thump: 0.35 },
    tiles: { freq: 2600, q: 1.6, gain: 0.2, decay: 0.05, thump: 0.25 },
    concrete: { freq: 2100, q: 1.1, gain: 0.18, decay: 0.06, thump: 0.3 },
    earth: { freq: 650, q: 0.6, gain: 0.13, decay: 0.11, thump: 0.5 },
  }[kind] ?? { freq: 1500, q: 1, gain: 0.15, decay: 0.07, thump: 0.3 };
  return { ...base, gain: Math.min(0.4, base.gain * push), thump: Math.min(1, base.thump * push) };
}

/** A two-stroke engine's firing frequency (Hz) for a ground speed (m/s): idling when stopped, rising with speed. */
export const enginePitch = (speed, kind = 'cub') => (kind === 'cub' ? 46 : 38) + Math.max(0, Math.min(12, speed)) * 9;

/** How loud a point source is at a distance (metres): full within `ref`, inverse distance beyond, silent past `max`. */
export const gainAt = (distance, ref = 3, max = 45) => (distance >= max ? 0 : Math.min(1, ref / Math.max(ref, distance)) * (1 - (distance / max) ** 2));

/**
 * Give `count` voices to the sources nearest the listener. `sources` = [{ id, x, z }], `held` = the ids that
 * have a voice now: a holder keeps its voice unless a newcomer is clearly (20 %) nearer, so voices do not
 * flap between two bikes at the same distance. Returns the ids, nearest first.
 */
export function pickVoices(sources, listener, count, held = new Set()) {
  return sources
    .map((s) => { const d = Math.hypot(s.x - listener.x, s.z - listener.z); return { id: s.id, d, rank: held.has(s.id) ? d * 0.8 : d }; })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .sort((a, b) => a.d - b.d)
    .map((s) => s.id);
}

/**
 * The beds by hour (0..24) and weather: { birds, crickets, rain, tin, crowd } each 0..1. Birds at dawn and in
 * the day, crickets at night, rain and its patter on corrugated iron when it rains, the murmur of a busy street.
 */
export function ambience(hour, weather = 'clear') {
  const h = ((hour % 24) + 24) % 24;
  const bump = (centre, width) => Math.max(0, 1 - Math.abs(h - centre) / width);
  const wet = weather === 'rain' ? 0.75 : weather === 'storm' ? 1 : 0;
  const day = h > 5.5 && h < 18.5 ? 1 : 0;
  return {
    birds: Math.max(bump(6, 2.2), day * 0.35) * (1 - wet),
    crickets: (h > 19 || h < 4.5 ? 0.7 : bump(18.8, 0.8) * 0.7) * (1 - wet * 0.8),
    rain: wet,
    tin: wet * 0.8,
    crowd: Math.max(bump(7.5, 2.5), bump(17.5, 2.5), day * 0.3) * (1 - wet * 0.6),
  };
}

/** The bus level while the loudspeaker talks: eases to 0.4, and back to 1 afterwards. Returns the next level. */
export const duck = (level, speaking, dt) => level + ((speaking ? 0.4 : 1) - level) * Math.min(1, dt * (speaking ? 6 : 1.5));

const PENTA = [0, 2, 4, 7, 9]; // ngũ cung, in semitones
/**
 * A street vendor's call without words: 3-5 notes of the pentatonic scale, the last one drawn out and
 * falling, the way a cry of "ai … đây" carries down an alley. Returns [{ at, hz, seconds, fall }].
 */
export function vendorCall(seed) {
  const pick = (k) => Math.abs(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453) % 1;
  const base = 196 * 2 ** (Math.floor(pick(0) * 5) / 12);
  const count = 3 + Math.floor(pick(1) * 3);
  const out = [];
  let at = 0;
  for (let k = 0; k < count; k += 1) {
    const last = k === count - 1;
    const seconds = last ? 0.9 + pick(k + 10) * 0.5 : 0.22 + pick(k + 10) * 0.16;
    out.push({ at, hz: base * 2 ** (PENTA[Math.floor(pick(k + 20) * PENTA.length)] / 12), seconds, fall: last ? 0.82 : 1 });
    at += seconds + 0.04;
  }
  return out;
}
