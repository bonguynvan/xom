// The 1990s xóm, part 1: shopkeepers and neighbours. Same conventions as duavit's painters
// (ctx, color, phase, moving, face): facing right, origin on the ground, ~100 units tall.
import { circle, ellipse, poly, roundedPath, shade, shape, stroke, swing, thinLine } from './duavit/paint.js';
import { SKIN, person } from './body.js';

const pajama = (ctx, x, top, h) => thinLine(ctx, 'rgba(29,26,47,0.35)', 1.2, () => {
  for (let k = -8; k <= 8; k += 5) { ctx.moveTo(x + k, top + 2); ctx.lineTo(x + k, top + h); }
});

function baTraDa(ctx, c, p, m, face) {
  // Round as a teapot, hair in a big bun, a palm-leaf fan going all day.
  const a = person(ctx, c, p, m, face, { legLen: 22, torsoW: 30, torsoH: 32, belly: 14, headR: 13, pants: '#2b2d42', hand: [20, -42] });
  ellipse(ctx, a.headX - 9, a.headY - 8, 9, 8, '#2b2d42');
  const fan = Math.sin(p * 3 + 1) * 0.4;
  ctx.save();
  ctx.translate(a.hand[0], a.hand[1]);
  ctx.rotate(-0.6 + fan);
  shape(ctx, '#e9d18c', () => { ctx.moveTo(0, 0); ctx.arc(0, 0, 16, -Math.PI * 0.85, -Math.PI * 0.15); ctx.closePath(); }, 2);
  ctx.restore();
}

function thoSuaXe(ctx, c, p, m, face) {
  // Sleeveless vest, oil on the hands, a hand pump nearly as tall as he is.
  stroke(ctx, '#5c5873', 4, () => { ctx.moveTo(24, 0); ctx.lineTo(24, -46); ctx.moveTo(18, -46); ctx.lineTo(30, -46); });
  shape(ctx, '#3d405b', () => roundedPath(ctx, 18, -8, 12, 8, 2), 2);
  const a = person(ctx, c, p, m, face, { torsoW: 20, torsoH: 30, shirt: '#f4f1ea', hand: [22, -44] });
  shape(ctx, c, () => roundedPath(ctx, -10, a.top + 4, 20, 26, 6));
  ellipse(ctx, a.headX - 1, a.headY - 11, 12, 4, '#2b2d42');
}

function coTapHoa(ctx, c, p, m, face) {
  // Carries a tower of instant-noodle boxes on her head, never drops one.
  const a = person(ctx, c, p, m, face, { torsoW: 20, torsoH: 30, pants: '#5c5873', hand: [10, -88] });
  const sway = swing(p, 0, m, 2);
  ['#f2b705', '#e63946', '#2d9cdb'].forEach((col, k) => {
    shape(ctx, col, () => roundedPath(ctx, a.headX - 12 + sway * (k + 1) * 0.4, a.headY - a.r - 12 - k * 11, 24, 11, 2), 2);
  });
}

function thoCatToc(ctx, c, p, m, face) {
  // White barber's coat, comb behind the ear, scissors as long as his forearm.
  const a = person(ctx, c, p, m, face, { torsoW: 22, torsoH: 34, shirt: '#f4f1ea', hand: [22, -50] });
  ellipse(ctx, a.headX - 2, a.headY - 10, 12, 5, '#2b2d42');
  const snip = Math.abs(Math.sin(p * 4)) * 0.4;
  stroke(ctx, '#9aa0aa', 2.5, () => {
    ctx.moveTo(a.hand[0], a.hand[1]);
    ctx.lineTo(a.hand[0] + 20, a.hand[1] - 8 - snip * 10);
    ctx.moveTo(a.hand[0], a.hand[1]);
    ctx.lineTo(a.hand[0] + 20, a.hand[1] - 8 + snip * 10);
  });
}

function thoAnh(ctx, c, p, m, face) {
  // The photographer: a camera bigger than his face, flash bulb and all.
  const a = person(ctx, c, p, m, face, { torsoW: 22, torsoH: 30, shirt: '#e9e2cf', hand: [18, -64] });
  shape(ctx, '#c1121f', () => { ctx.moveTo(a.headX - 13, a.headY - 6); ctx.lineTo(a.headX + 13, a.headY - 10); ctx.lineTo(a.headX - 2, a.headY - 16); ctx.closePath(); }, 2);
  shape(ctx, '#2b2d42', () => roundedPath(ctx, a.hand[0] - 2, a.hand[1] - 12, 26, 18, 4));
  circle(ctx, a.hand[0] + 18, a.hand[1] - 3, 6, '#5c5873');
  circle(ctx, a.hand[0] + 18, a.hand[1] - 3, 3, '#a8dadc');
  const flash = m ? 0 : Math.max(0, Math.sin(p * 0.7) - 0.92) * 12;
  shape(ctx, flash > 0 ? '#fff6a8' : '#f4f1ea', () => roundedPath(ctx, a.hand[0] + 2, a.hand[1] - 22, 10, 10, 3), 2);
}

function baPho(ctx, c, p, m, face) {
  // Apron, sleeves rolled up, a ladle the size of an oar.
  const a = person(ctx, c, p, m, face, { torsoW: 26, torsoH: 32, belly: 8, shirt: '#f7f3ea', pants: '#2b2d42', hand: [20, -40] });
  shape(ctx, '#e76f51', () => roundedPath(ctx, -12, a.top + 12, 24, 22, 6));
  ellipse(ctx, a.headX - 8, a.headY - 7, 8, 7, '#2b2d42');
  stroke(ctx, '#8d5a2b', 3, () => { ctx.moveTo(a.hand[0], a.hand[1]); ctx.lineTo(a.hand[0] + 6, a.hand[1] - 34); });
  ellipse(ctx, a.hand[0] + 8, a.hand[1] - 38, 7, 4, '#9aa0aa');
}

function anhRadio(ctx, c, p, m, face) {
  // Pompadour, sunglasses, flared trousers, a cassette radio on the shoulder.
  const flare = 5;
  poly(ctx, [[-10, -34], [-2, -34], [2, 0], [-16 - flare, 0]], '#3a5a98');
  poly(ctx, [[2, -34], [10, -34], [16 + flare, 0], [2, 0]], shade('#3a5a98', 0.1));
  const a = person(ctx, c, p, m, face, { legs: false, legLen: 30, torsoW: 22, torsoH: 30, hand: [16, -74] });
  shape(ctx, '#2b2d42', () => { ctx.moveTo(a.headX - 12, a.headY - 4); ctx.quadraticCurveTo(a.headX - 6, a.headY - 34, a.headX + 16, a.headY - 16); ctx.quadraticCurveTo(a.headX + 4, a.headY - 14, a.headX - 12, a.headY - 4); }, 2);
  shape(ctx, '#9aa0aa', () => roundedPath(ctx, a.hand[0] - 4, a.hand[1] - 18, 30, 16, 3));
  circle(ctx, a.hand[0] + 4, a.hand[1] - 10, 4.5, '#2b2d42');
  circle(ctx, a.hand[0] + 18, a.hand[1] - 10, 4.5, '#2b2d42');
}

function baTrau(ctx, c, p, m, face) {
  // Ninety years old, bent double over a cane, a scarf knotted into two big "ears".
  const a = person(ctx, c, p, m, face, { legLen: 18, torsoW: 20, torsoH: 26, lean: 8, headR: 12, pants: '#2b2d42', hand: [24, -24] });
  stroke(ctx, '#8d5a2b', 2.5, () => { ctx.moveTo(a.hand[0], a.hand[1]); ctx.lineTo(a.hand[0] + 4, 0); });
  shape(ctx, '#2b2d42', () => {
    ctx.moveTo(a.headX - 14, a.headY + 2);
    ctx.quadraticCurveTo(a.headX, a.headY - 22, a.headX + 14, a.headY - 2);
    ctx.lineTo(a.headX + 22, a.headY - 14);
    ctx.lineTo(a.headX + 8, a.headY - 10);
    ctx.lineTo(a.headX - 18, a.headY - 16);
    ctx.closePath();
  }, 2);
}

function boDoi(ctx, c, p, m, face) {
  // Pith helmet, a frog-shaped backpack, tyre sandals.
  shape(ctx, shade(c, -0.1), () => roundedPath(ctx, -26, -64, 16, 24, 6));
  const a = person(ctx, c, p, m, face, { torsoW: 22, torsoH: 32, pants: shade(c, -0.15) });
  shape(ctx, shade(c, 0.05), () => { ctx.ellipse(a.headX, a.headY - 6, 17, 11, 0, Math.PI, 0); ctx.closePath(); });
  shape(ctx, shade(c, -0.1), () => roundedPath(ctx, a.headX - 19, a.headY - 6, 38, 4, 2), 2);
  circle(ctx, a.headX, a.headY - 12, 2.5, '#ffd23f');
}

function coToc(ctx, c, p, m, face) {
  // Permed hair twice the size of her head, shoulder pads, handbag.
  const a = person(ctx, c, p, m, face, { torsoW: 30, torsoH: 30, pants: '#f4f1ea', hand: [14, -44] });
  [[-14, -6], [-6, -16], [6, -16], [14, -6], [-16, 6], [16, 4]].forEach(([dx, dy]) => circle(ctx, a.headX + dx, a.headY + dy, 9, '#3b2416'));
  shape(ctx, '#ffd23f', () => roundedPath(ctx, a.hand[0] - 2, a.hand[1], 14, 12, 3));
  stroke(ctx, '#3b2416', 1.5, () => { ctx.moveTo(a.hand[0], a.hand[1]); ctx.lineTo(a.hand[0] + 5, a.hand[1] - 6); ctx.lineTo(a.hand[0] + 10, a.hand[1]); });
}

function ongLongChim(ctx, c, p, m, face) {
  // Tall and thin, long neck, striped pyjamas, a bird cage swinging from one hand.
  const a = person(ctx, c, p, m, face, { legLen: 38, torsoW: 18, torsoH: 34, neck: 10, shirt: c, pants: c, hand: [20, -58] });
  pajama(ctx, 0, a.top, 34);
  const swingCage = swing(p, 0, m, 3);
  stroke(ctx, '#8d5a2b', 1.5, () => { ctx.moveTo(a.hand[0], a.hand[1]); ctx.lineTo(a.hand[0] + swingCage, a.hand[1] + 6); });
  shape(ctx, 'rgba(233, 209, 140, 0.6)', () => { ctx.moveTo(a.hand[0] - 9 + swingCage, a.hand[1] + 26); ctx.lineTo(a.hand[0] + 9 + swingCage, a.hand[1] + 26); ctx.arc(a.hand[0] + swingCage, a.hand[1] + 14, 9, 0, Math.PI, true); ctx.closePath(); }, 2);
  circle(ctx, a.hand[0] + swingCage, a.hand[1] + 18, 3, '#e63946');
}

function ongDuongSinh(ctx, c, p, m, face) {
  // All in white, arms up in a slow exercise, one knee lifted when he stops.
  const lift = m ? 0 : Math.max(0, Math.sin(p * 0.5)) * 0.9;
  const a = person(ctx, c, p, m, face, { torsoW: 20, torsoH: 32, shirt: c, pants: c, arms: false });
  const up = Math.sin(p * 0.6) * 6;
  stroke(ctx, SKIN, 4, () => { ctx.moveTo(-6, a.top + 6); ctx.lineTo(-18, a.top - 18 - up); ctx.moveTo(6, a.top + 6); ctx.lineTo(18, a.top - 18 + up); });
  if (lift > 0) stroke(ctx, c, 7, () => { ctx.moveTo(4, a.hip); ctx.lineTo(16, a.hip + 4 - lift * 10); });
}

/** Painters for the 1990s cast, part 1. */
export const PEOPLE90 = { baTraDa, thoSuaXe, coTapHoa, thoCatToc, thoAnh, baPho, anhRadio, baTrau, boDoi, coToc, ongLongChim, ongDuongSinh };
