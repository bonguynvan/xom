// Gamepad reading as pure functions: dead zones, and "just pressed" from two snapshots. The page polls
// navigator.getGamepads() each frame and hands the first pad here.

export const DEAD = 0.22;

/** A stick axis with the dead zone cut out and the rest stretched back to -1..1. */
export function axis(value, dead = DEAD) {
  const v = Number(value) || 0;
  const m = Math.abs(v);
  return m <= dead ? 0 : Math.sign(v) * Math.min(1, (m - dead) / (1 - dead));
}

const down = (pad, k) => Boolean(pad?.buttons?.[k]?.pressed);

/** What the pad says now, as plain booleans and numbers (standard mapping: 0 = A/✕, 1 = B/○, 2 = X/□, 7 = RT, 9 = Start, 10 = L3, 12-15 = d-pad). */
export function readPad(pad) {
  if (!pad) return { x: 0, y: 0, rx: 0, ry: 0, left: false, right: false, up: false, down: false, confirm: false, back: false, run: false, sit: false, menu: false };
  const x = axis(pad.axes?.[0]);
  const y = axis(pad.axes?.[1]);
  return {
    x, y,
    left: down(pad, 14) || x < -0.6, right: down(pad, 15) || x > 0.6, up: down(pad, 12) || y < -0.6, down: down(pad, 13) || y > 0.6,
    confirm: down(pad, 0), back: down(pad, 1),
    rx: axis(pad.axes?.[2]), ry: axis(pad.axes?.[3]), // the right stick looks round
    run: down(pad, 1) || down(pad, 7) || down(pad, 10), sit: down(pad, 2), menu: down(pad, 9), // B / RT / L3 runs, X sits, Start changes mode
  };
}

/** The buttons that went down between two readings (a held stick does not repeat). */
export function pressed(before, now) {
  return Object.fromEntries(['left', 'right', 'up', 'down', 'confirm', 'back', 'sit', 'menu'].map((k) => [k, Boolean(now[k]) && !before?.[k]]));
}
