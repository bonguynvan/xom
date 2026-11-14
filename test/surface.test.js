// Bumps from painted textures and the plan of the street's small marks: pure maths, no GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS, planDecals } from '../public/js/3d/decal-plan.js';
import { heightsFrom, normalsFrom, roughnessFrom, soften } from '../public/js/3d/relief.js';

const flat = (w, h, v) => new Uint8ClampedArray(w * h * 4).map((_, k) => (k % 4 === 3 ? 255 : v));

test('a flat picture gives a flat normal map and an even roughness', () => {
  const h = heightsFrom(flat(8, 8, 128), 8, 8);
  const n = normalsFrom(soften(h, 8, 8), 8, 8, 3);
  for (let k = 0; k < 64; k += 1) assert.deepEqual([...n.slice(k * 4, k * 4 + 4)], [128, 128, 255, 255]);
  const r = roughnessFrom(h, 8, 8);
  assert.ok(new Set(r.filter((_, k) => k % 4 === 1)).size === 1);
});

test('a groove tilts the normals away from it on both sides, more with more strength, and wraps at the edges', () => {
  const w = 16;
  const px = flat(w, w, 220);
  for (let y = 0; y < w; y += 1) for (const x of [0, 8]) px.fill(20, (y * w + x) * 4, (y * w + x) * 4 + 3); // dark columns at x = 0 (the edge) and x = 8
  const h = heightsFrom(px, w, w);
  const weak = normalsFrom(h, w, w, 1);
  const strong = normalsFrom(h, w, w, 4);
  const red = (n, x) => n[(5 * w + x) * 4];
  assert.ok(red(weak, 7) > 128 && red(weak, 9) < 128, 'left of the groove leans right (down into it), right of it leans left');
  assert.ok(red(strong, 7) > red(weak, 7));
  assert.ok(red(weak, w - 1) > 128 && red(weak, 1) < 128, 'the groove on the edge is felt from the other edge');
  assert.equal(red(weak, 4), 128, 'flat between the grooves');
  for (let k = 0; k < w * w; k += 1) { // every normal is unit length and points out of the surface
    const [x, y, z] = [strong[k * 4] / 127.5 - 1, strong[k * 4 + 1] / 127.5 - 1, strong[k * 4 + 2] / 127.5 - 1];
    assert.ok(z > 0 && Math.abs(Math.hypot(x, y, z) - 1) < 0.03);
  }
  const rough = roughnessFrom(h, w, w, 0.7, 1);
  assert.ok(rough[(5 * w + 8) * 4 + 1] > rough[(5 * w + 4) * 4 + 1], 'the groove is rougher than the face');
  assert.equal(h.length, w * w);
  assert.notEqual(soften(h, w, w), h, 'soften returns a new array');
});

const houses = Array.from({ length: 40 }, (_, k) => ({ x0: k * 6, x1: k * 6 + 5, z0: -10, z1: 0 }));
const road = { points: Array.from({ length: 30 }, (_, k) => ({ x: k * 10, z: 6 + Math.sin(k / 4) })), half: 2.7 };
const trees = [{ x: 20, z: 3 }, { x: 90, z: 3 }];

test('the street marks: the same plan every time, every cell inside the atlas', () => {
  const a = planDecals({ houses, road, trees });
  assert.deepEqual(a, planDecals({ houses, road, trees }));
  assert.ok(a.length > 80 && a.length < 400, String(a.length));
  for (const d of a) {
    assert.ok(d.cell.x >= 0 && d.cell.y >= 0 && d.cell.x + d.cell.w <= ATLAS.w && d.cell.y + d.cell.h <= ATLAS.h);
    assert.ok(d.w > 0 && d.h > 0 && ['s', 'e', 'w', 'up'].includes(d.face));
  }
  assert.deepEqual(planDecals({}), []);
});

test('atlas cells never overlap', () => {
  const cells = [...ATLAS.ads, ...ATLAS.flyers, ...ATLAS.stains, ...ATLAS.leaves, ATLAS.manhole, ...ATLAS.numbers];
  for (let i = 0; i < cells.length; i += 1) {
    for (let j = i + 1; j < cells.length; j += 1) {
      const [p, q] = [cells[i], cells[j]];
      assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${i} and ${j}`);
    }
  }
});

test('every house has its own number by the door, on its own front wall; wall marks stay on their wall', () => {
  const plan = planDecals({ houses, road, trees });
  const plates = plan.filter((d) => ATLAS.numbers.includes(d.cell));
  assert.equal(plates.length, houses.length);
  assert.equal(new Set(plates.map((d) => d.cell)).size, houses.length, 'no two houses share a number here');
  plates.forEach((d, k) => { assert.equal(d.z, houses[k].z1); assert.ok(d.x - d.w / 2 > houses[k].x0 && d.x + d.w / 2 < houses[k].x1); });
  for (const d of plan.filter((q) => q.face === 's' && !ATLAS.numbers.includes(q.cell))) {
    const b = houses.find((q) => q.z1 === d.z && d.x > q.x0 && d.x < q.x1);
    assert.ok(b && d.x - d.w / 2 >= b.x0 - 1e-9 && d.x + d.w / 2 <= b.x1 + 1e-9 && d.y - d.h / 2 > 0.3 && d.y + d.h / 2 < 2.6, JSON.stringify(d));
  }
  for (const d of plan.filter((q) => q.face === 'e' || q.face === 'w')) assert.ok(d.z > -10 && d.z < 0);
});

test('a shop front that stands open carries only its number, on the pier', () => {
  const shops = houses.map((h) => ({ ...h, shop: { x0: h.x0 + 0.4, x1: h.x1 - 0.4 } }));
  const plan = planDecals({ houses: shops }).filter((d) => d.face === 's');
  assert.equal(plan.length, shops.length);
  plan.forEach((d, k) => assert.ok(d.x - d.w / 2 >= shops[k].shop.x1 - 1e-9 && d.x + d.w / 2 <= shops[k].x1, 'beside the opening, not across it'));
});

test('oil stains and manholes lie on the road, leaves round the trees', () => {
  const plan = planDecals({ houses: [], road, trees });
  const onRoad = plan.filter((d) => ATLAS.stains.includes(d.cell) || d.cell === ATLAS.manhole);
  assert.ok(onRoad.length > 20);
  for (const d of onRoad) {
    const near = Math.min(...road.points.map((p) => Math.hypot(p.x - d.x, p.z - d.z)));
    assert.ok(near < road.half + 5.1, 'within the road (points are 10 m apart)');
    assert.equal(d.face, 'up');
  }
  assert.ok(plan.some((d) => d.cell === ATLAS.manhole));
  const leaves = plan.filter((d) => ATLAS.leaves.includes(d.cell));
  assert.equal(leaves.length, trees.length * 5);
  for (const d of leaves) assert.ok(trees.some((t) => Math.hypot(t.x - d.x, t.z - d.z) < 3));
});
