// The small things that make a street Vietnamese, in map units: motorbikes parked along the pavements,
// quán cóc (a parasol, a low table, plastic stools, a honeycomb-coal stove), the banner across the road,
// the xóm gate, bamboo hedges along the paddies, egrets in the rice.
import { INK, roundedPath, shade, shape, thinLine } from './duavit/paint.js';
import { MAP, PAVE_N, PAVE_S, ROAD_HALF, ROAD_LINE, ZEBRAS, yOn } from './map.js';
import { noise } from './rng.js';

const fill = (ctx, color, build) => { ctx.fillStyle = color; ctx.beginPath(); build(); ctx.fill(); };

// ---------------- motorbikes ----------------

const BIKE_COLORS = ['#c1121f', '#2d9cdb', '#f2b705', '#e9dcc0', '#3f8f6b', '#ef476f'];

// ---------------- quán vỉa hè: low tables and plastic stools all over the pavement ----------------

const SHOPFRONTS_END = 770; // the north pavement before this is the shops' own (they have their stools)

/** Clusters of stools round a low table, every few steps along both pavements. */
export const STOOL_CLUSTERS = [PAVE_N, PAVE_S].flatMap((line, side) => {
  const out = [];
  for (let x = 24; x < MAP.w - 24; x += 26) {
    const cx = x + Math.round(noise(x, side, 161) * 8);
    if (noise(x, side, 162) > 0.62 || ZEBRAS.some((z) => Math.abs(z - cx) < 16) || (side === 0 && cx < SHOPFRONTS_END)) continue;
    const cy = Math.round(yOn(line, cx) + (side ? 1 : -1));
    const n = 4 + Math.floor(noise(x, side, 163) * 3);
    const stools = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2 + noise(x, side, k, 164) * 0.4;
      const sx = cx + Math.cos(a) * 9;
      return { x: Math.round(sx), y: Math.round(cy + Math.sin(a) * 4), face: sx < cx ? 1 : -1, color: noise(x, side, k, 165) < 0.55 ? '#e63946' : '#2d9cdb' };
    });
    out.push({ x: cx, y: cy, side, stools });
  }
  return out;
});

export function drawStoolCluster(ctx, c) {
  fill(ctx, '#a0764a', () => ctx.rect(c.x - 4, c.y - 3, 8, 3)); // the low table
  fill(ctx, '#f4f1ea', () => ctx.arc(c.x - 1.5, c.y - 3.4, 0.9, 0, Math.PI * 2)); // a glass of tea
  for (const s of c.stools) fill(ctx, s.color, () => ctx.rect(s.x - 2, s.y - 2.5, 4, 2.5));
}

/** Where bikes are parked: along both pavements where there is room (not on a zebra, not among the stools). */
export const BIKES = [PAVE_N, PAVE_S].flatMap((line, side) => {
  const out = [];
  for (let x = 30; x < MAP.w - 30; x += 13) {
    if (noise(x, side, 71) > 0.42 || STOOL_CLUSTERS.some((c) => c.side === side && Math.abs(c.x - x) < 16)) continue;
    out.push({ x, y: Math.round(yOn(line, x) + (side ? -3 : 3)), color: BIKE_COLORS[Math.floor(noise(x, side, 72) * BIKE_COLORS.length)], dir: noise(x, side, 73) < 0.5 ? 1 : -1 });
  }
  return out;
});

/** A Honda Cub on its stand, side-on and tiny: two wheels, the step-through body, seat, fork, handlebar. */
export function drawBike(ctx, b) {
  const d = b.dir;
  const X = (dx) => b.x + dx * d;
  for (const wx of [-4.5, 4.5]) {
    fill(ctx, INK, () => ctx.arc(X(wx), b.y - 2.3, 2.3, 0, Math.PI * 2));
    fill(ctx, '#d9d4c8', () => ctx.arc(X(wx), b.y - 2.3, 1.3, 0, Math.PI * 2));
  }
  shape(ctx, b.color, () => { // rear body under the seat, the dip, the leg shield
    ctx.moveTo(X(-6), b.y - 3.5);
    ctx.lineTo(X(-6), b.y - 6.5);
    ctx.lineTo(X(-1), b.y - 6.5);
    ctx.lineTo(X(0.5), b.y - 3.6);
    ctx.lineTo(X(2.5), b.y - 3.6);
    ctx.lineTo(X(3.5), b.y - 8);
    ctx.lineTo(X(2), b.y - 8);
    ctx.lineTo(X(1), b.y - 4.6);
    ctx.closePath();
  }, 0.5);
  fill(ctx, '#2b2d42', () => ctx.rect(Math.min(X(-5.5), X(-1.5)), b.y - 8, 4, 1.6)); // seat
  thinLine(ctx, '#c9ccd3', 0.7, () => { ctx.moveTo(X(4.5), b.y - 2.3); ctx.lineTo(X(3.2), b.y - 9); ctx.lineTo(X(1.6), b.y - 9.6); }); // chrome fork, handlebar
}

// ---------------- quán cóc ----------------

const PARASOLS = ['#e63946', '#2d9cdb', '#f2b705', '#3f8f6b'];

/** A street stall to sit at: parasol, low table, stools; seats are the stools. */
export function quanCoc(id, x, y) {
  const seats = [[-9, 2], [9, 2], [0, 7], [-6, -4]].map(([dx, dy]) => ({ x: x + dx, y: y + dy, pose: 'sit' }));
  return { id, kind: 'quanCoc', name: 'Quán cóc', x: x - 14, w: 28, y0: y - 8, y1: y + 10, front: y + 10, open: [6, 22.5], spots: seats, cx: x, cy: y };
}

export function drawQuanCoc(ctx, q, hour) {
  const k = Math.floor(noise(q.cx, 81) * PARASOLS.length);
  fill(ctx, '#7a7f8a', () => ctx.rect(q.cx + 9, q.cy - 6, 4, 4)); // honeycomb-coal stove
  fill(ctx, '#ff7a1a', () => ctx.arc(q.cx + 11, q.cy - 7, 1.3, 0, Math.PI * 2));
  shape(ctx, '#a0764a', () => roundedPath(ctx, q.cx - 6, q.cy - 3, 12, 4, 1), 0.6); // low table
  for (const s of q.spots) fill(ctx, noise(s.x, s.y, 82) < 0.5 ? '#e63946' : '#2d9cdb', () => ctx.rect(s.x - 2, s.y - 3, 4, 3));
  if (hour < q.open[0] || hour >= q.open[1]) return; // the parasol is folded at night
  thinLine(ctx, '#5c5873', 0.8, () => { ctx.moveTo(q.cx, q.cy); ctx.lineTo(q.cx, q.cy - 24); });
  const color = PARASOLS[k];
  shape(ctx, color, () => ctx.ellipse(q.cx, q.cy - 25, 15, 6, 0, 0, Math.PI * 2), 0.8);
  fill(ctx, shade(color, 0.35), () => { ctx.moveTo(q.cx, q.cy - 25); ctx.ellipse(q.cx, q.cy - 25, 15, 6, 0, 0, Math.PI / 3); });
  fill(ctx, shade(color, 0.35), () => { ctx.moveTo(q.cx, q.cy - 25); ctx.ellipse(q.cx, q.cy - 25, 15, 6, 0, Math.PI * (2 / 3), Math.PI); });
  fill(ctx, shade(color, 0.35), () => { ctx.moveTo(q.cx, q.cy - 25); ctx.ellipse(q.cx, q.cy - 25, 15, 6, 0, Math.PI * (4 / 3), Math.PI * (5 / 3)); });
}

// ---------------- over the road: the banner and the xóm gate ----------------

export const BANNER_X = 990;
export const GATE_X = 1330;

/** The red banner on two bamboo poles along the south pavement, as every ward hangs them. */
export function banner() {
  const y = Math.round(yOn(ROAD_LINE, BANNER_X) + ROAD_HALF + 4);
  const draw = (ctx) => {
    thinLine(ctx, '#8d6e4f', 1, () => { ctx.moveTo(BANNER_X - 42, y); ctx.lineTo(BANNER_X - 42, y - 30); ctx.moveTo(BANNER_X + 42, y); ctx.lineTo(BANNER_X + 42, y - 30); });
    shape(ctx, '#da251d', () => ctx.rect(BANNER_X - 42, y - 30, 84, 9), 0.7);
    ctx.fillStyle = '#ffde00';
    ctx.font = '800 5px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('XÓM PETI ĐOÀN KẾT, VĂN MINH', BANNER_X, y - 25.2, 80);
  };
  return { y, draw };
}

/** The gate where the road enters the xóm: two pillars and a curved tiled roof with the name. */
export function gateParts() {
  const y = yOn(ROAD_LINE, GATE_X);
  const yn = y - ROAD_HALF - 6;
  const ys = y + ROAD_HALF + 6;
  const pillar = (py) => (ctx) => {
    shape(ctx, '#e9dcc0', () => ctx.rect(GATE_X - 4, py - 46, 8, 46), 0.8);
    shape(ctx, '#5d4037', () => { ctx.moveTo(GATE_X - 8, py - 46); ctx.lineTo(GATE_X, py - 54); ctx.lineTo(GATE_X + 8, py - 46); ctx.closePath(); }, 0.8);
  };
  const arch = (ctx) => {
    const top = yn - 58;
    shape(ctx, '#5d4037', () => { ctx.moveTo(GATE_X - 6, top - 2); ctx.quadraticCurveTo(GATE_X - 9, top - 9, GATE_X - 12, top - 12); ctx.lineTo(GATE_X + 12, ys - 70); ctx.quadraticCurveTo(GATE_X + 9, ys - 64, GATE_X + 6, ys - 56); ctx.closePath(); }, 0.8);
    shape(ctx, '#f2e2b6', () => ctx.rect(GATE_X - 3.5, top + 2, 7, ys - yn - 4), 0.6);
    ctx.save();
    ctx.translate(GATE_X, (top + ys - 56) / 2 + 1);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#c1121f';
    ctx.font = '800 4.6px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('XÓM PETI', 0, 0.4);
    ctx.restore();
  };
  return [{ y: yn, draw: pillar(yn) }, { y: ys, draw: (ctx) => { pillar(ys)(ctx); arch(ctx); } }];
}

// ---------------- the edge of the xóm: bamboo, paddies, egrets ----------------

/** Bamboo hedge along the paddies at the bottom of the map. */
export const HEDGE = Array.from({ length: 34 }, (_, k) => ({ x: 20 + k * 42 + noise(k, 91) * 14, y: 684 + noise(k, 92) * 8 }));

export function drawBamboo(ctx, t) {
  for (let k = 0; k < 6; k += 1) thinLine(ctx, '#6f8f3d', 1.1, () => { const x = t.x - 6 + k * 2.4; ctx.moveTo(x, t.y); ctx.quadraticCurveTo(x - 2, t.y - 18, x + (k - 2.5) * 3, t.y - 34); });
  for (let k = 0; k < 7; k += 1) fill(ctx, k % 2 ? '#6aa84f' : '#5a9a45', () => ctx.ellipse(t.x - 11 + noise(t.x, k) * 22, t.y - 20 - noise(t.x, k, 2) * 16, 6, 2.6, noise(t.x, k, 3) - 0.5, 0, Math.PI * 2));
}

export const EGRETS = Array.from({ length: 9 }, (_, k) => ({ x: 40 + noise(k, 93) * (MAP.w - 80), y: k < 4 ? 6 + noise(k, 94) * 8 : 672 + noise(k, 94) * 6 }));

/** A white egret standing in the rice; it bobs its head now and then (t in ms). */
export function drawEgret(ctx, e, t) {
  const bob = Math.sin(t / 700 + e.x) > 0.8 ? 2 : 0;
  thinLine(ctx, '#d9b25f', 0.6, () => { ctx.moveTo(e.x - 1, e.y); ctx.lineTo(e.x - 1, e.y - 4); ctx.moveTo(e.x + 1, e.y); ctx.lineTo(e.x + 1, e.y - 4); });
  fill(ctx, '#ffffff', () => ctx.ellipse(e.x, e.y - 6, 3.4, 2, -0.3, 0, Math.PI * 2));
  thinLine(ctx, '#ffffff', 1, () => { ctx.moveTo(e.x + 2, e.y - 7); ctx.quadraticCurveTo(e.x + 4, e.y - 10, e.x + 3, e.y - 12 + bob); });
  thinLine(ctx, '#f2b705', 0.6, () => { ctx.moveTo(e.x + 3, e.y - 12 + bob); ctx.lineTo(e.x + 6, e.y - 11.5 + bob); });
}
