// Seeing each other walk, as pure maths (node:test), shared by the page and the server: what a move message
// may contain (the server trusts nothing), how fast anyone may go, when the page sends, and how the page
// draws a neighbour between the ten messages a second it hears: a little in the past, interpolated, and for a
// moment beyond the last message, extrapolated.
import { MAP } from '../map.js';
import { ANIM } from './locomotion.js';

export const SEND_MS = 100; // the page sends its place about ten times a second
export const MIN_GAP_MS = 60; // the server refuses messages from one page closer together than this
export const IDLE_GAP_MS = 3000; // after this long without a message a page may reappear anywhere (it was looking from above)
export const MAX_SPEED = 45; // map units a second: a run is 4.3 m/s = 28.7; this leaves room for a late message
export const SLACK = 4; // map units forgiven on every step (rounding, a frame's jitter)
export const BOUNDS = { x0: -40, x1: MAP.w + 40, y0: -20, y1: MAP.h + 40 };
export const BUFFER_MS = 100; // neighbours are drawn this far in the past
export const EXTRAPOLATE_MS = 250; // and may be carried on this long past their last message
const KEEP = 12; // samples kept for each neighbour

const round = (v, k) => Math.round(v * k) / k;

/**
 * A move as the server accepts it, or null: `x`, `y` map units (finite, inside the map), `h` a heading in
 * radians, `a` the name of an animation state. Everything else in the input is dropped.
 */
export function cleanMove(input) {
  if (!input || typeof input !== 'object') return null;
  const { x, y, h, a } = input;
  if (![x, y, h].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || y < BOUNDS.y0 || y > BOUNDS.y1) return null;
  if (Math.abs(h) > 100 || !ANIM.includes(a)) return null;
  return { x: round(x, 10), y: round(y, 10), h: round(Math.atan2(Math.sin(h), Math.cos(h)), 100), a };
}

/**
 * May someone who was at `last` ({ x, y, at } or null) be at `next` ({ x, y }) at time `now` (ms)? Anywhere on
 * a first move or after a long silence; otherwise no further than the speed limit allows for the time passed.
 */
export function withinReach(last, next, now) {
  if (!last) return true;
  const dt = now - last.at;
  if (dt >= IDLE_GAP_MS) return true;
  return Math.hypot(next.x - last.x, next.y - last.y) <= MAX_SPEED * (Math.max(0, dt) / 1000) + SLACK;
}

/**
 * Should the page send now? `sent` = { at, x, y, h, a } (the last message, or null), `state` = the same shape
 * for this moment: every SEND_MS while something changes, once a second while standing (so the server knows
 * the page is still there and others keep the last place).
 */
export function shouldSend(sent, state, now) {
  if (!sent) return true;
  const since = now - sent.at;
  if (since < SEND_MS) return false;
  const changed = Math.hypot(state.x - sent.x, state.y - sent.y) > 0.05 || Math.abs(state.h - sent.h) > 0.02 || state.a !== sent.a;
  return changed || since >= 1000;
}

/** Add a sample { t, x, y, h, a } to a neighbour's buffer (a new array, the newest `KEEP` kept, in order of t). */
export const pushMove = (buffer, sample) => [...buffer.filter((s) => s.t < sample.t), sample].slice(-KEEP);

const shortWay = (from, to) => from + (((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);

/**
 * Where a neighbour is drawn at `now` (ms, the page's clock): { x, y, h, a, speed } (speed in map units a
 * second) or null when the buffer is empty or its last message is too old to trust (`stale` ms).
 */
export function sampleMoves(buffer, now, stale = 5000) {
  if (buffer.length === 0) return null;
  const newest = buffer[buffer.length - 1];
  if (now - newest.t > stale) return null;
  const t = now - BUFFER_MS;
  if (t <= buffer[0].t) return { ...pick(buffer[0]), speed: 0 };
  for (let k = 1; k < buffer.length; k += 1) {
    const [a, b] = [buffer[k - 1], buffer[k]];
    if (t > b.t) continue;
    const f = (t - a.t) / Math.max(1, b.t - a.t);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, h: shortWay(a.h, b.h) * f + a.h * (1 - f), a: b.a, speed: speedOf(a, b) };
  }
  if (buffer.length < 2) return { ...pick(newest), speed: 0 };
  const prev = buffer[buffer.length - 2];
  const v = speedOf(prev, newest);
  const ahead = Math.min(EXTRAPOLATE_MS, t - newest.t) / 1000; // carried on briefly along the last heading of travel, then held
  const gap = Math.max(1, newest.t - prev.t) / 1000;
  return { x: newest.x + ((newest.x - prev.x) / gap) * ahead, y: newest.y + ((newest.y - prev.y) / gap) * ahead, h: newest.h, a: newest.a, speed: t - newest.t > EXTRAPOLATE_MS ? 0 : v };
}

const pick = ({ x, y, h, a }) => ({ x, y, h, a });
const speedOf = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) / (Math.max(1, b.t - a.t) / 1000);
