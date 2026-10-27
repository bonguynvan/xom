// A Vietnamese tube house front, side-on in facade units (ground on HOUSE_BASE; buildings.js shrinks it onto
// the map): lime-washed walls streaked with moss, green louvred shutters, iron "chuồng cọp" cages bolted round
// the windows, wavy wrought-iron balconies, washing on poles, a bird cage, the national flag on its pole,
// a blue house number, a hand-painted sign, and a folding iron gate or wooden doors at street level.
// Every choice comes from noise(x, …), so a house always looks the same.
import { FONT, INK, roundedPath, shade, shape, stroke, thinLine } from './duavit/paint.js';
import { noise } from './rng.js';

export const HOUSE_BASE = 226;
export const FLOOR = 46;
const SHUTTER = '#2f7d5b';
const IRON = '#3a3f4b';
const HAND_SIGNS = ['Cắt tóc gội đầu', 'Bơm vá xe', 'Giải khát', 'Nhận may đo', 'Sửa ti vi', 'Phô tô', 'Bánh cuốn', 'Sửa xe đạp', 'Nhà có chó dữ', 'Trông xe'];

function mossStreaks(ctx, x, w, top) {
  ctx.fillStyle = 'rgba(70, 80, 50, 0.16)';
  for (let k = 0; k < 5; k += 1) {
    const sx = x + 4 + noise(x, k, 31) * (w - 12);
    const sy = top + 2 + Math.floor(noise(x, k, 33) * 3) * FLOOR;
    const len = Math.min(20 + noise(x, k, 32) * 70, HOUSE_BASE - sy - 2); // stays on the wall
    if (len > 4) ctx.fillRect(sx, sy, 3 + noise(x, k, 34) * 6, len);
  }
}

function louvredShutters(ctx, wx, wy) {
  shape(ctx, SHUTTER, () => ctx.rect(wx, wy, 13, 26), 1.5);
  shape(ctx, SHUTTER, () => ctx.rect(wx + 13, wy, 13, 26), 1.5);
  thinLine(ctx, shade(SHUTTER, -0.3), 1, () => { for (let y = wy + 4; y < wy + 25; y += 3.5) { ctx.moveTo(wx + 2, y); ctx.lineTo(wx + 24, y); } });
}

function openWindow(ctx, wx, wy) {
  shape(ctx, '#2b2d42', () => ctx.rect(wx, wy, 26, 26), 2);
  shape(ctx, SHUTTER, () => ctx.rect(wx - 8, wy, 8, 26), 1.5);
  shape(ctx, SHUTTER, () => ctx.rect(wx + 26, wy, 8, 26), 1.5);
}

/** The iron cage people bolt round a window for a little more room (and safety). */
function tigerCage(ctx, wx, wy) {
  shape(ctx, '#2b2d42', () => ctx.rect(wx, wy, 26, 26), 2);
  shape(ctx, '#4caf50', () => roundedPath(ctx, wx + 4, wy + 16, 10, 8, 3), 1);
  stroke(ctx, IRON, 1.6, () => {
    ctx.rect(wx - 5, wy - 4, 36, 34);
    for (let k = wx - 5; k <= wx + 31; k += 6) { ctx.moveTo(k, wy - 4); ctx.lineTo(k, wy + 30); }
    ctx.moveTo(wx - 5, wy + 13);
    ctx.lineTo(wx + 31, wy + 13);
  });
}

/** Wrought-iron balcony with a row of loops, the 1990s favourite. */
function balcony(ctx, x, w, fy) {
  stroke(ctx, IRON, 1.5, () => {
    ctx.moveTo(x + 4, fy - 12);
    ctx.lineTo(x + w - 4, fy - 12);
    for (let r = x + 10; r < x + w - 8; r += 10) { ctx.moveTo(r + 4, fy - 6); ctx.arc(r, fy - 6, 4, 0, Math.PI * 2); }
  });
}

function washingPole(ctx, x, w, fy, k) {
  const side = noise(x, k, 41) < 0.5;
  const px = side ? x + w : x;
  const out = side ? 30 : -30;
  stroke(ctx, '#8d6e4f', 1.6, () => { ctx.moveTo(px, fy - 30); ctx.lineTo(px + out, fy - 34); });
  ['#ef476f', '#f4f1ea', '#2d9cdb', '#ffd23f'].forEach((col, n) => {
    shape(ctx, col, () => ctx.rect(px + (out * (n + 0.6)) / 4 - 4, fy - 33 + n * 0.4, 8, 12), 1);
  });
}

function birdCage(ctx, cx, fy) {
  thinLine(ctx, INK, 1, () => { ctx.moveTo(cx, fy - 44); ctx.lineTo(cx, fy - 38); });
  shape(ctx, '#d9b25f', () => { ctx.moveTo(cx - 6, fy - 26); ctx.lineTo(cx - 6, fy - 34); ctx.quadraticCurveTo(cx, fy - 42, cx + 6, fy - 34); ctx.lineTo(cx + 6, fy - 26); ctx.closePath(); }, 1.2);
}

/** Hoa giấy spilling over a balcony in magenta clouds. */
function bougainvillea(ctx, x, w, fy) {
  const left = noise(x, fy, 42) < 0.5;
  const bx = left ? x + 4 : x + w - 34;
  for (let k = 0; k < 9; k += 1) {
    ctx.fillStyle = k % 3 ? '#d63384' : '#4f9a4f';
    ctx.beginPath();
    ctx.arc(bx + noise(x, fy, k, 43) * 30, fy - 14 + noise(x, fy, k, 44) * 22, 4 + noise(x, fy, k, 45) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The national flag on a slanting pole, as on every house on a holiday. */
function flag(ctx, x, fy) {
  stroke(ctx, '#8d6e4f', 1.6, () => { ctx.moveTo(x, fy - 6); ctx.lineTo(x + 26, fy - 34); });
  shape(ctx, '#da251d', () => ctx.rect(x + 18, fy - 48, 24, 16), 1.2);
  ctx.fillStyle = '#ffde00';
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const r = k % 2 ? 2.4 : 6;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(x + 30 + Math.cos(a) * r, fy - 40 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function houseNumber(ctx, x, w) {
  shape(ctx, '#2d5aa0', () => roundedPath(ctx, x + w - 22, HOUSE_BASE - 52, 16, 9, 2), 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + w - 18, HOUSE_BASE - 48.5, 8, 2);
}

/** A sign painted by hand on a board: white, red letters, slightly crooked. */
function handSign(ctx, text, x, y, w) {
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.rotate((noise(x, 51) - 0.5) * 0.06);
  shape(ctx, '#f6f1e3', () => ctx.rect(-w / 2, -8, w, 16), 1.5);
  ctx.fillStyle = '#c1121f';
  ctx.font = `800 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1, w - 4);
  ctx.restore();
}

/** Tube house body. Returns the top of the parapet. */
export function tubeHouse(ctx, place, floors, color) {
  const { x, w } = place;
  const top = HOUSE_BASE - floors * FLOOR - 10;
  shape(ctx, color, () => ctx.rect(x, top, w, HOUSE_BASE - top));
  for (let k = 0; k < 4; k += 1) { // peeling patches of older lime wash
    ctx.fillStyle = shade(color, -0.1);
    ctx.beginPath();
    ctx.ellipse(x + 8 + noise(x, k, 1) * (w - 30), top + 10 + noise(x, k, 2) * (HOUSE_BASE - top - 40), 6 + noise(x, k, 3) * 8, 3 + noise(x, k, 4) * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  mossStreaks(ctx, x, w, top);
  shape(ctx, shade(color, -0.22), () => ctx.rect(x - 3, top - 6, w + 6, 8), 2); // parapet
  if (noise(x, 61) < 0.4) thinLine(ctx, shade(color, -0.35), 1.2, () => { for (let b = x + 4; b < x + w - 2; b += 6) { ctx.moveTo(b, top - 6); ctx.lineTo(b, top + 2); } });
  for (let f = 1; f < floors; f += 1) {
    const fy = HOUSE_BASE - f * FLOOR;
    const cols = w > 115 ? 2 : 1;
    for (let c = 0; c < cols; c += 1) {
      const wx = x + (w / (cols + 1)) * (c + 1) - 13;
      const kind = noise(x, f, c, 7);
      if (kind < 0.35) louvredShutters(ctx, wx, fy - 38);
      else if (kind < 0.6) tigerCage(ctx, wx, fy - 38);
      else openWindow(ctx, wx, fy - 38);
    }
    shape(ctx, shade(color, -0.25), () => ctx.rect(x - 2, fy, w + 4, 5), 1.5); // floor slab sticking out
    if (noise(x, f, 5) < 0.55) balcony(ctx, x, w, fy);
    if (noise(x, f, 6) < 0.4) washingPole(ctx, x, w, fy, f);
    if (noise(x, f, 8) < 0.2) birdCage(ctx, x + w * 0.25, fy);
    if (noise(x, f, 9) < 0.18) bougainvillea(ctx, x, w, fy);
  }
  if (floors > 1 && noise(x, 62) < 0.35) flag(ctx, x + w - 10, HOUSE_BASE - FLOOR);
  return top;
}

/** Street level of a plain house: a folding iron gate half open, or old wooden doors; number and maybe a sign. */
export function groundFloor(ctx, x, w) {
  const gx = x + 12;
  const gw = w - 24;
  if (noise(x, 63) < 0.6) {
    shape(ctx, '#3d405b', () => ctx.rect(gx, HOUSE_BASE - 40, gw, 40), 2);
    shape(ctx, '#ffd970', () => ctx.rect(gx + gw * 0.55, HOUSE_BASE - 38, gw * 0.4, 38), 1.5);
    thinLine(ctx, '#9aa0aa', 1.2, () => { for (let k = gx + 4; k < gx + gw * 0.55; k += 5) { ctx.moveTo(k, HOUSE_BASE - 40); ctx.lineTo(k, HOUSE_BASE); } });
  } else {
    const wood = noise(x, 64) < 0.5 ? '#2d6a8f' : '#3f7d4f';
    shape(ctx, wood, () => ctx.rect(gx, HOUSE_BASE - 40, gw, 40), 2);
    thinLine(ctx, shade(wood, -0.3), 1.2, () => {
      for (let k = 1; k < 4; k += 1) { ctx.moveTo(gx + (gw * k) / 4, HOUSE_BASE - 40); ctx.lineTo(gx + (gw * k) / 4, HOUSE_BASE); }
      ctx.rect(gx + 4, HOUSE_BASE - 34, gw - 8, 12);
    });
  }
  houseNumber(ctx, x, w);
  if (noise(x, 65) < 0.3) handSign(ctx, HAND_SIGNS[Math.floor(noise(x, 66) * HAND_SIGNS.length)], gx, HOUSE_BASE - 50, Math.min(gw, 86));
}
