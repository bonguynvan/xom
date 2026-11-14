// The small marks of a lived-in street, painted into one atlas and built as one mesh (one draw call): blue
// enamel house numbers, stencilled adverts and paper flyers (all invented, no real brands or working phone
// numbers), oil stains, manhole covers, fallen leaves. decal-plan.js (pure) says where each one goes.
import * as THREE from '../vendor/three/three.module.min.js';
import { noise } from '../rng.js';
import { ATLAS, planDecals } from './decal-plan.js';
import { Builder } from './geom.js';
import { weathered } from './surface.js';
import { texture } from './textures.js';

const ADS = [['KHOAN CẮT', 'BÊ TÔNG'], ['THÔNG CỐNG', 'HÚT BỂ'], ['SƠN BẢ', 'CHỐNG THẤM'], ['SỬA KHOÁ', 'TẠI NHÀ'], ['GIA SƯ', 'TOÁN · VĂN'], ['SỬA ĐIỆN', 'NƯỚC'], ['MUA BÁN', 'ĐỒ CŨ'], ['HÀN XÌ', 'CỬA SẮT']];
const FLYERS = [['BÁN NHÀ', 'chính chủ'], ['CHO THUÊ', 'phòng trọ'], ['TÌM MÈO', 'mèo mướp lạc'], ['DẠY KÈM', 'Toán Lý Hoá'], ['HỌP TỔ', 'tối thứ bảy'], ['CẮT ĐIỆN', '8 giờ – 11 giờ'], ['TUYỂN THỢ', 'thợ may'], ['SỬA TIVI', 'lấy ngay']];
const rnd = (k, s) => noise(k, s, 9100);

function paintAtlas() {
  const c = Object.assign(document.createElement('canvas'), { width: ATLAS.w, height: ATLAS.h });
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ADS.forEach(([a, b], k) => { // sprayed through a stencil: one colour, broken edges, a made-up six-digit number of the time
    const { x, y, w, h } = ATLAS.ads[k];
    ctx.fillStyle = ['#1d3f8a', '#b3261e', '#1b1b1b', '#1d3f8a'][k % 4];
    ctx.font = '800 38px "Be Vietnam Pro", sans-serif';
    ctx.fillText(a, x + w / 2, y + 26, w - 12);
    ctx.fillText(b, x + w / 2, y + 64, w - 12);
    ctx.font = '800 30px "Be Vietnam Pro", sans-serif';
    ctx.fillText(`ĐT ${k + 2}${k + 1}0 00${k}`, x + w / 2, y + 104, w - 12);
    ctx.globalCompositeOperation = 'destination-out'; // the paint did not take everywhere
    for (let s = 0; s < 260; s += 1) { ctx.fillStyle = `rgba(0,0,0,${0.3 + rnd(s, k) * 0.7})`; ctx.fillRect(x + rnd(s, k + 20) * w, y + rnd(s, k + 40) * h, 1 + rnd(s, k + 60) * 5, 1 + rnd(s, k + 80) * 2); }
    ctx.globalCompositeOperation = 'source-over';
  });
  FLYERS.forEach(([a, b], k) => { // a sheet of paper, sun-yellowed, one corner torn
    const { x, y, w, h } = ATLAS.flyers[k];
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rnd(k, 1) - 0.5) * 0.14);
    ctx.fillStyle = ['#f3ecd8', '#efe6c8', '#f6f1e4', '#f1d9d2'][k % 4];
    ctx.beginPath();
    ctx.moveTo(-50, -56); ctx.lineTo(50, -56); ctx.lineTo(50, 44); ctx.lineTo(38, 56); ctx.lineTo(-50, 56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = k % 3 === 0 ? '#b3261e' : '#1b1b1b';
    ctx.font = '800 22px "Be Vietnam Pro", sans-serif';
    ctx.fillText(a, 0, -30, 92);
    ctx.fillStyle = '#333';
    ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
    ctx.fillText(b, 0, -6, 92);
    ctx.fillStyle = 'rgba(40,40,40,0.55)';
    for (let l = 0; l < 4; l += 1) ctx.fillRect(-40, 10 + l * 9, 50 + rnd(k, l + 2) * 30, 3);
    ctx.restore();
  });
  ATLAS.stains.forEach(({ x, y, w }, k) => { // oil: dark, soft-edged, a few blots
    for (let b = 0; b < 7; b += 1) {
      const cx = x + w / 2 + (rnd(k, b) - 0.5) * w * 0.45;
      const cy = y + w / 2 + (rnd(k, b + 10) - 0.5) * w * 0.45;
      const rad = w * (0.12 + rnd(k, b + 20) * 0.2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(14,13,16,0.6)');
      g.addColorStop(0.7, 'rgba(14,13,16,0.28)');
      g.addColorStop(1, 'rgba(14,13,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
  });
  ATLAS.leaves.forEach(({ x, y, w }, k) => { // fallen leaves, yellow to brown, thick in the middle
    for (let l = 0; l < 90; l += 1) {
      const a = rnd(l, k + 30) * Math.PI * 2;
      const d = Math.sqrt(rnd(l, k + 31)) * w * 0.44;
      ctx.save();
      ctx.translate(x + w / 2 + Math.cos(a) * d, y + w / 2 + Math.sin(a) * d);
      ctx.rotate(rnd(l, k + 32) * 6.3);
      ctx.fillStyle = `hsl(${22 + rnd(l, k + 33) * 38}, ${45 + rnd(l, k + 34) * 30}%, ${24 + rnd(l, k + 35) * 28}%)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9 + rnd(l, k + 36) * 5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  { // a cast-iron manhole cover in its concrete frame
    const { x, y, w } = ATLAS.manhole;
    const [cx, cy] = [x + w / 2, y + w / 2];
    ctx.fillStyle = '#8d897f';
    ctx.fillRect(x + 6, y + 6, w - 12, w - 12);
    ctx.fillStyle = '#3b3a3c';
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a585c';
    ctx.lineWidth = 5;
    for (const rad of [0.4, 0.3, 0.2]) { ctx.beginPath(); ctx.arc(cx, cy, w * rad, 0, Math.PI * 2); ctx.stroke(); }
    for (let s = 0; s < 12; s += 1) { const a = (s / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.1, cy + Math.sin(a) * w * 0.1); ctx.lineTo(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * w * 0.4); ctx.stroke(); }
  }
  ATLAS.numbers.forEach(({ x, y, w, h }, k) => { // the blue enamel plate with white figures
    ctx.fillStyle = '#1f4e9c';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = '800 21px "Be Vietnam Pro", sans-serif';
    ctx.fillText(String(k + 1), x + w / 2, y + h / 2 + 1);
  });
  return texture(c, { repeat: false, aniso: 8 });
}

/** `plan` inputs as decal-plan.js planDecals takes them. Adds one mesh to the scene. */
export function buildDecals(scene, inputs) {
  const plan = planDecals(inputs);
  const b = new Builder();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const LIFT = 0.012;
  for (const d of plan) {
    const u0 = d.cell.x / ATLAS.w;
    const u1 = (d.cell.x + d.cell.w) / ATLAS.w;
    const v0 = 1 - (d.cell.y + d.cell.h) / ATLAS.h;
    const v1 = 1 - d.cell.y / ATLAS.h;
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const [hw, hh] = [d.w / 2, d.h / 2];
    if (d.face === 's') b.quad(V(d.x - hw, d.y - hh, d.z + LIFT), V(d.x + hw, d.y - hh, d.z + LIFT), V(d.x + hw, d.y + hh, d.z + LIFT), V(d.x - hw, d.y + hh, d.z + LIFT), uv);
    else if (d.face === 'e') b.quad(V(d.x + LIFT, d.y - hh, d.z + hw), V(d.x + LIFT, d.y - hh, d.z - hw), V(d.x + LIFT, d.y + hh, d.z - hw), V(d.x + LIFT, d.y + hh, d.z + hw), uv);
    else if (d.face === 'w') b.quad(V(d.x - LIFT, d.y - hh, d.z - hw), V(d.x - LIFT, d.y - hh, d.z + hw), V(d.x - LIFT, d.y + hh, d.z + hw), V(d.x - LIFT, d.y + hh, d.z - hw), uv);
    else {
      const [c, s] = [Math.cos(d.spin), Math.sin(d.spin)];
      const P = (a, e) => V(d.x + c * a * hw + s * e * hh, d.y, d.z + s * a * hw - c * e * hh);
      b.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), uv);
    }
  }
  const material = weathered(new THREE.MeshStandardMaterial({ map: paintAtlas(), transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -32 }), 'roof');
  const mesh = new THREE.Mesh(b.build(), material);
  mesh.name = 'decals';
  mesh.receiveShadow = true;
  mesh.renderOrder = 3;
  scene.add(mesh);
  return { mesh, count: plan.length };
}
