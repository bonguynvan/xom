// The details near the player and the street's sound: pure plans, no GPU, no audio device.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK, ROOM, balconyFor, bicycleSpots, chunkKey, chunksNear, hasBalcony, interiorFor, shopOpening, visibleChunks } from '../public/js/3d/detail-plan.js';
import { ambience, duck, enginePitch, footfalls, footstep, gainAt, pickVoices, surfaceKind, vendorCall } from '../public/js/3d/sound-plan.js';
import { ROAD_LINE, yOn } from '../public/js/map.js';

const box = { x0: 10, x1: 16, z0: -8, z1: 0 };

test('a shop opening leaves a pier each side and a room behind; a narrow or shallow shop has none', () => {
  const o = shopOpening(box);
  assert.deepEqual([o.x0, o.x1, o.front], [10 + ROOM.pier, 16 - ROOM.pier, 0]);
  assert.ok(o.back < o.front && o.back > box.z0, 'the room stays inside the building');
  assert.equal(shopOpening({ x0: 0, x1: 2.5, z0: -8, z1: 0 }), null);
  assert.equal(shopOpening({ x0: 0, x1: 6, z0: -2, z1: 0 }), null);
});

test('everything in a shop stands inside its room, the same on every visit, and each kind is dressed', () => {
  const o = shopOpening(box);
  for (const kind of ['tapHoa', 'bangDia', 'hieuMay', 'pho', 'traDa', 'suaXe', 'catToc', 'hieuAnh', 'buuDien', 'che', 'unknown']) {
    const items = interiorFor(kind, o, 7);
    assert.deepEqual(items, interiorFor(kind, o, 7), kind);
    assert.ok(items.length > 15 && items.length < 140, `${kind}: ${items.length}`);
    for (const it of items) {
      assert.ok(it.p[0] - it.d[0] / 2 >= o.x0 - 1e-6 && it.p[0] + it.d[0] / 2 <= o.x1 + 1e-6, `${kind} x ${JSON.stringify(it)}`);
      assert.ok(it.p[1] - it.d[1] / 2 >= -1e-6 && it.p[1] + it.d[1] / 2 <= o.top + 1e-6, `${kind} y ${JSON.stringify(it)}`);
      assert.ok(it.p[2] - it.d[2] / 2 >= o.back - 1e-6 && it.p[2] + it.d[2] / 2 <= o.front + 1e-6, `${kind} z ${JSON.stringify(it)}`);
      assert.match(it.c, /^#[0-9a-f]{6}$/);
    }
    assert.equal(items.filter((it) => it.s === 'fan').length, 1);
  }
  assert.ok(interiorFor('bangDia', o, 1).some((it) => it.s === 'glow'), 'the record shop has its television on');
  assert.ok(!interiorFor('hieuMay', o, 1).some((it) => it.s === 'glow'));
  assert.notDeepEqual(interiorFor('tapHoa', o, 1), interiorFor('tapHoa', o, 2));
});

test('balcony things hang within the balcony; bicycles lean in front of their own house', () => {
  const b = { x0: 0, x1: 5, y: 3.4, z: 0, out: 0.85 };
  let some = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const items = balconyFor(b, seed);
    assert.deepEqual(items, balconyFor(b, seed));
    some += items.length;
    for (const it of items) {
      assert.ok(it.p[0] - it.d[0] / 2 >= b.x0 && it.p[0] + it.d[0] / 2 <= b.x1, JSON.stringify(it));
      assert.ok(it.p[1] - it.d[1] / 2 >= b.y - 1e-6 && it.p[1] + it.d[1] / 2 < b.y + 2.4);
      assert.ok(it.p[2] - it.d[2] / 2 >= b.z - 1e-6 && it.p[2] + it.d[2] / 2 <= b.z + b.out + 1e-6, JSON.stringify(it));
    }
  }
  assert.ok(some > 150, 'most balconies have something on them');
  assert.equal(typeof hasBalcony(120, 1), 'boolean');
  const houses = Array.from({ length: 200 }, (_, k) => ({ x0: k * 6, x1: k * 6 + 5, z0: -9, z1: 0 }));
  const bikes = bicycleSpots(houses);
  assert.ok(bikes.length > 20 && bikes.length < 70);
  for (const s of bikes) assert.ok(houses.some((h) => s.x > h.x0 && s.x < h.x1 && s.z > h.z1 && s.z < h.z1 + 0.6));
});

test('chunks: a point is in its own chunk, the near set grows with the radius, and shown chunks linger a little', () => {
  assert.equal(chunkKey(1, 1), '0,0');
  assert.equal(chunkKey(-1, CHUNK + 1), '-1,1');
  assert.ok(chunksNear(5, 5, 1).includes(chunkKey(5, 5)));
  assert.ok(chunksNear(5, 5, 60).length > chunksNear(5, 5, 20).length);
  const first = visibleChunks(new Set(), 12, 12, 25);
  const moved = visibleChunks(first, 12 + 28, 12, 25);
  const fresh = visibleChunks(new Set(), 12 + 28, 12, 25);
  assert.ok(moved.size >= fresh.size && [...fresh].every((k) => moved.has(k)));
  const far = visibleChunks(first, 500, 500, 25);
  assert.ok(![...first].some((k) => far.has(k)), 'far behind is dropped');
  assert.ok(first instanceof Set && first.size > 0);
});

test('underfoot: asphalt on the road, tiles on the pavement, earth out in the fields', () => {
  const y = yOn(ROAD_LINE, 600);
  assert.equal(surfaceKind(600, y), 'road');
  assert.equal(surfaceKind(600, y + 26), 'tiles');
  assert.equal(surfaceKind(600, y - 26), 'tiles');
  assert.equal(surfaceKind(-300, 690), 'earth');
});

test('a foot lands twice a stride, each exactly once however the frames fall', () => {
  assert.deepEqual(footfalls(0.01, 0.1), ['L']);
  assert.deepEqual(footfalls(0.5, 0.6), ['R']);
  assert.deepEqual(footfalls(0.1, 0.5), []);
  assert.deepEqual(footfalls(0.95, 0.07), ['L'], 'across the wrap');
  assert.deepEqual(footfalls(0.01, 0.9), ['L', 'R']);
  assert.deepEqual(footfalls(0.3, 0.3), []);
  let n = 0;
  let phase = 0;
  for (let k = 0; k < 1000; k += 1) { const next = (phase + 0.013 + (k % 7) * 0.003) % 1; n += footfalls(phase, next).length; phase = next; }
  const cycles = 1000 * (0.013 + 3 * 0.003);
  assert.ok(Math.abs(n - cycles * 2) <= 2, `${n} landings in ${cycles} cycles`);
});

test('footsteps differ by surface and grow with speed; engines rise with speed', () => {
  assert.ok(footstep('tiles').freq > footstep('road').freq && footstep('road').freq > footstep('earth').freq);
  assert.ok(footstep('earth').decay > footstep('tiles').decay);
  assert.ok(footstep('road', 4.3).gain > footstep('road', 1.5).gain && footstep('road', 9).gain <= 0.4);
  assert.ok(footstep('nonsense').gain > 0);
  assert.ok(enginePitch(8) > enginePitch(0) && enginePitch(0) > 30 && enginePitch(100) === enginePitch(12));
});

test('loudness falls with distance and voices go to the nearest without flapping', () => {
  assert.equal(gainAt(1), gainAt(3) > 0.9 ? gainAt(1) : -1);
  assert.ok(gainAt(1) > gainAt(10) && gainAt(10) > gainAt(30) && gainAt(45) === 0 && gainAt(80) === 0);
  const src = [{ id: 'a', x: 5, z: 0 }, { id: 'b', x: 5.2, z: 0 }, { id: 'c', x: 40, z: 0 }, { id: 'd', x: 2, z: 0 }];
  assert.deepEqual(pickVoices(src, { x: 0, z: 0 }, 2), ['d', 'a']);
  assert.deepEqual(pickVoices(src, { x: 0, z: 0 }, 2, new Set(['b'])), ['d', 'b'], 'the holder keeps its voice against a rival a hair nearer');
  assert.deepEqual(pickVoices(src, { x: 39, z: 0 }, 1, new Set(['b'])), ['c'], 'but not against one much nearer');
  assert.deepEqual(pickVoices([], { x: 0, z: 0 }, 4), []);
});

test('the beds: birds at dawn, crickets at night, rain when it rains, all within 0..1', () => {
  assert.ok(ambience(6).birds > ambience(13).birds && ambience(13).birds > 0 && ambience(23).birds === 0);
  assert.ok(ambience(23).crickets > 0.5 && ambience(12).crickets === 0);
  assert.equal(ambience(12, 'clear').rain, 0);
  assert.ok(ambience(12, 'storm').rain > ambience(12, 'rain').rain && ambience(12, 'rain').tin > 0 && ambience(6, 'rain').birds < ambience(6).birds);
  for (let h = 0; h < 24; h += 0.5) for (const w of ['clear', 'rain', 'storm', 'fog']) for (const v of Object.values(ambience(h, w))) assert.ok(v >= 0 && v <= 1);
});

test('the bus ducks under the loudspeaker and comes back; a vendor\'s call is a short pentatonic phrase', () => {
  let level = 1;
  for (let k = 0; k < 60; k += 1) level = duck(level, true, 1 / 60);
  assert.ok(level < 0.45 && level >= 0.4);
  for (let k = 0; k < 600; k += 1) level = duck(level, false, 1 / 60);
  assert.ok(level > 0.99 && level <= 1);
  for (let seed = 1; seed < 30; seed += 1) {
    const call = vendorCall(seed);
    assert.deepEqual(call, vendorCall(seed));
    assert.ok(call.length >= 3 && call.length <= 5);
    assert.ok(call.at(-1).seconds > call[0].seconds && call.at(-1).fall < 1);
    for (let k = 1; k < call.length; k += 1) assert.ok(call[k].at >= call[k - 1].at + call[k - 1].seconds);
    for (const n of call) assert.ok(n.hz > 150 && n.hz < 800);
  }
});
