import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { PLACES } from '../public/js/places.js';
import { M, blockers, boxGrid, collide, darkAt, footprint, heightOf, sunAt, toMap, toX, toZ, turnTowards, yawOf } from '../public/js/3d/coords.js';
import { resolvePath } from '../scripts/serve.js';

test('map to metres and back', () => {
  for (const [x, y] of [[0, 0], [700, 350], [1400, 700], [123.5, 456.25]]) {
    const p = toMap(toX(x), toZ(y));
    assert.ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
  }
  assert.equal(toX(700), 0);
  assert.ok(toZ(700) > 0, 'towards the viewer on the map is south (+Z) in 3D');
  assert.ok(M * 1400 > 150 && M * 1400 < 260, 'the xóm is a couple of hundred metres across');
});

test('headings and turning take the short way round', () => {
  assert.equal(yawOf(0, 1), 0);
  assert.ok(Math.abs(yawOf(1, 0) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(turnTowards(3.0, -3.0, 0.1) - 3.1) < 1e-9, 'across ±π, not the long way');
  assert.equal(turnTowards(0, 0.05, 0.1), 0.05);
});

test('nobody walks through a house or into the pond', () => {
  const { boxes, ponds } = blockers(PLACES, new Set(['cayBang', 'cayPhuong', 'phone']));
  assert.ok(boxes.length > 100, 'every tube house, shop and public building blocks');
  const index = boxGrid(boxes);
  const house = PLACES.find((p) => p.kind === 'house');
  const f = footprint(house);
  const inside = collide((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, 0.3, index, ponds);
  const out = boxes.every((b) => inside.X + 0.3 <= b.x0 + 1e-6 || inside.X - 0.3 >= b.x1 - 1e-6 || inside.Z + 0.3 <= b.z0 + 1e-6 || inside.Z - 0.3 >= b.z1 - 1e-6);
  assert.ok(out, 'pushed out of the house it stood in');
  const pond = ponds[0];
  const wet = collide(pond.cx, pond.cz + 0.5, 0.3, index, ponds);
  assert.ok(Math.hypot((wet.X - pond.cx) / (pond.rx + 0.3), (wet.Z - pond.cz) / (pond.rz + 0.3)) >= 0.999, 'out on the bank');
  const free = collide(toX(640), toZ(330), 0.3, index, ponds);
  assert.ok(Math.abs(free.X - toX(640)) < 1e-9, 'the road is free to walk');
});

test('the sun rises in the east, stands high in the south at noon and is down at night', () => {
  assert.ok(sunAt(7).x > 0.5 && sunAt(7).y > 0);
  assert.ok(sunAt(12).y > 0.9 && sunAt(12).z > 0);
  assert.ok(sunAt(17).x < -0.5);
  assert.ok(sunAt(23).y < 0 && sunAt(3).y < 0);
});

test('dark at night, bright by day, a dusk and a dawn in between', () => {
  assert.equal(darkAt(12), 0);
  assert.equal(darkAt(2), 1);
  assert.equal(darkAt(22), 1);
  assert.ok(darkAt(5.75) > 0 && darkAt(5.75) < 1);
  assert.ok(darkAt(19) > 0 && darkAt(19) < 1);
});

test('people are people-sized', () => {
  assert.ok(heightOf('walker', 15) > 1.5 && heightOf('walker', 15) < 1.8);
  assert.ok(heightOf('kid', 10) < 1.4);
  assert.ok(heightOf('walker', 40) <= 1.85, 'no giants');
});

test('vendored three.js modules import nothing by bare name (no importmap: the CSP forbids inline scripts)', () => {
  const dir = new URL('../public/js/vendor/three/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && !n.endsWith('.min.js'))) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(text, /from\s+['"]three['"]/, f);
  }
});

test('3D pages, models and their textures are served; models carry no embedded images (blob: is refused by the CSP)', () => {
  for (const path of ['/index.html', '/js/3d/main3d.js', '/models/soldier.glb', '/models/michelle.glb', '/models/soldier-0.jpg', '/textures/grass.jpg']) assert.ok(resolvePath(path), path);
  const models = new URL('../public/models/', import.meta.url);
  for (const f of readdirSync(models).filter((n) => n.endsWith('.glb'))) {
    const data = readFileSync(new URL(f, models));
    const json = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString('utf8'));
    for (const image of json.images ?? []) {
      assert.equal(image.bufferView, undefined, `${f}: run scripts/unpack-glb.js`);
      assert.ok(statSync(new URL(image.uri, models)).size > 0, `${f}: ${image.uri}`);
    }
  }
});

test('3D code sets no inline styles in HTML; only session.js keeps anything in the browser (the chosen character)', () => {
  const dir = new URL('../public/js/3d/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(text, /innerHTML|setAttribute\(\s*['"]style|sessionStorage|document\.cookie|indexedDB/, f);
    if (f !== 'session.js') assert.doesNotMatch(text, /localStorage/, f);
  }
  assert.doesNotMatch(readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'), /style=|<script>(?!<\/script>)|<style/);
});
