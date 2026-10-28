// The public buildings of the xóm, side-on in facade units like the tube houses (ground on HOUSE_BASE;
// buildings.js shrinks them onto the map): the primary school with its long yellow corridors, the ward
// clinic with its red cross, and the ward office with its banner and flag. Each stands where a few
// houses would have been (places.js reserves the ground before the houses grow).
import { FONT, INK, circle, ellipse, roundedPath, shade, shape, stroke, thinLine } from './duavit/paint.js';
import { FLOOR, HOUSE_BASE } from './facade.js';

const GREEN = '#2f7d5b';

function board(ctx, text, cx, y, w, bg, fg, size) {
  shape(ctx, bg, () => roundedPath(ctx, cx - w / 2, y, w, size + 12, 3), 2);
  ctx.fillStyle = fg;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + (size + 12) / 2 + 1, w - 8);
}

function star(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 10; k += 1) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * (k % 2 ? r * 0.4 : r), cy + Math.sin(a) * (k % 2 ? r * 0.4 : r));
  }
  ctx.closePath();
  ctx.fill();
}

/** The national flag on a tall straight pole. */
function flagPole(ctx, x, top) {
  stroke(ctx, '#9aa0aa', 3, () => { ctx.moveTo(x, HOUSE_BASE); ctx.lineTo(x, top); });
  shape(ctx, '#da251d', () => ctx.rect(x + 2, top + 2, 42, 28), 1.5);
  star(ctx, x + 23, top + 16, 9, '#ffde00');
}

/** Body, parapet and floor slabs; returns the top of the wall. */
function body(ctx, x, w, floors, color) {
  const top = HOUSE_BASE - floors * FLOOR - 10;
  shape(ctx, color, () => ctx.rect(x, top, w, HOUSE_BASE - top));
  shape(ctx, shade(color, -0.22), () => ctx.rect(x - 3, top - 6, w + 6, 8), 2);
  for (let f = 1; f < floors; f += 1) shape(ctx, shade(color, -0.25), () => ctx.rect(x - 2, HOUSE_BASE - f * FLOOR, w + 4, 5), 1.5);
  return top;
}

/** Trường tiểu học: yellow walls, an open corridor on each floor with white columns and green classroom doors. */
function truong(ctx, p, floors) {
  const { x, w } = p;
  const wall = '#f2c94c';
  const top = body(ctx, x, w, floors, wall);
  const bays = Math.max(3, Math.round(w / 52));
  const bay = w / bays;
  for (let f = 0; f < floors; f += 1) {
    const fy = HOUSE_BASE - f * FLOOR; // floor level of this storey
    ctx.fillStyle = shade(wall, -0.18); // the shaded corridor
    ctx.fillRect(x + 6, fy - FLOOR + 10, w - 12, FLOOR - 12);
    for (let k = 0; k < bays; k += 1) {
      const bx = x + k * bay;
      if (k % 2 === 0) shape(ctx, GREEN, () => ctx.rect(bx + bay * 0.3, fy - 32, bay * 0.3, 30), 1.2); // a classroom door
      else shape(ctx, '#a8dadc', () => ctx.rect(bx + bay * 0.25, fy - 30, bay * 0.5, 16), 1.2); // a window
    }
    for (let k = 0; k <= bays; k += 1) shape(ctx, '#efe3c2', () => ctx.rect(x + k * bay - 3, fy - FLOOR + 6, 6, FLOOR - 6), 1.2);
    if (f > 0) thinLine(ctx, '#efe3c2', 2, () => { ctx.moveTo(x + 4, fy - 12); ctx.lineTo(x + w - 4, fy - 12); ctx.moveTo(x + 4, fy - 6); ctx.lineTo(x + w - 4, fy - 6); });
  }
  board(ctx, 'TRƯỜNG TIỂU HỌC', x + w / 2, top - 34, Math.min(w - 20, 190), '#2d5aa0', '#fff6e5', 15);
  // the low fence and the gate, the school drum by the door, the flag pole in the yard
  thinLine(ctx, '#3a3f4b', 1.5, () => {
    for (let k = x - 6; k < x + w + 6; k += 8) { if (Math.abs(k - (x + w / 2)) > 24) { ctx.moveTo(k, HOUSE_BASE + 14); ctx.lineTo(k, HOUSE_BASE); } }
    ctx.moveTo(x - 6, HOUSE_BASE + 4);
    ctx.lineTo(x + w / 2 - 24, HOUSE_BASE + 4);
    ctx.moveTo(x + w / 2 + 24, HOUSE_BASE + 4);
    ctx.lineTo(x + w + 6, HOUSE_BASE + 4);
  });
  ellipse(ctx, x + w / 2 + 40, HOUSE_BASE - 14, 10, 12, '#c1121f');
  ellipse(ctx, x + w / 2 + 40, HOUSE_BASE - 25, 9, 3, '#e9d18c');
  flagPole(ctx, x + 20, top - 70);
  // a red banner along the top corridor
  shape(ctx, '#c1121f', () => ctx.rect(x + w * 0.2, top + 4, w * 0.6, 12), 1);
  ctx.fillStyle = '#ffde00';
  ctx.font = `800 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THI ĐUA DẠY TỐT, HỌC TỐT', x + w / 2, top + 10.5, w * 0.58);
}

/** Trạm y tế phường: white walls, pale blue windows, the red cross, a bench for the patients. */
function tramYTe(ctx, p, floors) {
  const { x, w } = p;
  const wall = '#f1ece0';
  const top = body(ctx, x, w, floors, wall);
  for (let f = 1; f < floors; f += 1) {
    const fy = HOUSE_BASE - f * FLOOR;
    for (let k = 0; k < 3; k += 1) shape(ctx, '#a8dadc', () => ctx.rect(x + (w / 4) * (k + 1) - 13, fy - 36, 26, 24), 1.5);
  }
  shape(ctx, '#7fb7c9', () => ctx.rect(x + w / 2 - 22, HOUSE_BASE - 40, 44, 40), 2); // double door
  thinLine(ctx, shade('#7fb7c9', -0.3), 1.2, () => { ctx.moveTo(x + w / 2, HOUSE_BASE - 40); ctx.lineTo(x + w / 2, HOUSE_BASE); });
  [x + 20, x + w - 46].forEach((wx) => shape(ctx, '#a8dadc', () => ctx.rect(wx, HOUSE_BASE - 34, 26, 20), 1.5));
  board(ctx, 'TRẠM Y TẾ', x + w / 2 + 12, top - 30, Math.min(w - 40, 130), '#f6f1e3', '#c1121f', 14);
  const cx = x + w / 2 - Math.min(w - 40, 130) / 2 - 4;
  shape(ctx, '#fff', () => ctx.rect(cx - 13, top - 31, 26, 26), 1.5);
  ctx.fillStyle = '#da251d';
  ctx.fillRect(cx - 4, top - 27, 8, 18);
  ctx.fillRect(cx - 9, top - 22, 18, 8);
  shape(ctx, '#9aa0aa', () => roundedPath(ctx, x + 14, HOUSE_BASE + 4, 60, 6, 2)); // the bench
  stroke(ctx, '#7f8c8d', 3, () => { ctx.moveTo(x + 20, HOUSE_BASE + 10); ctx.lineTo(x + 20, HOUSE_BASE + 18); ctx.moveTo(x + 68, HOUSE_BASE + 10); ctx.lineTo(x + 68, HOUSE_BASE + 18); });
  shape(ctx, '#b85c38', () => roundedPath(ctx, x + w - 26, HOUSE_BASE - 12, 14, 12, 2), 1.2); // a potted plant
  circle(ctx, x + w - 19, HOUSE_BASE - 20, 9, '#4caf50');
}

/** UBND phường: pale yellow, columns at the door, a red banner and the flag on the roof. */
function uyBan(ctx, p, floors) {
  const { x, w } = p;
  const wall = '#f2d888';
  const top = body(ctx, x, w, floors, wall);
  for (let f = 1; f < floors; f += 1) {
    const fy = HOUSE_BASE - f * FLOOR;
    for (let k = 0; k < 4; k += 1) shape(ctx, GREEN, () => ctx.rect(x + (w / 5) * (k + 1) - 10, fy - 36, 20, 26), 1.5);
  }
  shape(ctx, shade(wall, -0.2), () => ctx.rect(x + w / 2 - 40, HOUSE_BASE - 44, 80, 44), 1.5); // the porch
  [-34, 28].forEach((dx) => shape(ctx, '#f6f1e3', () => ctx.rect(x + w / 2 + dx, HOUSE_BASE - 44, 6, 44), 1.2));
  shape(ctx, GREEN, () => ctx.rect(x + w / 2 - 18, HOUSE_BASE - 36, 36, 36), 1.5);
  board(ctx, 'UBND PHƯỜNG', x + w / 2, top - 30, Math.min(w - 24, 150), '#c1121f', '#ffde00', 14);
  shape(ctx, '#c1121f', () => ctx.rect(x + 10, HOUSE_BASE - FLOOR - 18, w - 20, 11), 1); // a banner over the porch
  ctx.fillStyle = '#ffde00';
  ctx.font = `800 8px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NHIỆT LIỆT CHÀO MỪNG', x + w / 2, HOUSE_BASE - FLOOR - 12, w - 24);
  flagPole(ctx, x + w - 24, top - 64);
  thinLine(ctx, INK, 1, () => { ctx.moveTo(x + 24, top - 6); ctx.lineTo(x + 24, top - 30); }); // a loudspeaker on the roof
  shape(ctx, '#9aa0aa', () => { ctx.moveTo(x + 24, top - 30); ctx.lineTo(x + 36, top - 36); ctx.lineTo(x + 36, top - 24); ctx.closePath(); }, 1);
}

export const CIVIC = { truong, tramYTe, uyBan };
