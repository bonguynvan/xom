// Cartoon faces for the xóm. Duavit's painters draw a name badge where the head goes; we plug
// into its `face.capture` hook and draw a real face instead. Nothing here is text, so a character
// can be mirrored to walk left without its face reading backwards.
import { INK } from './duavit/paint.js';

const LINE = 2;

function eyes(ctx, x, y, r, kind) {
  const ex = [x + r * 0.08, x + r * 0.52]; // looking right, like every painter
  const ey = y - r * 0.12;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE;
  for (const cx of ex) {
    ctx.beginPath();
    if (kind === 'sleepy') {
      ctx.arc(cx, ey + r * 0.04, r * 0.16, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else if (kind === 'wide' || kind === 'round') {
      ctx.fillStyle = '#fff';
      ctx.arc(cx, ey, r * (kind === 'wide' ? 0.22 : 0.17), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(cx + r * 0.05, ey + r * 0.02, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(cx, ey, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function glasses(ctx, x, y, r, kind) {
  const ey = y - r * 0.12;
  ctx.lineWidth = LINE;
  ctx.strokeStyle = INK;
  if (kind === 'sun') {
    ctx.fillStyle = '#1d1a2f';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - r * 0.2, ey - r * 0.2, r * 0.95, r * 0.36, r * 0.12);
    else ctx.rect(x - r * 0.2, ey - r * 0.2, r * 0.95, r * 0.36);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + r * 0.05, ey - r * 0.14, r * 0.18, r * 0.07);
    return;
  }
  for (const cx of [x + r * 0.08, x + r * 0.52]) {
    ctx.beginPath();
    ctx.arc(cx, ey, r * 0.24, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x + r * 0.32, ey);
  ctx.lineTo(x + r * 0.28, ey);
  ctx.stroke();
}

function mouth(ctx, x, y, r, kind) {
  const mx = x + r * 0.34;
  const my = y + r * 0.42;
  ctx.lineWidth = LINE;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  if (kind === 'o') {
    ctx.fillStyle = '#7a2e2e';
    ctx.ellipse(mx, my, r * 0.13, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'betel') { // red from chewing betel
    ctx.fillStyle = '#b3261e';
    ctx.ellipse(mx, my, r * 0.2, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'grin') {
    ctx.fillStyle = '#fff';
    ctx.arc(mx, my - r * 0.06, r * 0.26, 0.15, Math.PI - 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'flat') {
    ctx.moveTo(mx - r * 0.18, my);
    ctx.lineTo(mx + r * 0.18, my);
    ctx.stroke();
  } else {
    ctx.arc(mx, my - r * 0.12, r * 0.2, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

function hair(ctx, x, y, r, look) {
  ctx.lineWidth = LINE;
  ctx.strokeStyle = INK;
  if (look.brows) {
    ctx.lineWidth = look.brows === 'thick' ? 3.2 : 1.6;
    for (const cx of [x + r * 0.08, x + r * 0.52]) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.16, y - r * 0.42);
      ctx.lineTo(cx + r * 0.16, y - r * 0.38);
      ctx.stroke();
    }
  }
  if (look.mustache) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.34, y + r * 0.24, r * 0.3, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.beard) {
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.1, y + r * 0.45);
    ctx.quadraticCurveTo(x + r * 0.3, y + r * (look.beard === 'long' ? 1.9 : 1.1), x + r * 0.7, y + r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** A face that drawFace() will paint through its capture hook. */
export function makeFace(look = {}) {
  return {
    capture(ctx, x, y, r) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = look.skin ?? '#f1c9a5';
      ctx.fill();
      ctx.lineWidth = Math.max(2.5, r * 0.18);
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (look.blush) {
        ctx.fillStyle = 'rgba(239, 71, 111, 0.35)';
        ctx.beginPath();
        ctx.ellipse(x + r * 0.62, y + r * 0.2, r * 0.17, r * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      eyes(ctx, x, y, r, look.eyes ?? 'dot');
      if (look.glasses) glasses(ctx, x, y, r, look.glasses);
      hair(ctx, x, y, r, look);
      mouth(ctx, x, y, r, look.mouth ?? 'smile');
      ctx.restore();
    },
  };
}
