import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_LOOKS } from '../public/js/guests.js';
import { NODES } from '../public/js/map.js';
import { PLACES } from '../public/js/places.js';
import { EXTRAS, HATS, LOOK_STYLE, PREFS_KEY, SHIRTS, choiceOf, initial, nameError, readPrefs, reduce, toPrefs } from '../public/js/3d/select-state.js';
import { FLY_SECONDS, doorFor, ease, flyPose, hashName } from '../public/js/3d/flyin.js';
import { axis, pressed, readPad } from '../public/js/3d/gamepad.js';

const fixed = (...values) => { let k = 0; return () => values[k++ % values.length]; };
const freeze = (o) => Object.freeze(o);

test('every look the server knows has a 3D style, and every default is a real choice', () => {
  for (const look of GUEST_LOOKS) {
    const s = LOOK_STYLE[look.id];
    assert.ok(s, look.id);
    assert.ok(['man', 'woman'].includes(s.rig));
    assert.ok(s.height > 1 && s.height < 1.9);
    assert.ok(SHIRTS.some((c) => c.id === s.shirt) && HATS.some((h) => h.id === s.hat) && EXTRAS.some((e) => e.id === s.extra));
  }
  assert.equal(GUEST_LOOKS.length >= 6 && GUEST_LOOKS.length <= 8, true);
});

test('a first visit starts with a random look in its own clothes and a usable name', () => {
  const s = initial({}, fixed(0, 0.5, 0.5, 0.5));
  assert.equal(s.look, GUEST_LOOKS[0].id);
  assert.equal(s.hat, LOOK_STYLE[s.look].hat);
  assert.equal(nameError(s.name), null);
  assert.equal(s.returning, false);
});

test('a returning visitor gets the stored character back, and the stored shape is the 2D one plus the 3D choices', () => {
  const stored = JSON.stringify({ name: 'Cu Tèo 12', look: 'boDoi', shirt: 'do', hat: 'none', extra: 'khan' });
  const s = initial(readPrefs(stored));
  assert.deepEqual([s.name, s.look, s.shirt, s.hat, s.extra, s.returning], ['Cu Tèo 12', 'boDoi', 'do', 'none', 'khan', true]);
  assert.deepEqual(toPrefs(s), { name: 'Cu Tèo 12', look: 'boDoi', shirt: 'do', hat: 'none', extra: 'khan' });
  assert.deepEqual(Object.keys(toPrefs(s)).slice(0, 2), ['name', 'look']);
  assert.equal(PREFS_KEY, 'xom.guest');
  // what the 2D page wrote ({ name, look } only) still resumes, in the look's own clothes
  const old = initial(readPrefs(JSON.stringify({ name: 'Bác Na 40', look: 'aoDai' })));
  assert.deepEqual([old.returning, old.hat], [true, 'nonLa']);
});

test('stored data is never trusted', () => {
  assert.deepEqual(readPrefs('not json'), {});
  assert.deepEqual(readPrefs('[1]'), {});
  assert.deepEqual(readPrefs(JSON.stringify({ name: 'x', look: 'robot', shirt: '<b>', hat: 7 })), {});
  assert.deepEqual(readPrefs(JSON.stringify({ name: 'admin', look: 'toc' })), { look: 'toc' });
  assert.equal(initial(readPrefs(JSON.stringify({ look: 'toc' }))).returning, false);
});

test('names: friendly reasons, and the same verdict as the server rule', () => {
  assert.equal(nameError('Cô Bống'), null);
  assert.match(nameError(''), /Đặt một cái tên/);
  assert.match(nameError('a'), /ngắn quá/);
  assert.match(nameError('a'.repeat(25)), /dài quá/);
  assert.match(nameError('Tèo <3'), /chỉ gồm chữ/);
  assert.match(nameError('admin'), /không dùng được/);
});

test('the reducer: choosing, typing, submitting, and the server has the last word', () => {
  let s = freeze(initial({ name: 'Cu Tí 10', look: 'ongLoe' }));
  s = freeze(reduce(s, { type: 'shirt', id: 'do' }));
  s = freeze(reduce(s, { type: 'hat', id: 'muPhot' }));
  s = freeze(reduce(s, { type: 'extra', id: 'tuiVai' }));
  assert.deepEqual([s.shirt, s.hat, s.extra], ['do', 'muPhot', 'tuiVai']);
  assert.equal(reduce(s, { type: 'shirt', id: 'nope' }), s);
  assert.equal(reduce(s, { type: 'whatever' }), s);
  assert.equal(choiceOf(s).color, '#d8362f');
  assert.equal(choiceOf(s).rig, 'man');

  const next = reduce(s, { type: 'step', by: 1 }); // a new look comes in its own clothes
  assert.equal(next.look, 'nongDan');
  assert.equal(next.hat, 'nonLa');
  assert.equal(reduce(reduce(s, { type: 'step', by: -1 }), { type: 'step', by: 1 }).look, s.look);
  assert.equal(reduce(initial({ look: 'aoDai' }), { type: 'step', by: -1 }).look, 'treCon');

  const typing = reduce(s, { type: 'name', value: 'a' });
  assert.match(typing.error, /ngắn quá/);
  assert.equal(reduce(typing, { type: 'name', value: '' }).error, null); // an empty box does not nag
  const bad = reduce(typing, { type: 'submit' });
  assert.equal(bad.busy, false);
  assert.match(bad.error, /ngắn quá/);
  assert.equal(reduce(typing, { type: 'random', r1: 0, r2: 0, r3: 0 }).name, 'Cu Tèo 10');

  const waiting = reduce(s, { type: 'submit' });
  assert.equal(waiting.busy, true);
  assert.equal(reduce(waiting, { type: 'shirt', id: 'kem' }), waiting); // nothing moves while the server thinks
  const refused = reduce(waiting, { type: 'refused', message: 'Xóm đông quá rồi, lát quay lại nhé' });
  assert.deepEqual([refused.busy, refused.error], [false, 'Xóm đông quá rồi, lát quay lại nhé']);
  const joined = reduce(waiting, { type: 'joined', name: 'Cu Tí', look: 'ongLoe' });
  assert.deepEqual([joined.busy, joined.name, joined.returning, joined.shirt], [false, 'Cu Tí', true, 'do']);
  assert.equal(reduce(waiting, { type: 'joined', name: 'Cu Tí', look: 'cuDo' }).hat, 'muPhot');
});

test('the fly-in starts and ends exactly on its two poses and never jumps', () => {
  const from = { x: 0, y: 0, z: 0, yaw: 3, pitch: 1.25, dist: 150 };
  const to = { x: 10, y: 1.45, z: -20, yaw: -3, pitch: 0.32, dist: 6 };
  const a = flyPose(0, from, to);
  const b = flyPose(1, from, to);
  assert.deepEqual([a.x, a.dist, a.pitch, a.yaw], [0, 150, 1.25, 3]);
  assert.ok(Math.abs(b.x - 10) < 1e-9 && Math.abs(b.dist - 6) < 1e-9 && Math.abs(b.pitch - 0.32) < 1e-9);
  assert.ok(Math.abs(Math.sin(b.yaw) - Math.sin(-3)) < 1e-9 && Math.abs(Math.cos(b.yaw) - Math.cos(-3)) < 1e-9, 'ends facing the target');
  let last = a;
  for (let k = 1; k <= 200; k += 1) {
    const p = flyPose(k / 200, from, to);
    assert.ok(p.dist <= last.dist + 1e-9, 'always coming down');
    assert.ok(Math.abs(p.yaw - last.yaw) < 0.06 && Math.abs(p.x - last.x) < 0.2, 'no jump');
    last = p;
  }
  assert.deepEqual([ease(0), ease(0.5), ease(1), ease(-1), ease(2)], [0, 0.5, 1, 0, 1]);
  assert.ok(FLY_SECONDS > 2 && FLY_SECONDS < 7);
});

test('the same name always steps out of the same house, onto the way in front of its door', () => {
  const a = doorFor('Cu Tèo 12', PLACES, NODES);
  assert.deepEqual(a, doorFor('Cu Tèo 12', PLACES, NODES));
  assert.notEqual(hashName('Cu Tèo 12'), hashName('Cu Tèo 13'));
  const inside = (d, p) => d.x > p.x && d.x < p.x + p.w && d.y < p.front && d.y > p.front - (p.depth ?? 32);
  for (let k = 0; k < 300; k += 1) {
    const d = doorFor(`Khách ${k}`, PLACES, NODES);
    const house = PLACES.find((p) => p.id === d.house);
    assert.equal(house.kind, 'house');
    assert.ok(!PLACES.some((p) => p.building && inside(d, p)), `${d.house}: stands outside every wall`);
    const away = Math.hypot(d.x - house.door.x, d.y - house.door.y);
    assert.ok(away > 6 && away < 70, `${d.house}: near the door (${away})`);
    assert.ok(Math.abs(Math.sin(d.heading) * away - (d.x - house.door.x)) < 1e-6, 'facing away from the door');
  }
  assert.ok(doorFor('x', PLACES).y > 0, 'works without the ways too');
  assert.equal(doorFor('x', []), null);
});

test('gamepad: dead zone, d-pad or stick, and a held button fires once', () => {
  assert.equal(axis(0.1), 0);
  assert.equal(axis(1), 1);
  assert.ok(axis(-0.61) < 0 && axis(-0.61) > -1);
  const pad = (buttons, axes = [0, 0]) => ({ axes, buttons: Array.from({ length: 16 }, (_, k) => ({ pressed: buttons.includes(k) })) });
  assert.equal(readPad(null).confirm, false);
  const still = readPad(pad([]));
  const right = readPad(pad([15]));
  assert.equal(pressed(still, right).right, true);
  assert.equal(pressed(right, right).right, false);
  assert.equal(pressed(still, readPad(pad([], [-0.9, 0]))).left, true);
  assert.equal(pressed(still, readPad(pad([0]))).confirm, true);
  assert.equal(pressed(undefined, readPad(pad([1]))).back, true);
});
