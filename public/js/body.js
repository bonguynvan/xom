// Building blocks for the 1990s cast: a person and a bicycle, in duavit's painter conventions
// (facing right, origin on the ground, about 100 units tall). Odd proportions are welcome:
// big heads, long necks, round bellies; the xóm is a picture scroll, not a photo.
import { circle, drawFace, leg, roundedPath, shade, shape, stroke, swing } from './duavit/paint.js';

export const SKIN = '#e9b98f';

/**
 * A walking (or standing) person. Returns anchor points for hats and props.
 * @param {object} o  pants, shirt, legLen, torsoW, torsoH, belly, headR, neck, lean, arms, hands
 */
export function person(ctx, c, p, m, face, o = {}) {
  const pants = o.pants ?? '#2b2d42';
  const legLen = o.legLen ?? 30;
  const hip = -legLen - 4;
  const torsoW = o.torsoW ?? 22;
  const torsoH = o.torsoH ?? 30;
  const belly = o.belly ?? 0;
  const headR = o.headR ?? 12;
  const lean = o.lean ?? 0;
  const top = hip - torsoH;
  if (o.legs !== false) {
    leg(ctx, -4, hip, legLen, swing(p, Math.PI, m, 0.6), shade(pants, 0.12), o.legW ?? 7);
    leg(ctx, 4, hip, legLen, swing(p, 0, m, 0.6), pants, o.legW ?? 7);
  }
  if (o.arms !== false) stroke(ctx, o.skin ?? SKIN, 4, () => { ctx.moveTo(-6 + lean, top + 8); ctx.lineTo(-10 + lean - swing(p, 0, m, 6), top + 26); });
  shape(ctx, o.shirt ?? c, () => roundedPath(ctx, -torsoW / 2 + lean - belly / 2, top, torsoW + belly, torsoH + 4, Math.min(10, torsoW / 2)));
  const hand = o.hand ?? [12 + lean, top + 18];
  if (o.arms !== false) stroke(ctx, o.skin ?? SKIN, 4, () => { ctx.moveTo(6 + lean, top + 8); ctx.lineTo(hand[0], hand[1] + swing(p, Math.PI, m, 4)); });
  const neck = o.neck ?? 0;
  if (neck > 0) stroke(ctx, o.skin ?? SKIN, 6, () => { ctx.moveTo(lean, top + 2); ctx.lineTo(lean + 2, top - neck); });
  const headY = top - neck - headR + 3;
  drawFace(ctx, lean + 2, headY, headR, face, c);
  return { headX: lean + 2, headY, r: headR, top, hip, hand };
}

/** A bicycle; wheels turn with the phase. */
export function bicycle(ctx, p, color = '#c94f3d', { rear = -24, front = 26, r = 11 } = {}) {
  for (const x of [rear, front]) {
    circle(ctx, x, -r, r, '#e9e4d8'); // a light rim: the road behind is dark
    stroke(ctx, '#1d1a2f', 1, () => {
      for (let k = 0; k < 3; k += 1) {
        const a = p * 2.5 + (k * Math.PI) / 3;
        ctx.moveTo(x + Math.cos(a) * r, -r + Math.sin(a) * r);
        ctx.lineTo(x - Math.cos(a) * r, -r - Math.sin(a) * r);
      }
    });
  }
  stroke(ctx, color, 3, () => {
    ctx.moveTo(rear, -r);
    ctx.lineTo(-6, -r - 22);
    ctx.lineTo(front - 6, -r - 20);
    ctx.lineTo(front, -r);
    ctx.moveTo(-6, -r - 22);
    ctx.lineTo(2, -r);
    ctx.lineTo(front - 6, -r - 20);
    ctx.moveTo(front - 6, -r - 20);
    ctx.lineTo(front - 2, -r - 30);
  });
  shape(ctx, '#1d1a2f', () => roundedPath(ctx, -12, -r - 26, 12, 4, 2), 1.5);
}

/** A rider sitting on a bicycle seat, pedalling. Returns the same anchors as person(). */
export function rider(ctx, c, p, face, o = {}) {
  const pants = o.pants ?? '#2b2d42';
  const pedal = (k) => [2 + Math.cos(p * 2.5 + k) * 6, -11 + Math.sin(p * 2.5 + k) * 6];
  for (const [k, col] of [[Math.PI, shade(pants, 0.12)], [0, pants]]) {
    const [px, py] = pedal(k);
    stroke(ctx, col, 7, () => { ctx.moveTo(-6, -40); ctx.lineTo((px - 6) / 2 + 6, (py - 40) / 2 - 4); ctx.lineTo(px, py); });
  }
  const top = -40 - (o.torsoH ?? 26);
  shape(ctx, o.shirt ?? c, () => roundedPath(ctx, -14, top, 20, (o.torsoH ?? 26) + 4, 8));
  stroke(ctx, o.skin ?? SKIN, 4, () => { ctx.moveTo(0, top + 8); ctx.lineTo(16, -44); });
  const headR = o.headR ?? 12;
  const headY = top - headR + 3;
  drawFace(ctx, -2, headY, headR, face, c);
  return { headX: -2, headY, r: headR, top };
}
