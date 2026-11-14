// How your character moves, as pure maths (node:test): speed that builds up and dies away, a facing that
// turns at a limited rate, the blend of the idle, walk and run clips that keeps the feet from sliding, and the
// small state machine that names what the body is doing. No DOM, no three.js.
import { turnTowards } from './coords.js';

/** Top speeds (m/s): a stroll, a jog (a stick pushed most of the way), a run (Shift). */
export const GAIT = { walk: 1.5, jog: 2.7, run: 4.3 };

/**
 * The clips as measured on the soldier rig (1.832 m tall, scripts/shot.js --do): the ground speed each was
 * made for (the stance foot's speed under the hips), a cycle's length in seconds, and the phase (0..1) at
 * which the left foot is furthest forward, so walk and run can be kept in step.
 */
export const CLIP = { height: 1.832, walk: { speed: 1.733, seconds: 1.0333, left: 0.19 }, run: { speed: 4.444, seconds: 0.7, left: 0.285 } };

const ACCEL = 6.5; // m/s² from rest
const DECEL = 9; // m/s² when the stick is let go: a short, firm stop
const TURN_STILL = 11; // rad/s when standing
const TURN_RUN = 5.5; // rad/s at a full run: wider curves
const PIVOT = 1.9; // rad: asked to turn further than this at speed, slow down first

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angleBetween = (a, b) => Math.abs(((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);

/**
 * One step of motion. `m` = { speed, heading }; `input` = { x, z, top }: the wanted direction on the ground
 * (already camera-relative, length 0..1) and the top speed of the gait. Returns a new { speed, heading, turn,
 * target } (`turn` = how far the facing still has to go, radians). The body moves the way it faces.
 */
export function stepMotion(m, input, dt) {
  const push = Math.min(1, Math.hypot(input.x, input.z));
  const wanted = push > 0.05 ? Math.atan2(input.x, input.z) : m.heading;
  const turn = push > 0.05 ? angleBetween(m.heading, wanted) : 0;
  const pivot = turn > PIVOT && m.speed > 1 ? 0.35 : 1; // a turn on the heel: brake, turn, go
  const target = push * input.top * pivot;
  const gain = ACCEL * (1 - 0.45 * clamp(m.speed / GAIT.run, 0, 1)); // quick off the mark, gentler near the top
  const speed = target > m.speed ? Math.min(target, m.speed + gain * dt) : Math.max(target, m.speed - DECEL * dt);
  const rate = TURN_STILL + (TURN_RUN - TURN_STILL) * clamp(m.speed / GAIT.run, 0, 1);
  const heading = push > 0.05 ? turnTowards(m.heading, wanted, rate * dt) : m.heading;
  return { speed, heading, turn: angleBetween(heading, wanted), target };
}

/**
 * The 1D blend space: for a ground speed and a character height, the clip weights and how fast the cycle
 * turns, chosen so that the distance covered in one cycle equals the blended stride (feet do not slide).
 * Returns { idle, walk, run, period, stride }: `period` = seconds for one full cycle of both moving clips
 * (they share a phase), `stride` = metres covered by that cycle's blended pose.
 */
export function blendSpace(speed, height = CLIP.height) {
  const k = height / CLIP.height;
  const vw = CLIP.walk.speed * k;
  const vr = CLIP.run.speed * k;
  const [Tw, Tr] = [CLIP.walk.seconds, CLIP.run.seconds];
  const [Lw, Lr] = [vw * Tw, vr * Tr];
  const s = Math.max(0, speed);
  if (s < 0.03) return { idle: 1, walk: 0, run: 0, period: Tw, stride: 0 };
  if (s <= vw) { // idle into walk: short steps at half cadence first, then the full stride at a rising cadence
    const walk = clamp(s / (0.5 * vw), 0, 1);
    const stride = walk * Lw;
    return { idle: 1 - walk, walk, run: 0, period: stride / s, stride };
  }
  if (s >= vr) return { idle: 0, walk: 0, run: 1, period: Lr / s, stride: Lr }; // faster than the clip: quicker legs
  const run = clamp((s * Tw - Lw) / ((Lr - Lw) - s * (Tr - Tw)), 0, 1); // the weight whose own speed is s
  const stride = (1 - run) * Lw + run * Lr;
  return { idle: 0, walk: 1 - run, run, period: stride / s, stride };
}

/** Metres the feet would slide over one cycle at this speed (0 when the blend is exact). */
export const slidePerStride = (speed, height) => { const b = blendSpace(speed, height); return Math.abs(speed * b.period - b.stride); };

// ---------------- what the body is doing ----------------

export const ANIM = ['idle', 'fidget', 'walk', 'jog', 'run', 'start', 'stop', 'turn', 'sit', 'stand'];
const FIDGET_AFTER = 7; // seconds of standing still before looking around
const FIDGET_FOR = 3.2;
const STAND_FOR = 0.55;
const gaitOf = (speed) => (speed > 3.4 ? 'run' : speed > 2 ? 'jog' : 'walk');

/**
 * The animation state machine. `a` = { name, t } (seconds in that state); `ctx` = { speed, target, turn, sit }.
 * Returns the next { name, t }. Never mutates.
 */
export function nextAnim(a, ctx, dt) {
  const t = a.t + dt;
  const to = (name) => (name === a.name ? { name, t } : { name, t: 0 });
  if (ctx.sit) return to('sit');
  if (a.name === 'sit') return to('stand');
  if (a.name === 'stand' && t < STAND_FOR) return { name: 'stand', t };
  const moving = ctx.speed > 0.15;
  const wants = ctx.target > 0.1;
  if (moving && !wants) return to('stop');
  if (moving) {
    const fromRest = ['idle', 'fidget', 'turn', 'stand', 'stop'].includes(a.name) || (a.name === 'start' && t < 0.28);
    return to(fromRest && ctx.speed < 0.75 * ctx.target ? 'start' : gaitOf(ctx.speed));
  }
  if (wants) return to('start');
  if (ctx.turn > 0.35 || (a.name === 'turn' && ctx.turn > 0.06)) return to('turn');
  if (a.name === 'fidget') return t < FIDGET_FOR ? { name: 'fidget', t } : { name: 'idle', t: 0 };
  if (a.name === 'idle' && t > FIDGET_AFTER) return { name: 'fidget', t: 0 };
  return to('idle');
}

/**
 * The small things laid over the clips for a state: `lean` (radians, forward +: into a start, back out of a
 * stop), `look` (the head glancing left and right while fidgeting), `shift` (weight from foot to foot),
 * `sit` (0 standing .. 1 seated), `shuffle` (a little of the walk clip while turning on the spot).
 */
export function poseFor(a, speed = 0) {
  const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
  const base = { lean: clamp(speed / GAIT.run, 0, 1) * 0.1, look: 0, shift: 0, sit: 0, shuffle: 0 };
  if (a.name === 'start') return { ...base, lean: base.lean + 0.12 * Math.sin(Math.PI * clamp(a.t / 0.35, 0, 1)) };
  if (a.name === 'stop') return { ...base, lean: base.lean - 0.1 * Math.sin(Math.PI * clamp(a.t / 0.3, 0, 1)) };
  if (a.name === 'turn') return { ...base, shuffle: 0.45 };
  if (a.name === 'fidget') {
    const env = Math.sin(Math.PI * clamp(a.t / FIDGET_FOR, 0, 1));
    return { ...base, look: Math.sin(a.t * 2.1) * 0.55 * env, shift: Math.sin(a.t * 1.3) * env };
  }
  if (a.name === 'sit') return { ...base, lean: 0, sit: ease(a.t / 0.5) };
  if (a.name === 'stand') return { ...base, lean: 0.1 * Math.sin(Math.PI * clamp(a.t / STAND_FOR, 0, 1)), sit: 1 - ease(a.t / STAND_FOR) };
  return base;
}
