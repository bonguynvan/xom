// The 1990s xóm, part 2: children, street vendors and everything on wheels.
import { circle, ellipse, poly, roundedPath, shade, shape, stroke, swing, thinLine } from './duavit/paint.js';
import { nonLa } from './duavit/painters-holiday.js';
import { SKIN, bicycle, person, rider } from './body.js';

function cuBi(ctx, c, p, m, face) {
  // Shirtless, enormous head, honeycomb sandals, running everywhere.
  const a = person(ctx, c, p, m, face, { legLen: 18, torsoW: 18, torsoH: 20, headR: 16, shirt: SKIN, pants: c, legW: 6 });
  shape(ctx, c, () => roundedPath(ctx, -10, a.hip - 6, 20, 10, 3));
  thinLine(ctx, '#2b2d42', 2, () => { ctx.moveTo(a.headX - 12, a.headY - 12); ctx.lineTo(a.headX - 4, a.headY - 17); ctx.lineTo(a.headX + 4, a.headY - 13); });
}

function hocSinh(ctx, c, p, m, face) {
  // A pupil: white shirt, red scarf, navy shorts, a satchel in the colour of the day.
  shape(ctx, c, () => roundedPath(ctx, -17, -50, 10, 16, 3), 1.8); // the satchel on the back
  const a = person(ctx, '#f7f5ee', p, m, face, { legLen: 18, torsoW: 18, torsoH: 20, headR: 15, pants: '#2d3a64', legW: 6 });
  shape(ctx, '#2b2d42', () => { ctx.ellipse(a.headX - 1, a.headY - 4, a.r + 1, a.r * 0.75, 0, Math.PI, 0); ctx.closePath(); }, 1.5); // a bowl cut
  shape(ctx, '#da251d', () => { ctx.moveTo(a.headX - 7, a.top + 1); ctx.lineTo(a.headX + 7, a.top + 1); ctx.lineTo(a.headX + 1, a.top + 12); ctx.closePath(); }, 1.5);
}

function ganhHang(ctx, c, p, m, face) {
  // Shoulder pole with two baskets bouncing in step; conical hat.
  const bounce = m ? Math.sin(p * 2) * 2.5 : 0;
  const a = person(ctx, '#e9e2cf', p, m, face, { torsoW: 20, torsoH: 28, pants: '#2b2d42', hand: [10, -62] });
  stroke(ctx, '#c08a4b', 3, () => { ctx.moveTo(-42, a.top + 4 + bounce); ctx.lineTo(42, a.top + 4 - bounce); });
  [[-38, bounce], [38, -bounce]].forEach(([x, dy]) => {
    thinLine(ctx, '#8d5a2b', 1.2, () => { ctx.moveTo(x - 8, -30 + dy); ctx.lineTo(x, a.top + 4 + dy); ctx.lineTo(x + 8, -30 + dy); });
    shape(ctx, c, () => { ctx.moveTo(x - 11, -30 + dy); ctx.lineTo(x + 11, -30 + dy); ctx.lineTo(x + 8, -14 + dy); ctx.lineTo(x - 8, -14 + dy); ctx.closePath(); }, 2);
    ellipse(ctx, x, -31 + dy, 10, 3.5, shade(c, 0.25));
  });
  nonLa(ctx, a.headX, a.headY, a.r);
}

function xeOm(ctx, c, p, m, face) {
  // A Honda Cub 50: step-through frame, round headlamp, the rider in an army jacket and pith helmet.
  const wheel = (x) => {
    circle(ctx, x, -11, 11, '#2b2d42');
    circle(ctx, x, -11, 7, '#d9d4c8');
    stroke(ctx, '#1d1a2f', 1, () => { const k = p * 3; ctx.moveTo(x + Math.cos(k) * 5, -11 + Math.sin(k) * 5); ctx.lineTo(x - Math.cos(k) * 5, -11 - Math.sin(k) * 5); });
  };
  wheel(-26);
  wheel(28);
  shape(ctx, c, () => { ctx.moveTo(-34, -20); ctx.quadraticCurveTo(-30, -40, -6, -38); ctx.lineTo(4, -20); ctx.lineTo(22, -22); ctx.lineTo(30, -46); ctx.lineTo(36, -44); ctx.lineTo(32, -18); ctx.lineTo(-30, -14); ctx.closePath(); });
  shape(ctx, '#2b2d42', () => roundedPath(ctx, -26, -44, 26, 6, 3), 2);
  circle(ctx, 36, -46, 4.5, '#fff6a8');
  const a = rider(ctx, '#55703f', p, face, { pants: '#55703f', torsoH: 24 });
  shape(ctx, '#7c8a52', () => { ctx.ellipse(a.headX, a.headY - 5, 15, 10, 0, Math.PI, 0); ctx.closePath(); });
}

function coGiao(ctx, c, p, m, face) {
  // White áo dài, conical hat, a Phượng Hoàng bicycle with a basket of exercise books.
  bicycle(ctx, p, '#c94f3d');
  shape(ctx, '#c08a4b', () => roundedPath(ctx, 20, -42, 16, 10, 2), 1.5);
  [0, 4, 8].forEach((k) => shape(ctx, ['#f4f1ea', '#a8dadc', '#ffd23f'][k / 4], () => ctx.rect(22 + k, -48, 4, 7), 1));
  poly(ctx, [[-10, -38], [6, -38], [10, -18], [-16, -18]], c);
  const a = rider(ctx, c, p, face, { pants: '#f4f1ea', torsoH: 28 });
  nonLa(ctx, a.headX, a.headY, a.r);
}

function duaThu(ctx, c, p, m, face) {
  // Postman: green uniform, a bulging mail bag, the bell he never stops ringing.
  bicycle(ctx, p, '#2a9d8f');
  shape(ctx, '#2a9d8f', () => roundedPath(ctx, -30, -44, 18, 16, 4), 2);
  poly(ctx, [[-30, -44], [-12, -44], [-21, -36]], shade('#2a9d8f', -0.15));
  const a = rider(ctx, c, p, face, { pants: shade(c, -0.15), torsoH: 26 });
  shape(ctx, shade(c, -0.1), () => roundedPath(ctx, a.headX - 12, a.headY - a.r - 4, 24, 8, 3));
  circle(ctx, 26, -44, 3, '#ffd23f');
}

function baGac(ctx, c, p, m, face) {
  // Three-wheeled cargo bike carrying a black-and-white TV the size of a fridge.
  circle(ctx, 30, -10, 10, '#2b2d42');
  circle(ctx, -32, -10, 10, '#2b2d42');
  circle(ctx, -32, -10, 6, '#d9d4c8');
  circle(ctx, 30, -10, 6, '#d9d4c8');
  shape(ctx, '#8d5a2b', () => roundedPath(ctx, -46, -26, 48, 8, 2));
  shape(ctx, '#5c5873', () => roundedPath(ctx, -42, -64, 38, 38, 5));
  shape(ctx, '#a8b5b9', () => roundedPath(ctx, -38, -58, 26, 24, 4), 2);
  stroke(ctx, '#2b2d42', 1.5, () => { ctx.moveTo(-26, -64); ctx.lineTo(-32, -76); ctx.moveTo(-22, -64); ctx.lineTo(-14, -78); });
  stroke(ctx, '#c94f3d', 3, () => { ctx.moveTo(2, -22); ctx.lineTo(30, -10); ctx.moveTo(14, -18); ctx.lineTo(22, -44); });
  const lean = swing(p, 0, m, 2);
  const a = person(ctx, c, p, m, face, { legLen: 26, torsoW: 20, torsoH: 26, lean: 14 + lean, hand: [30, -44] });
  shape(ctx, '#55703f', () => { ctx.ellipse(a.headX, a.headY - 5, 14, 9, 0, Math.PI, 0); ctx.closePath(); });
}

function banKem(ctx, c, p, m, face) {
  // Ice-cream man: a wooden box on the rack with "KEM" on the side, a hand bell.
  bicycle(ctx, p, '#2d9cdb');
  shape(ctx, c, () => roundedPath(ctx, -40, -50, 28, 22, 4));
  // A popsicle painted on the box instead of a word, so it still reads when he rides the other way.
  shape(ctx, '#ffb4c8', () => roundedPath(ctx, -30, -47, 8, 11, 3), 1.5);
  stroke(ctx, '#c08a4b', 2, () => { ctx.moveTo(-26, -36); ctx.lineTo(-26, -31); });
  const a = rider(ctx, '#f4f1ea', p, face, { pants: '#5c5873', torsoH: 26 });
  shape(ctx, '#e9d18c', () => { ctx.ellipse(a.headX, a.headY - 6, 14, 7, 0, Math.PI, 0); ctx.closePath(); });
}

/** Painters for the 1990s cast, part 2. */
export const PEOPLE90B = { cuBi, hocSinh, ganhHang, xeOm, coGiao, duaThu, baGac, banKem };
