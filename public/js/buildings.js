// The houses and shops of the xóm. A facade is drawn side-on in the old street units (base on HOUSE_BASE)
// and shrunk by K onto its row; the roof is drawn above it as seen from the sky, scroll-painting style.
// Details (peeling paint, which windows glow at night) come from noise(x), so they never flicker.
import { FONT, INK, circle, ellipse, roundedPath, shade, shape, stroke, thinLine } from './duavit/paint.js';
import { FLOOR, HOUSE_BASE, groundFloor, tubeHouse } from './facade.js';
import { K } from './map.js';
import { noise } from './rng.js';

const ROOF_DEPTH = 0.6; // roofs are foreshortened: we look down at them at an angle


/** A hand-painted signboard. */
export function sign(ctx, text, x, y, w, bg = '#c1121f', fg = '#fff6e5', size = 12) {
  shape(ctx, bg, () => roundedPath(ctx, x, y, w, size + 10, 3), 2);
  ctx.fillStyle = fg;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + (size + 10) / 2 + 1);
}

function stool(ctx, x, y, color) {
  shape(ctx, color, () => roundedPath(ctx, x - 6, y - 12, 12, 4, 1.5), 1.5);
  stroke(ctx, color, 2, () => { ctx.moveTo(x - 5, y - 8); ctx.lineTo(x - 6, y); ctx.moveTo(x + 5, y - 8); ctx.lineTo(x + 6, y); });
}

function tree(ctx, cx, leaf, flowers) {
  shape(ctx, '#6b4226', () => { ctx.moveTo(cx - 9, HOUSE_BASE + 4); ctx.lineTo(cx - 6, HOUSE_BASE - 70); ctx.lineTo(cx + 6, HOUSE_BASE - 70); ctx.lineTo(cx + 9, HOUSE_BASE + 4); ctx.closePath(); });
  [[-34, -92, 30], [0, -112, 36], [34, -92, 30], [-14, -80, 26], [18, -78, 26]].forEach(([dx, dy, r], k) => {
    circle(ctx, cx + dx, HOUSE_BASE + dy, r, k % 2 ? leaf : shade(leaf, -0.08));
  });
  if (flowers) for (let k = 0; k < 14; k += 1) circle(ctx, cx - 44 + noise(cx, k, 1) * 88, HOUSE_BASE - 70 - noise(cx, k, 2) * 60, 3.5, flowers);
}

const SHOP = {
  traDa(ctx, p) {
    sign(ctx, p.name, p.x + 20, HOUSE_BASE - 64, 130, '#3f8f6b');
    shape(ctx, '#8d5a2b', () => roundedPath(ctx, p.x + 120, HOUSE_BASE - 22, 40, 22, 3));
    ['#c9d6df', '#a8dadc', '#c9d6df'].forEach((col, k) => shape(ctx, col, () => roundedPath(ctx, p.x + 124 + k * 12, HOUSE_BASE - 34, 9, 12, 2), 1.2));
    p.spots.forEach((s, k) => stool(ctx, p.x + s.dx, HOUSE_BASE + 12 + s.depth * 26, k % 2 ? '#e63946' : '#2d9cdb'));
  },
  suaXe(ctx, p) {
    sign(ctx, p.name, p.x + 10, HOUSE_BASE - 64, 120, '#e9d18c', '#1d1a2f', 11);
    for (let k = 0; k < 3; k += 1) { circle(ctx, p.x + 112, HOUSE_BASE - 12 - k * 10, 11, '#2b2d42'); circle(ctx, p.x + 112, HOUSE_BASE - 12 - k * 10, 5, shade('#2b2d42', 0.3)); }
  },
  cayBang: (ctx, p) => { tree(ctx, p.x + p.w / 2, '#3d8b3d'); bench(ctx, p); },
  cayPhuong: (ctx, p) => { tree(ctx, p.x + p.w / 2, '#4caf50', '#e63946'); bench(ctx, p); },
  hieuAnh(ctx, p) {
    sign(ctx, p.name, p.x + 14, HOUSE_BASE - 66, 92, '#c1121f');
    [0, 1, 2].forEach((k) => shape(ctx, ['#ffd23f', '#a8dadc', '#ef476f'][k], () => ctx.rect(p.x + 20 + k * 28, HOUSE_BASE - 34, 22, 26), 1.5));
  },
  phone(ctx, p) {
    shape(ctx, '#f2b705', () => roundedPath(ctx, p.x + 12, HOUSE_BASE - 70, 36, 74, 6));
    shape(ctx, '#a8dadc', () => ctx.rect(p.x + 18, HOUSE_BASE - 58, 24, 30), 1.5);
    circle(ctx, p.x + 30, HOUSE_BASE - 66, 3, '#c1121f');
  },
  tapHoa(ctx, p) {
    sign(ctx, p.name, p.x + 14, HOUSE_BASE - 66, 122, '#2d5aa0');
    for (let row = 0; row < 2; row += 1) {
      for (let k = 0; k < 5; k += 1) shape(ctx, ['#f2b705', '#e63946', '#2d9cdb', '#4caf50', '#ef476f'][(k + row) % 5], () => ctx.rect(p.x + 18 + k * 23, HOUSE_BASE - 38 + row * 16, 18, 12), 1);
    }
  },
  pho(ctx, p) {
    sign(ctx, 'PHỞ', p.x + 40, HOUSE_BASE - 70, 80, '#f2b705', '#c1121f', 16);
    shape(ctx, '#9aa0aa', () => roundedPath(ctx, p.x + 12, HOUSE_BASE - 30, 28, 30, 5));
    p.spots.forEach((s, k) => stool(ctx, p.x + s.dx, HOUSE_BASE + 12 + s.depth * 26, k % 2 ? '#2d9cdb' : '#e63946'));
  },
  catToc(ctx, p) {
    tree(ctx, p.x + 30, '#3d8b3d');
    shape(ctx, '#a8dadc', () => roundedPath(ctx, p.x + 22, HOUSE_BASE - 60, 18, 24, 3), 2);
    sign(ctx, p.name, p.x + 56, HOUSE_BASE - 52, 60, '#2b2d42', '#fff6e5', 10);
  },
  bangDia(ctx, p) {
    sign(ctx, p.name, p.x + 8, HOUSE_BASE - 66, 114, '#9b5de5');
    shape(ctx, '#2b2d42', () => roundedPath(ctx, p.x + 96, HOUSE_BASE - 40, 22, 40, 3));
    circle(ctx, p.x + 107, HOUSE_BASE - 28, 7, '#5c5873');
    circle(ctx, p.x + 107, HOUSE_BASE - 12, 5, '#5c5873');
  },
  buuDien(ctx, p) {
    sign(ctx, 'BƯU ĐIỆN', p.x + 30, HOUSE_BASE - 70, 110, '#f2b705', '#1d1a2f', 13);
    shape(ctx, '#2a9d8f', () => roundedPath(ctx, p.x + 140, HOUSE_BASE - 34, 20, 34, 4));
    shape(ctx, '#1d1a2f', () => ctx.rect(p.x + 144, HOUSE_BASE - 26, 12, 3), 1);
  },
  che(ctx, p) {
    sign(ctx, p.name, p.x + 30, HOUSE_BASE - 66, 70, '#ef476f');
    ['#3d405b', '#f4f1ea', '#e9d18c', '#4caf50'].forEach((col, k) => shape(ctx, col, () => roundedPath(ctx, p.x + 10 + k * 18, HOUSE_BASE - 30, 14, 18, 3), 1.2));
    p.spots.forEach((s, k) => stool(ctx, p.x + s.dx, HOUSE_BASE + 12 + s.depth * 26, k % 2 ? '#e63946' : '#f2b705'));
  },
  hieuMay(ctx, p) {
    sign(ctx, 'May đo', p.x + 20, HOUSE_BASE - 66, 90, '#c94f7c');
    ellipse(ctx, p.x + 100, HOUSE_BASE - 44, 10, 6, '#e9b98f');
    shape(ctx, '#9b5de5', () => roundedPath(ctx, p.x + 90, HOUSE_BASE - 40, 20, 30, 6));
  },
};

function bench(ctx, p) {
  shape(ctx, '#9aa0aa', () => roundedPath(ctx, p.x + 30, HOUSE_BASE + 4, p.w - 60, 6, 2));
  stroke(ctx, '#7f8c8d', 3, () => { ctx.moveTo(p.x + 36, HOUSE_BASE + 10); ctx.lineTo(p.x + 36, HOUSE_BASE + 20); ctx.moveTo(p.x + p.w - 36, HOUSE_BASE + 10); ctx.lineTo(p.x + p.w - 36, HOUSE_BASE + 20); });
  shape(ctx, '#e9d18c', () => ctx.rect(p.x + p.w / 2 - 12, HOUSE_BASE - 2, 24, 6), 1); // xiangqi board
}

const OUTDOOR = new Set(['cayBang', 'cayPhuong', 'phone']);
/** A filled dot with no outline: at map scale an ink ring would swallow it. */
const dot = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const oldX = (p) => p.x / K;
const floorsOf = (p) => p.floors ?? (2 + Math.floor(noise(oldX(p), 9) * 2));
/** Facade height in map units, up to the top of the parapet. */
export const facadeHeight = (p) => (OUTDOOR.has(p.kind) ? 0 : (floorsOf(p) * FLOOR + 16) * K);

/** Run `draw` in facade units for place p (so the old side-on drawings land on the map). */
function inFacade(ctx, p, draw) {
  ctx.save();
  ctx.translate(0, p.front);
  ctx.scale(K, K);
  ctx.translate(0, -HOUSE_BASE);
  draw({ ...p, x: oldX(p), w: p.w / K, spots: p.facadeSpots ?? [] });
  ctx.restore();
}

/** The roof seen from above: flat concrete with a water tank and pots, or old clay tiles. */
function roof(ctx, p) {
  const h = facadeHeight(p);
  const d = p.depth * ROOF_DEPTH;
  const top = p.front - h - d;
  const kind = noise(oldX(p), 21);
  ctx.lineJoin = 'round';
  if (kind < 0.3) { // old clay tiles
    shape(ctx, '#b85c38', () => ctx.rect(p.x - 1, top, p.w + 2, d + 1), 1);
    thinLine(ctx, shade('#b85c38', -0.25), 0.6, () => { for (let y = top + 3; y < top + d; y += 3) { ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); } });
    return;
  }
  if (kind < 0.55) { // corrugated iron, a little rusty
    const tin = ['#5b8fb0', '#5e9c76', '#a4553a'][Math.floor(noise(oldX(p), 26) * 3)];
    shape(ctx, tin, () => ctx.rect(p.x - 1, top, p.w + 2, d + 1), 1);
    thinLine(ctx, shade(tin, -0.22), 0.5, () => { for (let x = p.x + 2; x < p.x + p.w; x += 2.5) { ctx.moveTo(x, top); ctx.lineTo(x, top + d); } });
    ctx.fillStyle = 'rgba(140, 70, 30, 0.35)';
    ctx.fillRect(p.x + noise(oldX(p), 27) * p.w * 0.6, top + 2, p.w * 0.25, d * 0.5);
    return;
  }
  shape(ctx, '#d9d3c3', () => ctx.rect(p.x, top, p.w, d + 1), 1);
  if (noise(oldX(p), 22) < 0.6) { // brick water tank
    const tx = p.x + 6 + noise(oldX(p), 23) * (p.w - 14);
    shape(ctx, '#9c9488', () => ctx.rect(tx - 5, top + 2, 10, 7), 0.8);
  }
  if (noise(oldX(p), 24) < 0.5) { // potted plants along the parapet
    for (let k = 0; k < 3; k += 1) dot(ctx, p.x + 4 + k * 5, top + d - 3, 1.8, k % 2 ? '#4caf50' : '#3d8b3d');
  }
  const ax = p.x + p.w * (0.3 + noise(oldX(p), 7) * 0.4); // fishbone TV antenna
  thinLine(ctx, INK, 0.5, () => {
    ctx.moveTo(ax, top + d * 0.5);
    ctx.lineTo(ax, top - 9);
    for (let k = 0; k < 3; k += 1) { ctx.moveTo(ax - 3 + k, top - 8 + k * 2); ctx.lineTo(ax + 3 - k, top - 8 + k * 2); }
  });
  if (noise(oldX(p), 25) < 0.4) { // washing on the roof
    thinLine(ctx, INK, 0.5, () => { ctx.moveTo(p.x + 3, top + 5); ctx.lineTo(p.x + p.w - 3, top + 7); });
    ['#ef476f', '#2d9cdb', '#ffd23f'].forEach((col, k) => { ctx.fillStyle = col; ctx.fillRect(p.x + 6 + k * 6, top + 5.5, 3, 3); });
  }
}

/** One building on its row: roof, then the facade (and its stools and signs on the pavement). */
export function drawBuilding(ctx, p) {
  if (!OUTDOOR.has(p.kind)) roof(ctx, p);
  inFacade(ctx, p, (old) => {
    if (!OUTDOOR.has(old.kind)) tubeHouse(ctx, old, floorsOf(p), old.color ?? ['#f2c94c', '#f4a6a0', '#9ccf9a', '#8ec5e8', '#f6d7a7'][Math.floor(noise(old.x, 8) * 5)]);
    if (old.kind === 'house') groundFloor(ctx, old.x, old.w);
    else SHOP[old.kind]?.(ctx, old);
  });
}

/** Night: a lit ground floor, drawn with the building (people in front of it cover it). */
export function drawDoorGlow(ctx, p, glow) {
  if (glow <= 0 || OUTDOOR.has(p.kind)) return;
  inFacade(ctx, p, (old) => {
    if (noise(old.x, 12) >= 0.7) return;
    ctx.globalAlpha = Math.min(1, glow * 1.4);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(old.x + 14, HOUSE_BASE - 38, old.w - 28, 36);
  });
}

/** Night: upper windows that glow (per building and floor, so they never flicker). Above head height. */
export function drawWindowLights(ctx, p, glow) {
  if (glow <= 0 || OUTDOOR.has(p.kind)) return;
  inFacade(ctx, p, (old) => {
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#ffd970';
    const floors = floorsOf(p);
    for (let f = 1; f < floors; f += 1) {
      if (noise(old.x, f, 11) > 0.65) continue;
      const fy = HOUSE_BASE - f * FLOOR;
      const cols = old.w > 115 ? 2 : 1;
      for (let c = 0; c < cols; c += 1) ctx.fillRect(old.x + (old.w / (cols + 1)) * (c + 1) - 11, fy - 34, 22, 20);
    }
  });
}
