// Materials painted on canvas at load time: no image files to fetch for the Vietnamese bits that no stock
// texture has (lime-wash with moss, green louvred shutters, chuồng cọp cages, lá nem pavement tiles, clay tile
// roofs, corrugated iron). Each painter is seeded, so the xóm looks the same on every visit.
import * as THREE from '../vendor/three/three.module.min.js';
import { MAP, NODES } from '../map.js';
import { PLACES } from '../places.js';
import { noise } from '../rng.js';
import { heightsFrom, normalsFrom, roughnessFrom, soften } from './relief.js';

const canvas = (w, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const rnd = (k, s) => noise(k, s, 7177);

let reliefOn = false;
/** Whether materials get normal and roughness maps (the quality tier decides, before anything is built). */
export const setRelief = (on) => { reliefOn = on; };

/**
 * Give a material bumps from its own colour map (relief.js): a normal map and a roughness map that tile and
 * repeat exactly as the picture does. `strength` is how deep the grout and cracks read. Returns the material.
 */
export function embossed(material, strength = 1.5) {
  const src = material.map?.image;
  if (!reliefOn || !src?.getContext) return material;
  const { width: w, height: h } = src;
  const heights = soften(heightsFrom(src.getContext('2d').getImageData(0, 0, w, h).data, w, h), w, h);
  const make = (bytes) => {
    const c = canvas(w, h);
    c.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0);
    const t = texture(c, { srgb: false, repeat: material.map.wrapS === THREE.RepeatWrapping });
    t.repeat.copy(material.map.repeat);
    t.anisotropy = material.map.anisotropy;
    return t;
  };
  material.normalMap = make(normalsFrom(heights, w, h, strength));
  material.roughnessMap = make(roughnessFrom(heights, w, h));
  return material;
}

export function texture(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Speckle, blotches and streaks over a filled canvas: the grime that makes a flat colour look real. */
function grime(ctx, w, h, seed, { blotches = 60, specks = 2600, streaks = 40, alpha = 0.08, dark = '30,25,20' } = {}) {
  for (let k = 0; k < blotches; k += 1) {
    const x = rnd(k, seed) * w;
    const y = rnd(k, seed + 1) * h;
    const r = 10 + rnd(k, seed + 2) * w * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = alpha * (0.4 + rnd(k, seed + 3));
    g.addColorStop(0, `rgba(${rnd(k, seed + 4) < 0.5 ? dark : '255,250,235'},${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let k = 0; k < specks; k += 1) {
    ctx.fillStyle = `rgba(${dark},${0.05 + rnd(k, seed + 5) * 0.12})`;
    ctx.fillRect(rnd(k, seed + 6) * w, rnd(k, seed + 7) * h, 1 + rnd(k, seed + 8) * 2, 1 + rnd(k, seed + 9) * 2);
  }
  for (let k = 0; k < streaks; k += 1) { // rain runs down from the sills and the roof edge
    const x = rnd(k, seed + 10) * w;
    const y = rnd(k, seed + 11) * h * 0.6;
    const len = 30 + rnd(k, seed + 12) * h * 0.4;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(${dark},${alpha * 1.4})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + rnd(k, seed + 13) * 6, len);
  }
}

/** Moss and damp creeping up from the ground: the bottom band of every old wall in Hà Nội. */
function damp(ctx, w, h, from) {
  const g = ctx.createLinearGradient(0, h * from, 0, h);
  g.addColorStop(0, 'rgba(60,70,40,0)');
  g.addColorStop(1, 'rgba(55,65,35,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h * from, w, h * (1 - from));
}

/** Plain lime-wash for the side and back walls; tinted by the material colour. */
export function plaster() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(0, 0, 512, 512);
  grime(ctx, 512, 512, 11, { blotches: 90, streaks: 70, alpha: 0.1 });
  for (let k = 0; k < 16; k += 1) { // patches where the wash flaked off: a ragged edge, the brick courses showing inside
    if (rnd(k, 31) > 0.3) continue;
    const x = 30 + rnd(k, 32) * 450;
    const y = 30 + rnd(k, 33) * 450;
    const r = 8 + rnd(k, 34) * 20;
    ctx.save();
    ctx.beginPath();
    for (let a = 0; a < 14; a += 1) {
      const ang = (a / 14) * Math.PI * 2;
      const rr = r * (0.55 + rnd(k * 14 + a, 35) * 0.7);
      ctx.lineTo(x + Math.cos(ang) * rr * 1.3, y + Math.sin(ang) * rr * 0.8);
    }
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#b9b0a0'; // the mortar
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    for (let row = -6; row < 6; row += 1) {
      for (let col = -5; col < 5; col += 1) {
        const tone = 0.8 + rnd(row * 11 + col + k, 36) * 0.3;
        ctx.fillStyle = `rgb(${165 * tone},${88 * tone},${62 * tone})`;
        ctx.fillRect(x + col * 14 + (row % 2 ? 7 : 0), y + row * 7, 12.5, 5.5);
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,50,40,0.28)'; // the shadow under the lip of the wash
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return texture(c);
}

/**
 * One bay of an upper floor (4 m wide, one storey tall), painted in the house's own colour: a window with
 * green louvred shutters folded open, iron bars, and (on some) a chuồng cọp cage. Returns the colour map and
 * an emissive map that lights only the glass at night.
 */
export function facadeBay(color, variant = 0) {
  const W = 512;
  const H = 410; // 4 m by 3.2 m
  const c = canvas(W, H);
  const e = canvas(W, H);
  const ctx = c.getContext('2d');
  const ex = e.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  grime(ctx, W, H, 40 + variant * 7, { blotches: 50, streaks: 50, alpha: 0.11 });
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  // a thin cornice line at the floor slab
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, H - 22, W, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, H - 28, W, 6);
  const wx = 156;
  const wy = 90;
  const ww = 200;
  const wh = 210;
  // the glass behind the bars: dark by day, warm at night (emissive)
  ctx.fillStyle = '#2b2a2a';
  ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = 'rgba(120,140,150,0.25)';
  ctx.fillRect(wx + 8, wy + 8, ww / 2 - 12, wh - 16);
  ex.fillStyle = variant % 3 === 2 ? '#ffd9a0' : '#ffc070';
  ex.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; // sill and lintel shadows
  ctx.fillRect(wx - 14, wy - 14, ww + 28, 10);
  ctx.fillStyle = '#e8e0cf';
  ctx.fillRect(wx - 14, wy + wh, ww + 28, 12);
  // the shutters, open flat against the wall either side
  const green = ['#2f6b4f', '#3c7a55', '#2a5f5a', '#5a7a3a'][variant % 4];
  for (const sx of [wx - 96, wx + ww]) {
    ctx.fillStyle = green;
    ctx.fillRect(sx + 4, wy, 92, wh);
    for (let y = wy + 10; y < wy + wh - 6; y += 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(sx + 12, y, 76, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(sx + 12, y + 4, 76, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 6, wy + 2, 88, wh - 4);
  }
  // iron bars (or the cage, drawn a little bigger and rusty)
  const cage = variant % 2 === 1;
  ctx.strokeStyle = cage ? '#4b3a30' : '#3a3a3a';
  ctx.lineWidth = cage ? 5 : 4;
  const [bx0, bx1, by0, by1] = cage ? [wx - 10, wx + ww + 10, wy - 6, wy + wh + 6] : [wx, wx + ww, wy, wy + wh];
  for (let x = bx0 + 14; x < bx1; x += cage ? 22 : 26) { ctx.beginPath(); ctx.moveTo(x, by0); ctx.lineTo(x, by1); ctx.stroke(); }
  for (const y of [by0 + 4, (by0 + by1) / 2, by1 - 4]) { ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke(); }
  if (cage) { ctx.fillStyle = 'rgba(120,60,30,0.35)'; ctx.fillRect(bx0, by1 - 10, bx1 - bx0, 10); } // rust bleeding down
  damp(ctx, W, H, 0.92);
  return { map: texture(c), emissiveMap: texture(e) };
}

/** The ground floor of a house: a folding iron gate (cửa xếp) or old wooden doors, a step (the house number is a decal: decals3d.js). */
export function groundBay(color, variant = 0) {
  const W = 512;
  const H = 410;
  const c = canvas(W, H);
  const e = canvas(W, H);
  const ctx = c.getContext('2d');
  const ex = e.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  grime(ctx, W, H, 70 + variant * 5, { blotches: 60, streaks: 30, alpha: 0.14 });
  damp(ctx, W, H, 0.7);
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  const dx = 96;
  const dw = 320;
  const dy = 70;
  ctx.fillStyle = '#1e1c1a';
  ctx.fillRect(dx, dy, dw, H - dy);
  ex.fillStyle = '#7a5a30';
  ex.fillRect(dx, dy, dw, H - dy);
  if (variant % 2 === 0) { // cửa xếp: vertical slats with diamond lattice, half pulled open
    ctx.fillStyle = '#5f6a6e';
    for (let x = dx; x < dx + dw * 0.55; x += 16) ctx.fillRect(x, dy, 6, H - dy);
    ctx.strokeStyle = '#4a5457';
    ctx.lineWidth = 3;
    for (let y = dy; y < H; y += 40) {
      ctx.beginPath();
      for (let x = dx; x < dx + dw * 0.55; x += 32) { ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 20); ctx.lineTo(x + 32, y); }
      ctx.stroke();
    }
  } else { // old wooden doors with panels, one leaf open
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(dx, dy, dw / 2, H - dy);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    for (const [y, h] of [[dy + 20, 120], [dy + 160, 140]]) ctx.strokeRect(dx + 22, y, dw / 2 - 44, h);
  }
  ctx.fillStyle = '#9a958c'; // the step
  ctx.fillRect(dx - 16, H - 18, dw + 32, 18);
  return { map: texture(c), emissiveMap: texture(e) };
}

/** A shop sign: hand-painted letters on a tin board, as on every Vietnamese street. */
export function signTexture(text, bg = '#c1121f', fg = '#fff6e5') {
  const c = canvas(1024, 160);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 160);
  grime(ctx, 1024, 160, 90, { blotches: 20, specks: 900, streaks: 12, alpha: 0.12 });
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 140);
  ctx.fillStyle = fg;
  ctx.font = '800 84px "Be Vietnam Pro", "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 512, 84, 960);
  return texture(c, { repeat: false });
}

/** Clay tile roof: overlapping rows of curved tiles, moss in the gaps. */
export function roofTiles() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a3a26';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      const x = col * 32 + (row % 2) * 16;
      const y = row * 32;
      const tone = 0.75 + rnd(row * 16 + col, 51) * 0.35;
      const g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, `rgb(${120 * tone},${55 * tone},${36 * tone})`);
      g.addColorStop(0.5, `rgb(${178 * tone},${88 * tone},${58 * tone})`);
      g.addColorStop(1, `rgb(${110 * tone},${50 * tone},${32 * tone})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 31, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y + 28, 31, 4);
    }
  }
  grime(ctx, 512, 512, 55, { blotches: 70, specks: 1800, streaks: 0, alpha: 0.16, dark: '40,50,25' });
  return texture(c);
}

/** Corrugated iron (tôn), some sheets newer than others, rust at the laps. */
export function corrugated() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  for (let x = 0; x < 512; x += 1) {
    const s = Math.sin((x / 512) * Math.PI * 2 * 24);
    const v = 120 + s * 38;
    ctx.fillStyle = `rgb(${v * 0.85},${v * 0.92},${v})`;
    ctx.fillRect(x, 0, 1, 512);
  }
  for (let k = 0; k < 5; k += 1) {
    ctx.fillStyle = `rgba(140,70,30,${0.15 + rnd(k, 61) * 0.3})`;
    ctx.fillRect(0, k * 102 + 90, 512, 12 + rnd(k, 62) * 14);
  }
  grime(ctx, 512, 512, 63, { blotches: 50, specks: 1200, streaks: 40, alpha: 0.18, dark: '110,55,25' });
  return texture(c);
}

/** Bare cement: flat roofs, alleys, the market floor. */
export function concrete(base = '#a19d94', seed = 0) {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  grime(ctx, 512, 512, 80 + seed, { blotches: 120, specks: 5000, streaks: 0, alpha: 0.14 });
  ctx.strokeStyle = 'rgba(40,35,30,0.35)'; // cracks
  for (let k = 0; k < 8; k += 1) {
    ctx.lineWidth = 1 + rnd(k, 84 + seed);
    ctx.beginPath();
    let x = rnd(k, 85 + seed) * 512;
    let y = rnd(k, 86 + seed) * 512;
    ctx.moveTo(x, y);
    for (let s = 0; s < 8; s += 1) { x += (rnd(k * 9 + s, 87) - 0.5) * 60; y += (rnd(k * 9 + s, 88) - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return texture(c);
}

/** Asphalt for the main road, across u (0..1 = kerb to kerb) and along v: patches, oil, worn lane lines. */
export function asphalt() {
  const c = canvas(512, 1024);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a4a4c';
  ctx.fillRect(0, 0, 512, 1024);
  grime(ctx, 512, 1024, 100, { blotches: 160, specks: 14000, streaks: 0, alpha: 0.18, dark: '20,20,22' });
  for (let k = 0; k < 6; k += 1) { // patches of newer, blacker tar
    ctx.fillStyle = 'rgba(25,25,27,0.55)';
    ctx.fillRect(rnd(k, 101) * 400, rnd(k, 102) * 950, 40 + rnd(k, 103) * 90, 30 + rnd(k, 104) * 110);
  }
  ctx.fillStyle = 'rgba(30,30,30,0.35)'; // the dark band where the tyres run
  for (const u of [0.24, 0.76]) ctx.fillRect(u * 512 - 40, 0, 80, 1024);
  ctx.fillStyle = 'rgba(235,232,220,0.75)';
  for (const u of [0.035, 0.965]) ctx.fillRect(u * 512 - 5, 0, 10, 1024);
  for (let v = 0; v < 1024; v += 256) ctx.fillRect(256 - 6, v + 40, 12, 140); // dashed centre line
  grime(ctx, 512, 1024, 105, { blotches: 30, specks: 3000, streaks: 0, alpha: 0.1, dark: '20,20,22' });
  return texture(c);
}

/** Gạch lá nem: the square red terracotta tiles of old pavements and courtyards. */
export function redTiles(size = 30) {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e5a4c';
  ctx.fillRect(0, 0, 512, 512);
  const n = Math.round(512 / size);
  const s = 512 / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const t = 0.78 + rnd(i * n + j, 111) * 0.3;
      ctx.fillStyle = `rgb(${168 * t},${84 * t},${58 * t})`;
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      if (rnd(i * n + j, 112) < 0.08) { ctx.fillStyle = 'rgba(40,30,20,0.4)'; ctx.fillRect(i * s + 2, j * s + 2, s - 4, (s - 4) / 2); } // a cracked one
    }
  }
  grime(ctx, 512, 512, 113, { blotches: 90, specks: 3000, streaks: 0, alpha: 0.14 });
  return texture(c);
}

/** Railway ballast: grey crushed stone. */
export function ballast() {
  const c = canvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6d6a64';
  ctx.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 2200; k += 1) {
    const v = 70 + rnd(k, 121) * 110;
    ctx.fillStyle = `rgb(${v},${v * 0.97},${v * 0.92})`;
    ctx.beginPath();
    ctx.arc(rnd(k, 122) * 256, rnd(k, 123) * 256, 1.5 + rnd(k, 124) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(c);
}

/** A cluster of leaves on a transparent card (alpha-tested): canopies are built from many of these. */
export function leafCard(hue = 100, seed = 0, broad = false) {
  const c = canvas(256);
  const ctx = c.getContext('2d');
  for (let k = 0; k < (broad ? 60 : 260); k += 1) {
    const a = rnd(k, 131 + seed) * Math.PI * 2;
    const r = Math.sqrt(rnd(k, 132 + seed)) * 110;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const l = 22 + rnd(k, 133 + seed) * 30;
    ctx.fillStyle = `hsl(${hue + (rnd(k, 134 + seed) - 0.5) * 24}, ${45 + rnd(k, 135) * 25}%, ${16 + rnd(k, 136 + seed) * 26}%)`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd(k, 137 + seed) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, broad ? 9 : 4, broad ? 34 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return texture(c, { repeat: false });
}

/** Rice paddies seen beyond the xóm: rows of young rice over muddy water. */
export function paddy() {
  const c = canvas(512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c6b3a';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 8) {
    for (let x = 0; x < 512; x += 6) {
      ctx.fillStyle = `hsl(${78 + rnd(x * 97 + y, 141) * 20}, 45%, ${28 + rnd(x + y * 89, 142) * 18}%)`;
      ctx.fillRect(x + rnd(x, y) * 2, y, 3, 5);
    }
  }
  ctx.fillStyle = 'rgba(90,75,50,0.6)'; // the earth bunds between fields
  ctx.fillRect(0, 0, 512, 10);
  ctx.fillRect(0, 0, 10, 512);
  return texture(c);
}

/**
 * The ground of the whole map in one texture (it never repeats): trodden earth, grass where nobody walks,
 * bare dirt in front of the houses and under the market, a little wet near the pond. A tiling photo of grass
 * adds the close-up detail (see terrain.js).
 */
export function groundMap() {
  const PX = 2;
  const c = canvas(MAP.w * PX, MAP.h * PX);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7d8a4a';
  ctx.fillRect(0, 0, c.width, c.height);
  grime(ctx, c.width, c.height, 151, { blotches: 900, specks: 0, streaks: 0, alpha: 0.18, dark: '90,70,40' });
  const dirt = (x, y, r, a = 0.55, col = '146,118,82') => {
    const g = ctx.createRadialGradient(x * PX, y * PX, 0, x * PX, y * PX, r * PX);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect((x - r) * PX, (y - r) * PX, r * 2 * PX, r * 2 * PX);
  };
  for (let k = 0; k < NODES.length; k += 2) dirt(NODES[k].x, NODES[k].y, 20, 0.35); // trodden along the ways
  for (const p of PLACES) {
    if (p.building) dirt(p.x + p.w / 2, p.front + 4, p.w * 0.6, 0.5);
    else if (p.y0 !== undefined && !p.pond) for (let x = p.x; x < p.x + p.w; x += 20) for (let y = p.y0; y < p.y1; y += 20) dirt(x, y, 22, 0.35);
    if (p.pond) dirt(p.pond.cx, p.pond.cy, p.pond.rx * 1.35, 0.7, '70,62,45');
  }
  return texture(c, { repeat: false, aniso: 16 });
}
