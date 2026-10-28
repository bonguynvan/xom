// Clutter that makes the xóm feel lived in, all decided by noise so it never moves: water jars, little earth-god
// altars, chicken coops, areca palms, piles of bricks and sand, parked cargo tricycles by the houses; potholes,
// puddles and straw drying on the alleys; bamboo trays of goods on the market floor.
import { INK, roundedPath, shade, shape, thinLine } from './duavit/paint.js';
import { NODES } from './map.js';
import { PLACES, findPlace } from './places.js';
import { noise } from './rng.js';

const fill = (ctx, color, build) => { ctx.fillStyle = color; ctx.beginPath(); build(); ctx.fill(); };

function jar(ctx, x, y) {
  fill(ctx, '#7a4a2a', () => ctx.ellipse(x, y - 4, 3.6, 4.4, 0, 0, Math.PI * 2));
  fill(ctx, '#5a341c', () => ctx.ellipse(x, y - 8, 2.6, 0.9, 0, 0, Math.PI * 2));
}

function altar(ctx, x, y) {
  shape(ctx, '#c1121f', () => ctx.rect(x - 3, y - 6, 6, 6), 0.5);
  fill(ctx, '#ffde00', () => ctx.rect(x - 1.5, y - 4.5, 3, 2.5));
  thinLine(ctx, '#8d6e4f', 0.4, () => { ctx.moveTo(x + 1, y - 6); ctx.lineTo(x + 1.5, y - 9); }); // a stick of incense
}

function coop(ctx, x, y) {
  shape(ctx, '#c9a06b', () => roundedPath(ctx, x - 6, y - 7, 12, 7, 3), 0.6);
  thinLine(ctx, '#8d6e4f', 0.4, () => { for (let k = x - 4; k < x + 6; k += 2.5) { ctx.moveTo(k, y - 6); ctx.lineTo(k, y); } });
}

function areca(ctx, x, y) {
  thinLine(ctx, '#8a7a5a', 1.4, () => { ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 40); });
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    fill(ctx, k % 2 ? '#5a9a45' : '#6aa84f', () => ctx.ellipse(x + 1 + Math.cos(a) * 6, y - 41 + Math.sin(a) * 2, 7, 1.8, a, 0, Math.PI * 2));
  }
}

function bricks(ctx, x, y) {
  fill(ctx, '#d9c08a', () => ctx.ellipse(x + 6, y - 2, 6, 3, 0, Math.PI, 0)); // sand
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3 - r; c += 1) shape(ctx, '#b85c38', () => ctx.rect(x - 7 + c * 4 + r * 2, y - 2.5 - r * 2.5, 4, 2.5), 0.3);
}

function cargoTrike(ctx, x, y) {
  fill(ctx, INK, () => { ctx.arc(x - 6, y - 2, 2, 0, Math.PI * 2); ctx.arc(x + 6, y - 2, 2, 0, Math.PI * 2); });
  shape(ctx, '#8d6e4f', () => ctx.rect(x - 9, y - 7, 12, 4), 0.5);
  thinLine(ctx, '#3d405b', 0.7, () => { ctx.moveTo(x + 3, y - 5); ctx.lineTo(x + 6, y - 2); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x + 6, y - 10); });
}

const BY_DOOR = [jar, altar, coop, areca, bricks, cargoTrike];

/** Things by the front doors of houses that face the viewer (a third of them get something). */
const doorThings = PLACES.filter((p) => p.kind === 'house' && p.door.y > p.front).flatMap((h) => {
  const r = noise(h.x, h.front, 101);
  if (r > 0.55) return [];
  const draw = BY_DOOR[Math.floor(noise(h.x, h.front, 102) * BY_DOOR.length)];
  const left = noise(h.x, h.front, 103) < 0.5;
  const x = left ? h.x + 5 : h.x + h.w - 5;
  const y = h.front + 3;
  const extra = r < 0.15 ? [{ y, draw: (ctx) => jar(ctx, left ? x + 7 : x - 7, y) }] : [];
  return [{ y, draw: (ctx) => draw(ctx, x, y) }, ...extra];
});

/** Bamboo trays of goods (and conical hats) on the market floor, between the stalls. */
const market = findPlace('cho');
/** Where the floor sellers sit with their trays (between the stalls, off the aisles). */
export const TRAYS = Array.from({ length: 28 }, (_, k) => ({ x: market.x + 14 + noise(k, 111) * (market.w - 28), y: market.y0 + 18 + noise(k, 112) * (market.y1 - market.y0 - 30), k }));
const trays = TRAYS;
function tray(ctx, t, open) {
  shape(ctx, '#d9b25f', () => ctx.ellipse(t.x, t.y, 7, 3, 0, 0, Math.PI * 2), 0.5);
  if (!open) return;
  for (let g = 0; g < 5; g += 1) fill(ctx, ['#4caf50', '#e63946', '#f2b705', '#8d6e63', '#ff8fab'][(t.k + g) % 5], () => ctx.arc(t.x - 4 + g * 2, t.y - 0.6 - (g % 2), 1.2, 0, Math.PI * 2));
  if (t.k % 3 === 0) fill(ctx, '#f2e2b6', () => { ctx.moveTo(t.x + 6, t.y - 1); ctx.lineTo(t.x + 10, t.y - 6); ctx.lineTo(t.x + 14, t.y - 1); ctx.closePath(); }); // a nón lá
}

/** Standing clutter, each with the ground y it stands on. */
export const DECOR = [
  ...doorThings,
  ...trays.map((t) => ({ y: t.y, draw: (ctx, open) => tray(ctx, t, open.cho) })),
];

/** Flat things on the ground: potholes and puddles on the alleys, straw drying near the paddies. */
export function drawGroundClutter(ctx) {
  for (let k = 0; k < 70; k += 1) {
    const n = NODES[Math.floor(noise(k, 121) * NODES.length)];
    const x = n.x + (noise(k, 122) - 0.5) * 6;
    const y = n.y + (noise(k, 123) - 0.5) * 4;
    if (noise(k, 124) < 0.5) fill(ctx, 'rgba(90, 75, 50, 0.35)', () => ctx.ellipse(x, y, 2.5 + noise(k, 125) * 2, 1.4, 0, 0, Math.PI * 2));
    else fill(ctx, 'rgba(120, 160, 190, 0.55)', () => ctx.ellipse(x, y, 4 + noise(k, 125) * 4, 1.8, 0, 0, Math.PI * 2));
  }
  for (let k = 0; k < 14; k += 1) { // straw drying in long golden strips
    const x = 30 + noise(k, 131) * 1340;
    const y = noise(k, 132) < 0.5 ? 663 : 24;
    fill(ctx, shade('#e9c46a', (noise(k, 133) - 0.5) * 0.2), () => ctx.ellipse(x, y, 16 + noise(k, 134) * 10, 2.4, 0, 0, Math.PI * 2));
  }
}
