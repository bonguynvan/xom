// Everything on the map that is not a house: the ground, the railway and its train, the market, the đình,
// the pond, the well, the bus stop, trees, poles and lamps. Drawn in map units (see map.js).
import { INK, circle, ellipse, roundedPath, shade, shape, stroke, thinLine } from './duavit/paint.js';
import { CROSSING_X, MAP, PAVE_N, PAVE_S, RAIL_Y, ROAD_HALF, ROAD_LINE, WAYS, ZEBRAS, yOn } from './map.js';
import { LAMPS, PLACES, POLES, TREES, findPlace } from './places.js';
import { TRAIN_LENGTH } from './world.js';
import { noise } from './rng.js';
import { DECOR, drawGroundClutter } from './decor.js';
import { GREENERY, drawGreenGround } from './greenery.js';
import { BIKES, EGRETS, HEDGE, STOOL_CLUSTERS, banner, drawBamboo, drawBike, drawEgret, drawQuanCoc, drawStoolCluster, gateParts } from './street-life.js';

const LINE = 1; // outline width at map scale
/** A filled dot with no outline: at map scale an ink ring would swallow it. */
const dot = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

// ---------------- the ground ----------------

function fields(ctx) {
  ctx.fillStyle = '#9fbf6a'; // rice paddies above the railway and below the last alley
  ctx.fillRect(0, 0, MAP.w, 16);
  ctx.fillRect(0, 668, MAP.w, MAP.h - 668);
  ctx.strokeStyle = 'rgba(70, 110, 40, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = 0; x < MAP.w; x += 7) { ctx.moveTo(x, 672); ctx.lineTo(x + 3, MAP.h); ctx.moveTo(x, 0); ctx.lineTo(x + 2, 14); }
  ctx.stroke();
  thinLine(ctx, '#7a9a4d', 1, () => { for (let x = 0; x < MAP.w; x += 160) { ctx.moveTo(x, 668); ctx.lineTo(x + 20, MAP.h); } });
}

function grass(ctx) {
  ctx.fillStyle = 'rgba(120, 160, 70, 0.35)';
  for (let k = 0; k < 90; k += 1) {
    const x = noise(k, 31) * MAP.w;
    const y = 160 + noise(k, 32) * 520;
    ctx.beginPath();
    ctx.ellipse(x, y, 6 + noise(k, 33) * 16, 3 + noise(k, 34) * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function rail(ctx) {
  ctx.fillStyle = '#a89f91';
  ctx.fillRect(0, RAIL_Y - 11, MAP.w, 22);
  ctx.fillStyle = '#6b4a2f';
  for (let x = 2; x < MAP.w; x += 7) ctx.fillRect(x, RAIL_Y - 7, 3, 14);
  ctx.fillStyle = '#4b4f5a';
  ctx.fillRect(0, RAIL_Y - 5, MAP.w, 1.6);
  ctx.fillRect(0, RAIL_Y + 3.5, MAP.w, 1.6);
  ctx.fillStyle = '#8d6e4f'; // planks at the level crossing
  ctx.fillRect(CROSSING_X - 9, RAIL_Y - 9, 18, 18);
}

/** A way drawn as a thick rounded stroke along its line. */
function way(ctx, points, width, color, dash = []) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function streets(ctx) {
  for (const w of WAYS) if (w.kind === 'alley') way(ctx, w.line, 13, '#cfc3a6');
  for (const line of [PAVE_N, PAVE_S]) { // red brick pavements, tile joints showing
    way(ctx, line, 12, '#c4826a');
    way(ctx, line, 11, '#d49a82', [2.5, 2.5]);
  }
  way(ctx, ROAD_LINE, ROAD_HALF * 2 + 3, '#9aa0aa'); // kerbs
  way(ctx, ROAD_LINE, ROAD_HALF * 2, '#5c5f68');
  way(ctx, ROAD_LINE, 1.6, 'rgba(244, 241, 234, 0.6)', [15, 15]);
  ctx.fillStyle = 'rgba(244, 241, 234, 0.75)'; // zebra crossings
  for (const x of ZEBRAS) {
    const y = yOn(ROAD_LINE, x);
    for (let s = -ROAD_HALF + 3; s < ROAD_HALF - 2; s += 5) ctx.fillRect(x - 7, y + s, 14, 2.5);
  }
}

function market(ctx, p) {
  ctx.fillStyle = '#cdb98f';
  ctx.fillRect(p.x, p.y0, p.w, p.y1 - p.y0);
  ctx.fillStyle = 'rgba(29, 26, 47, 0.12)';
  for (let k = 0; k < 40; k += 1) ctx.fillRect(p.x + noise(k, 41) * p.w, p.y0 + noise(k, 42) * (p.y1 - p.y0), 2, 1.2);
}

function courtyard(ctx, p) {
  shape(ctx, '#e3b48c', () => ctx.rect(p.x, p.y0, p.w, p.y1 - p.y0), LINE);
  thinLine(ctx, shade('#e3b48c', -0.08), 0.4, () => {
    for (let x = p.x + 14; x < p.x + p.w; x += 14) { ctx.moveTo(x, p.y0); ctx.lineTo(x, p.y1); }
    for (let y = p.y0 + 14; y < p.y1; y += 14) { ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); }
  });
}

function pond(ctx, p) {
  const { cx, cy, rx, ry } = p.pond;
  ellipse(ctx, cx, cy + 2, rx + 4, ry + 4, '#8d7a5a');
  ellipse(ctx, cx, cy, rx, ry, '#6fb3c4');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let k = 0; k < 6; k += 1) ctx.fillRect(cx - rx * 0.6 + noise(k, 51) * rx * 1.2, cy - ry * 0.5 + noise(k, 52) * ry, 10, 1);
  for (let k = 0; k < 9; k += 1) { // lotus leaves and a few flowers on the far side
    const x = cx + rx * 0.45 + noise(k, 53) * rx * 0.4;
    const y = cy - ry * 0.4 + noise(k, 54) * ry * 0.8;
    ctx.fillStyle = '#4f9a4f';
    ctx.beginPath();
    ctx.ellipse(x, y, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (k % 3 === 0) dot(ctx, x + 1, y - 1, 1.6, '#ff8fab');
  }
}

/** The static ground under everything else. */
export function drawGround(ctx) {
  ctx.fillStyle = '#d8c7a0';
  ctx.fillRect(0, 0, MAP.w, MAP.h);
  fields(ctx);
  grass(ctx);
  rail(ctx);
  for (const p of PLACES) {
    if (p.kind === 'cho') market(ctx, p);
    if (p.kind === 'dinh') courtyard(ctx, { ...p, y1: p.front - 40 });
    if (p.kind === 'ao') pond(ctx, p);
    if (p.kind === 'sanChoi') { // bare earth, worn bald in the middle by a thousand football matches
      ctx.fillStyle = '#d9c290';
      ctx.fillRect(p.x, p.y0, p.w, p.y1 - p.y0);
      ctx.fillStyle = 'rgba(160, 130, 80, 0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x + p.w / 2, (p.y0 + p.y1) / 2, p.w * 0.3, (p.y1 - p.y0) * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawGreenGround(ctx);
  streets(ctx);
  drawGroundClutter(ctx);
}

// ---------------- standing things ----------------

function stall(ctx, s, k, open) {
  const tarp = ['#2d9cdb', '#e63946', '#3d8b3d', '#f2b705'][k % 4];
  thinLine(ctx, '#6b4a2f', 1, () => { ctx.moveTo(s.x - 17, s.y); ctx.lineTo(s.x - 17, s.y - 24); ctx.moveTo(s.x + 17, s.y); ctx.lineTo(s.x + 17, s.y - 24); });
  shape(ctx, '#a0764a', () => ctx.rect(s.x - 16, s.y - 6, 32, 6), LINE);
  if (open) {
    for (let g = 0; g < 6; g += 1) dot(ctx, s.x - 12 + g * 5, s.y - 7.5, 2, ['#4caf50', '#e63946', '#f2b705', '#c9d6df', '#ff8fab', '#8d6e63'][(k + g) % 6]);
    shape(ctx, tarp, () => { ctx.moveTo(s.x - 20, s.y - 23); ctx.lineTo(s.x + 20, s.y - 23); ctx.lineTo(s.x + 17, s.y - 31); ctx.lineTo(s.x - 17, s.y - 31); ctx.closePath(); }, LINE);
  }
}

function dinhHall(ctx, p) {
  const x0 = p.x + 25;
  const x1 = p.x + p.w - 25;
  const base = p.front;
  shape(ctx, '#e9dcc0', () => ctx.rect(x0 - 4, base - 4, x1 - x0 + 8, 6), LINE); // stone plinth
  shape(ctx, '#9c3d2b', () => ctx.rect(x0, base - 26, x1 - x0, 22), LINE);
  for (let x = x0 + 12; x < x1 - 6; x += 22) shape(ctx, '#6b2a1f', () => ctx.rect(x, base - 24, 10, 18), 0.8); // doors
  for (let x = x0 + 4; x <= x1 - 2; x += 22) stroke(ctx, '#3b1d14', 2, () => { ctx.moveTo(x, base - 4); ctx.lineTo(x, base - 26); });
  shape(ctx, '#5d4037', () => { // the great tiled roof with upturned corners
    ctx.moveTo(x0 - 16, base - 22);
    ctx.quadraticCurveTo(x0 - 6, base - 30, x0 + 4, base - 50);
    ctx.lineTo(x1 - 4, base - 50);
    ctx.quadraticCurveTo(x1 + 6, base - 30, x1 + 16, base - 22);
    ctx.quadraticCurveTo(x1, base - 28, (x0 + x1) / 2, base - 27);
    ctx.quadraticCurveTo(x0, base - 28, x0 - 16, base - 22);
    ctx.closePath();
  }, LINE);
  thinLine(ctx, shade('#5d4037', 0.25), 0.6, () => { for (let x = x0 + 8; x < x1 - 4; x += 5) { ctx.moveTo(x, base - 48); ctx.lineTo(x, base - 29); } });
  shape(ctx, '#4e342e', () => ctx.rect(x0 + 2, base - 54, x1 - x0 - 4, 5), LINE); // ridge
  circle(ctx, (x0 + x1) / 2, base - 56, 3.5, '#f2b705'); // the pearl between two dragons
}

function well(ctx, p) {
  const cx = p.x + p.w / 2;
  const cy = p.front - 2;
  shape(ctx, '#b0a493', () => ctx.rect(cx - 9, cy - 6, 18, 8), LINE);
  ellipse(ctx, cx, cy - 6, 9, 3.5, '#8d8576');
  ellipse(ctx, cx, cy - 6, 6.5, 2.2, '#2f4858');
  stroke(ctx, '#6b4a2f', 1.4, () => { ctx.moveTo(cx - 11, cy); ctx.lineTo(cx - 11, cy - 20); ctx.lineTo(cx + 11, cy - 20); ctx.lineTo(cx + 11, cy); });
  thinLine(ctx, INK, 0.6, () => { ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 10); });
  shape(ctx, '#7f8c8d', () => ctx.rect(cx - 2, cy - 12, 4, 4), 0.6);
}

/** A football goal made of two bamboo poles and a crossbar. */
function goal(ctx, x, y) {
  thinLine(ctx, '#e9dcc0', 1.4, () => { ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 20); ctx.lineTo(x, y + 8 - 20); ctx.moveTo(x, y + 8); ctx.lineTo(x, y - 12); });
  thinLine(ctx, '#e9dcc0', 1.4, () => { ctx.moveTo(x, y - 20); ctx.lineTo(x, y - 4); });
}

function busStop(ctx, p) {
  stroke(ctx, '#5c5873', 1.2, () => { ctx.moveTo(p.x + 4, p.front); ctx.lineTo(p.x + 4, p.front - 20); ctx.moveTo(p.x + p.w - 4, p.front); ctx.lineTo(p.x + p.w - 4, p.front - 20); });
  shape(ctx, '#a0764a', () => roundedPath(ctx, p.x + 8, p.front - 7, p.w - 16, 3, 1), 0.8);
  shape(ctx, '#2a9d8f', () => ctx.rect(p.x, p.front - 26, p.w, 7), LINE);
  shape(ctx, '#f2b705', () => ctx.rect(p.x + p.w / 2 - 14, p.front - 25, 28, 5), 0.6);
}

function crossing(ctx, p, trainNear) {
  shape(ctx, '#f4f1ea', () => ctx.rect(p.x, p.front - 14, p.w, 14), LINE); // the keeper's hut
  shape(ctx, '#c1663f', () => { ctx.moveTo(p.x - 2, p.front - 13); ctx.lineTo(p.x + p.w / 2, p.front - 20); ctx.lineTo(p.x + p.w + 2, p.front - 13); ctx.closePath(); }, LINE);
  const px = CROSSING_X - 10;
  const py = RAIL_Y + 18;
  stroke(ctx, INK, 1.2, () => { ctx.moveTo(px, py); ctx.lineTo(px, py - 6); });
  const arm = trainNear ? [[px, py - 6], [px + 22, py - 6]] : [[px, py - 6], [px + 2, py - 26]];
  stroke(ctx, '#e63946', 2, () => { ctx.moveTo(...arm[0]); ctx.lineTo(...arm[1]); });
  thinLine(ctx, '#f4f1ea', 2, () => { // red and white bands
    const [[ax, ay], [bx, by]] = arm;
    for (let k = 0.2; k < 1; k += 0.4) { ctx.moveTo(ax + (bx - ax) * k, ay + (by - ay) * k); ctx.lineTo(ax + (bx - ax) * (k + 0.15), ay + (by - ay) * (k + 0.15)); }
  });
}

function tree(ctx, t) {
  if (t.kind === 'tre') {
    for (let k = 0; k < 7; k += 1) stroke(ctx, '#7a9a4d', 1.2, () => { const x = t.x - 8 + k * 2.6; ctx.moveTo(x, t.y); ctx.quadraticCurveTo(x - 2, t.y - 25, x + (k - 3) * 3, t.y - 46); });
    for (let k = 0; k < 9; k += 1) ellipse(ctx, t.x - 14 + noise(t.x, k) * 28, t.y - 28 - noise(t.x, k, 2) * 20, 6, 3, '#6aa84f');
    return;
  }
  if (t.kind === 'chuoi') {
    stroke(ctx, '#7a9a4d', 2.5, () => { ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - 18); });
    [-1, 1, -0.4, 0.5].forEach((s, k) => shape(ctx, '#6aa84f', () => ctx.ellipse(t.x + s * 9, t.y - 22 - k * 2, 11, 3.5, s * 0.5, 0, Math.PI * 2), 0.8));
    return;
  }
  // banyan: a thick trunk, hanging roots and a crown that shades half the courtyard
  shape(ctx, '#6b4226', () => { ctx.moveTo(t.x - 6, t.y); ctx.lineTo(t.x - 4, t.y - 26); ctx.lineTo(t.x + 4, t.y - 26); ctx.lineTo(t.x + 6, t.y); ctx.closePath(); }, LINE);
  [[-22, -40, 18], [0, -52, 22], [22, -40, 18], [-10, -32, 15], [12, -30, 15]].forEach(([dx, dy, r], k) => circle(ctx, t.x + dx, t.y + dy, r, k % 2 ? '#3d7a3d' : '#2f6b33'));
  thinLine(ctx, '#6b4226', 0.6, () => { for (let k = 0; k < 6; k += 1) { const x = t.x - 20 + k * 8; ctx.moveTo(x, t.y - 26); ctx.lineTo(x + 1, t.y - 12); } });
}

function pole(ctx, p) {
  shape(ctx, '#b9b4a8', () => ctx.rect(p.x - 1.5, p.y - 44, 3, 44), 0.8);
  thinLine(ctx, INK, 0.6, () => { for (let k = 0; k < 5; k += 1) ctx.ellipse(p.x, p.y - 36 + k * 1.5, 3 + noise(p.x, k) * 4, 1.6, noise(p.x, k, 2), 0, Math.PI * 2); });
  if (p.loa) {
    shape(ctx, '#9aa0aa', () => { ctx.moveTo(p.x + 1, p.y - 42); ctx.lineTo(p.x + 9, p.y - 46); ctx.lineTo(p.x + 9, p.y - 37); ctx.lineTo(p.x + 1, p.y - 40); ctx.closePath(); }, 0.6);
    shape(ctx, '#9aa0aa', () => { ctx.moveTo(p.x - 1, p.y - 42); ctx.lineTo(p.x - 9, p.y - 46); ctx.lineTo(p.x - 9, p.y - 37); ctx.lineTo(p.x - 1, p.y - 40); ctx.closePath(); }, 0.6);
  }
}

function lamp(ctx, l, glow) {
  thinLine(ctx, '#3d405b', 1, () => { ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y - 22); ctx.lineTo(l.x + 5, l.y - 23); });
  ellipse(ctx, l.x + 6, l.y - 22, 2.6, 1.6, glow > 0 ? '#fff6a8' : '#d9d4c8');
}

/** The train: an engine and four carriages, side-on on the rails. */
export function drawTrain(ctx, train) {
  if (!train) return;
  const cars = 5;
  const len = TRAIN_LENGTH / cars;
  for (let k = 0; k < cars; k += 1) {
    const x = train.dir > 0 ? train.x - (k + 1) * len : train.x + k * len;
    const engine = k === 0;
    const body = engine ? '#2f5d50' : '#3a6ea5';
    shape(ctx, shade(body, 0.25), () => roundedPath(ctx, x + 2, RAIL_Y - 30, len - 4, 7, 2), LINE); // roof
    shape(ctx, body, () => ctx.rect(x + 2, RAIL_Y - 23, len - 4, 18), LINE);
    ctx.fillStyle = '#f2b705';
    ctx.fillRect(x + 2, RAIL_Y - 9, len - 4, 2);
    if (!engine) for (let w = x + 7; w < x + len - 9; w += 9) shape(ctx, '#cfe8f3', () => ctx.rect(w, RAIL_Y - 20, 6, 6), 0.6);
    circle(ctx, x + 10, RAIL_Y - 4, 3, INK);
    circle(ctx, x + len - 10, RAIL_Y - 4, 3, INK);
  }
}

/** Every standing thing except houses and people, each with the ground y it stands on (for depth order). */
export function standing(train) {
  const items = [];
  for (const p of PLACES) {
    if (p.kind === 'cho') p.stalls.forEach((s, k) => items.push({ y: s.y, draw: (ctx, open) => stall(ctx, s, k, open.cho) }));
    if (p.kind === 'dinh') items.push({ y: p.front, draw: (ctx) => dinhHall(ctx, p) });
    if (p.kind === 'gieng') items.push({ y: p.front, draw: (ctx) => well(ctx, p) });
    if (p.kind === 'sanChoi') for (const gx of [p.x + 8, p.x + p.w - 8]) items.push({ y: 98, draw: (ctx) => goal(ctx, gx, 98) });
    if (p.kind === 'benXe') items.push({ y: p.front, draw: (ctx) => busStop(ctx, p) });
    if (p.kind === 'chanTau') items.push({ y: p.front, draw: (ctx) => crossing(ctx, p, train !== null) });
    if (p.kind === 'quanCoc') items.push({ y: p.front - 10, draw: (ctx, open) => drawQuanCoc(ctx, p, open.hour) });
  }
  for (const t of TREES) items.push({ y: t.y, draw: (ctx) => tree(ctx, t) });
  for (const b of BIKES) items.push({ y: b.y, draw: (ctx) => drawBike(ctx, b) });
  for (const c of STOOL_CLUSTERS) items.push({ y: c.y - 4, draw: (ctx) => drawStoolCluster(ctx, c) });
  for (const t of HEDGE) items.push({ y: t.y, draw: (ctx) => drawBamboo(ctx, t) });
  for (const e of EGRETS) items.push({ y: e.y, draw: (ctx, open) => drawEgret(ctx, e, open.t) });
  items.push(...gateParts(), banner(), ...DECOR, ...GREENERY);
  for (const p of POLES) items.push({ y: p.y, draw: (ctx) => pole(ctx, p) });
  for (const l of LAMPS) items.push({ y: l.y, draw: (ctx, open, glow) => lamp(ctx, l, glow) });
  return items;
}

/** Sagging wires between the poles, drawn last: they hang over everything. */
export function drawWires(ctx) {
  for (let k = 0; k < POLES.length - 1; k += 1) {
    const a = POLES[k];
    const b = POLES[k + 1];
    for (let wire = 0; wire < 3; wire += 1) {
      thinLine(ctx, INK, 0.5, () => { ctx.moveTo(a.x, a.y - 42 + wire * 2); ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 30 + wire * 3, b.x, b.y - 42 + wire * 2); });
    }
  }
}

/** Night: pools of lamplight on the ground. */
export function drawLampGlows(ctx, glow) {
  if (glow <= 0) return;
  for (const l of LAMPS) {
    const g = ctx.createRadialGradient(l.x + 6, l.y - 6, 1, l.x + 6, l.y, 38);
    g.addColorStop(0, `rgba(255, 230, 140, ${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255, 230, 140, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x + 6, l.y, 38, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const isMarketOpen = (hour) => hour >= findPlace('cho').open[0] && hour < findPlace('cho').open[1];
