import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODES } from '../public/js/map.js';
import { PLACES } from '../public/js/places.js';
import { STOOL_CLUSTERS } from '../public/js/street-life.js';
import { blockers, boxGrid, toX, toZ } from '../public/js/3d/coords.js';
import { depthIn, settle, slide } from '../public/js/3d/capsule.js';
import { ARM, FOV, LENS, bobAt, damp, dampAngle, dirOf, easeArm, fovAt, place, recentre, rightOf, sweep } from '../public/js/3d/camera-rig.js';
import { ANIM, CLIP, GAIT, blendSpace, nextAnim, poseFor, slidePerStride, stepMotion } from '../public/js/3d/locomotion.js';
import { headTurn, nearestPerson, nearestSeat, seatsOf } from '../public/js/3d/interact.js';
import { pressed, readPad } from '../public/js/3d/gamepad.js';

const { boxes, ponds } = blockers(PLACES, new Set(['cayBang', 'cayPhuong', 'phone']));
const index = boxGrid(boxes);
const RADIUS = 0.3;
/** A small seeded generator, so a failing path can be replayed. */
const seeded = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---------------- locomotion ----------------

test('speed builds up to the gait and dies away, without overshoot, and the input is never mutated', () => {
  const input = Object.freeze({ x: 0, z: 1, top: GAIT.walk });
  let m = Object.freeze({ speed: 0, heading: 0 });
  let t = 0;
  while (m.speed < GAIT.walk - 1e-9 && t < 3) { m = Object.freeze(stepMotion(m, input, 1 / 60)); t += 1 / 60; assert.ok(m.speed <= GAIT.walk + 1e-9); }
  assert.ok(t > 0.1 && t < 0.6, `walking pace reached in ${t.toFixed(2)} s`);
  for (let k = 0; k < 60; k += 1) m = stepMotion(m, { x: 0, z: 0, top: GAIT.walk }, 1 / 60);
  assert.equal(m.speed, 0);
  let run = { speed: 0, heading: 0 };
  for (let k = 0; k < 240; k += 1) run = stepMotion(run, { x: 0, z: 1, top: GAIT.run }, 1 / 60);
  assert.ok(Math.abs(run.speed - GAIT.run) < 1e-9);
});

test('the facing turns at a limited rate, slower at a run, and a turn on the heel brakes first', () => {
  const still = stepMotion({ speed: 0, heading: 0 }, { x: 1, z: 0, top: GAIT.walk }, 1 / 60);
  const fast = stepMotion({ speed: GAIT.run, heading: 0 }, { x: 1, z: 0, top: GAIT.run }, 1 / 60);
  assert.ok(still.heading > 0 && still.heading < 0.25);
  assert.ok(fast.heading > 0 && fast.heading < still.heading);
  const about = stepMotion({ speed: GAIT.run, heading: 0 }, { x: 0, z: -1, top: GAIT.run }, 1 / 60);
  assert.ok(about.target < GAIT.run * 0.5 && about.speed < GAIT.run);
  assert.ok(Math.abs(stepMotion({ speed: 1, heading: 1.2 }, { x: 0, z: 0, top: GAIT.walk }, 1 / 60).heading - 1.2) < 1e-12);
});

test('the blend space keeps the feet from sliding: under 5 cm a stride at every speed and height', () => {
  for (const height of [1.22, 1.58, 1.7, CLIP.height]) {
    let before = blendSpace(0, height);
    for (let s = 0; s <= 5.2; s += 0.02) {
      const b = blendSpace(s, height);
      assert.ok(Math.abs(b.idle + b.walk + b.run - 1) < 1e-9, `weights at ${s}`);
      assert.ok(b.idle >= 0 && b.walk >= 0 && b.run >= 0);
      assert.ok(slidePerStride(s, height) < 0.05, `slide at ${s.toFixed(2)} m/s, ${height} m`);
      for (const k of ['idle', 'walk', 'run']) assert.ok(Math.abs(b[k] - before[k]) < 0.12, `${k} jumps at ${s.toFixed(2)}`);
      before = b;
    }
  }
  const k = 1.7 / CLIP.height;
  assert.ok(Math.abs(blendSpace(CLIP.walk.speed * k, 1.7).period - CLIP.walk.seconds) < 1e-6); // the clip's own speed plays it as made
  assert.ok(Math.abs(blendSpace(CLIP.run.speed * k, 1.7).period - CLIP.run.seconds) < 1e-6);
  assert.equal(blendSpace(2.6, 1.7).walk > 0 && blendSpace(2.6, 1.7).run > 0, true); // a jog is a blend of both
});

test('the animation state machine: start, walk, jog, run, stop, turn, fidget, sit, stand', () => {
  const run = (a, ctx, seconds) => { let s = a; for (let t = 0; t < seconds; t += 1 / 60) s = nextAnim(Object.freeze(s), ctx, 1 / 60); return s; };
  const idle = { name: 'idle', t: 0 };
  assert.equal(nextAnim(idle, { speed: 0, target: 1.5, turn: 0, sit: false }, 1 / 60).name, 'start');
  assert.equal(nextAnim({ name: 'start', t: 0.1 }, { speed: 0.4, target: 1.5, turn: 0, sit: false }, 1 / 60).name, 'start');
  assert.equal(nextAnim({ name: 'start', t: 0.3 }, { speed: 1.5, target: 1.5, turn: 0, sit: false }, 1 / 60).name, 'walk');
  assert.equal(nextAnim({ name: 'walk', t: 1 }, { speed: 2.6, target: 2.7, turn: 0, sit: false }, 1 / 60).name, 'jog');
  assert.equal(nextAnim({ name: 'jog', t: 1 }, { speed: 4.2, target: 4.3, turn: 0, sit: false }, 1 / 60).name, 'run');
  assert.equal(nextAnim({ name: 'run', t: 1 }, { speed: 3, target: 0, turn: 0, sit: false }, 1 / 60).name, 'stop');
  assert.equal(nextAnim({ name: 'stop', t: 0.2 }, { speed: 0, target: 0, turn: 0, sit: false }, 1 / 60).name, 'idle');
  assert.equal(nextAnim(idle, { speed: 0, target: 0, turn: 1.2, sit: false }, 1 / 60).name, 'turn');
  assert.equal(nextAnim({ name: 'turn', t: 0.2 }, { speed: 0, target: 0, turn: 0.01, sit: false }, 1 / 60).name, 'idle');
  const still = { speed: 0, target: 0, turn: 0, sit: false };
  assert.equal(run(idle, still, 6).name, 'idle');
  assert.equal(run(idle, still, 8).name, 'fidget');
  assert.equal(run(idle, still, 12).name, 'idle');
  const seated = run(idle, { ...still, sit: true }, 1);
  assert.equal(seated.name, 'sit');
  assert.equal(poseFor(seated).sit, 1);
  const up = nextAnim(seated, still, 1 / 60);
  assert.equal(up.name, 'stand');
  assert.ok(poseFor({ name: 'stand', t: 0.2 }).sit > 0 && poseFor({ name: 'stand', t: 0.2 }).sit < 1);
  assert.equal(run(up, still, 1).name, 'idle');
  const seen = new Set();
  let a = idle;
  for (const ctx of [{ ...still, target: 1.5 }, { speed: 1.5, target: 1.5, turn: 0, sit: false }, { speed: 2.6, target: 2.7, turn: 0, sit: false }, { speed: 4.3, target: 4.3, turn: 0, sit: false }, { speed: 2, target: 0, turn: 0, sit: false }, still, { ...still, turn: 1 }, { ...still, sit: true }, still]) {
    a = run(a, ctx, 0.4);
    seen.add(a.name);
    assert.ok(ANIM.includes(a.name));
    const pose = poseFor(a, ctx.speed);
    assert.ok(Math.abs(pose.lean) < 0.3 && pose.sit >= 0 && pose.sit <= 1);
  }
  assert.ok(seen.size >= 7, [...seen].join(' '));
  assert.ok(poseFor({ name: 'start', t: 0.15 }).lean > 0 && poseFor({ name: 'stop', t: 0.15 }).lean < 0);
});

// ---------------- the body against the walls ----------------

test('a wall is slid along, a corner is rolled round, and a thin wall is never jumped through', () => {
  const one = boxGrid([{ x0: 0, x1: 10, z0: 0, z1: 0.2 }]); // a wall 20 cm thick
  const along = slide(2, -0.3, 1, 1, RADIUS, one); // pushed diagonally into it: the sideways part is kept
  assert.ok(Math.abs(along.Z - -0.3) < 1e-9 && along.X > 2.9, JSON.stringify(along));
  assert.ok(along.blocked > 0.2 && along.blocked < 0.5);
  const through = slide(5, -1, 0, 8, RADIUS, one); // a step forty times the wall's thickness
  assert.ok(through.Z <= -RADIUS + 1e-9, 'stopped at the wall');
  const corner = slide(-0.5, -0.1, 0.6, 0.6, RADIUS, one); // past the end of the wall
  assert.ok(depthIn(corner.X, corner.Z, RADIUS, one) < 1e-9);
  const inside = settle(5, 0.1, RADIUS, one);
  assert.ok(depthIn(inside.X, inside.Z, RADIUS, one) < 1e-9);
});

/** Walks recorded from a seed: wander from a node of the ways, turning at random, at walking and running pace. */
function recordedPath(seed, steps) {
  const rand = seeded(seed);
  const node = NODES[Math.floor(rand() * NODES.length)];
  let p = settle(toX(node.x), toZ(node.y), RADIUS, index, ponds);
  let heading = rand() * Math.PI * 2;
  const out = [];
  for (let k = 0; k < steps; k += 1) {
    if (rand() < 0.04) heading += (rand() - 0.5) * 3;
    const dt = rand() < 0.05 ? 0.1 : 1 / 60; // a dropped frame now and then
    const speed = rand() < 0.3 ? GAIT.run : GAIT.walk;
    const before = p;
    p = slide(p.X, p.Z, Math.sin(heading) * speed * dt, Math.cos(heading) * speed * dt, RADIUS, index, ponds);
    if (p.blocked > 0.9) heading += 0.7; // stuck in a corner: turn
    out.push({ ...p, heading, moved: Math.hypot(p.X - before.X, p.Z - before.Z), asked: speed * dt });
  }
  return out;
}

// A tenth of a millimetre is allowed: wedged in the mouth of a gap narrower than the body (two houses 45 cm apart),
// pushing out of one wall pushes into the other, and the passes stop a few micrometres short.
test('recorded walks through the whole xóm never enter a wall or the pond', () => {
  let walked = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    for (const p of recordedPath(seed, 2500)) {
      assert.ok(depthIn(p.X, p.Z, RADIUS, index) < 1e-4, `seed ${seed}: ${depthIn(p.X, p.Z, RADIUS, index)} m inside a wall at ${p.X.toFixed(2)}, ${p.Z.toFixed(2)}`);
      for (const pond of ponds) assert.ok(Math.hypot((p.X - pond.cx) / (pond.rx + RADIUS), (p.Z - pond.cz) / (pond.rz + RADIUS)) > 1 - 1e-6, `seed ${seed}: in the pond`);
      assert.ok(p.moved <= p.asked * 1.1 + 1e-6, `a wall never throws you (${p.moved} for a step of ${p.asked})`); // rolling round a corner adds a hair
      walked += p.moved;
    }
  }
  assert.ok(walked > 3000, `the walkers got about (${walked.toFixed(0)} m)`);
});

// ---------------- the camera ----------------

test('damping reaches its target without overshooting, whatever the frame rate', () => {
  for (const dt of [1 / 144, 1 / 60, 1 / 20]) {
    let [x, v] = [0, 0];
    for (let t = 0; t < 2; t += dt) { [x, v] = damp(x, v, 1, 0.2, dt); assert.ok(x <= 1 + 1e-9, `overshoot at dt ${dt}`); }
    assert.ok(Math.abs(x - 1) < 0.01);
  }
  const [a] = dampAngle(3, 0, -3, 0.2, 1 / 60); // the short way round, through pi
  assert.ok(a > 3);
});

test('the swept sphere stops short of a wall and passes over a low roof', () => {
  const wall = boxGrid([{ x0: -5, x1: 5, z0: 2, z1: 3, h: 4 }]);
  assert.ok(Math.abs(sweep({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 6, LENS, wall) - (2 - LENS)) < 1e-9);
  assert.equal(sweep({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 6, LENS, wall), 6);
  assert.equal(sweep({ x: 0, y: 6, z: 0 }, { x: 0, y: 0, z: 1 }, 6, LENS, wall), 6); // above the ridge
  const d = dirOf(0, 0.9);
  assert.ok(sweep({ x: 0, y: 1.5, z: 0 }, d, 12, LENS, wall) < 12); // climbs into the wall before clearing it
  const r = rightOf(0);
  assert.ok(Math.abs(r.x * d.x + r.z * d.z) < 1e-12); // right is square to the view
});

test('in every alley, at every angle, the camera stays outside the walls', () => {
  let shots = 0;
  let squeezed = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const path = recordedPath(seed, 900);
    for (let k = 0; k < path.length; k += 9) {
      const p = path[k];
      const head = { x: p.X, y: 1.45, z: p.Z };
      for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 6) {
        for (const pitch of [-0.25, 0.1, 0.35, 0.9]) {
          const wanted = k % 2 ? ARM.start : 8;
          const rig = place(head, yaw, pitch, wanted, index);
          const c = rig.position;
          assert.ok(depthIn(c.x, c.z, LENS, index) < 0.03, `seed ${seed}, step ${k}: the lens is ${depthIn(c.x, c.z, LENS, index).toFixed(3)} m into a wall`);
          assert.ok(depthIn(rig.pivot.x, rig.pivot.z, LENS, index) < 0.03, 'the shoulder point is in a wall');
          assert.ok(rig.arm >= 0 && rig.arm <= wanted + 1e-9 && c.y > 0.25);
          // nothing stands between your head and the lens either: walk the line
          for (let f = 0.25; f < 1; f += 0.25) assert.ok(depthIn(rig.pivot.x + (c.x - rig.pivot.x) * f, rig.pivot.z + (c.z - rig.pivot.z) * f, LENS, index) < 0.03);
          shots += 1;
          if (rig.arm < wanted - 0.01) squeezed += 1;
        }
      }
    }
  }
  assert.ok(shots > 40000 && squeezed > shots * 0.05, `${squeezed} of ${shots} views were shortened by a wall`);
});

test('the arm snaps in and eases out; the view comes round behind you only when left alone', () => {
  assert.equal(easeArm(4, 1.5, 1 / 60), 1.5);
  const out = easeArm(1.5, 4, 1 / 60);
  assert.ok(out > 1.5 && out < 2);
  assert.equal(recentre(0, 0, 1, 1.5), null); // the view was just turned by hand
  assert.equal(recentre(0, 0, 5, 0), null); // standing
  assert.equal(recentre(0.1, 0, 5, 1.5), null); // walking towards the camera: leave it
  const behind = recentre(1, 0.5 - Math.PI, 5, 1.5);
  assert.ok(Math.abs(behind - 0.5) < 1e-9);
  assert.equal(fovAt(GAIT.run, GAIT.run), FOV.base + FOV.kick);
  assert.equal(fovAt(GAIT.walk, GAIT.run), FOV.base);
  assert.equal(fovAt(GAIT.run, GAIT.run, false), FOV.base); // turned off
  assert.deepEqual(bobAt(0.3, GAIT.run, GAIT.run, false), { x: 0, y: 0 });
  assert.ok(bobAt(0.25, GAIT.run, GAIT.run).y > 0.02 && bobAt(0.25, GAIT.run, GAIT.run).y < 0.05);
});

// ---------------- stools, neighbours, the head ----------------

test('every plastic stool can be sat on from where you stand, unless someone is on it', () => {
  const seats = seatsOf(PLACES, STOOL_CLUSTERS);
  const count = PLACES.filter((p) => p.kind === 'quanCoc').reduce((n, p) => n + p.spots.length, 0) + STOOL_CLUSTERS.reduce((n, c) => n + c.stools.length, 0);
  assert.equal(seats.length, count);
  assert.ok(count > 40);
  for (const s of seats) assert.ok(nearestSeat(seats, s.X + 0.3, s.Z, []).d <= 0.3 + 1e-9);
  const first = STOOL_CLUSTERS[0].stools[0];
  const mine = nearestSeat(seats, toX(first.x), toZ(first.y), []);
  assert.ok(mine.d < 1e-9 && mine.y > 0.1);
  const other = nearestSeat(seats, toX(first.x), toZ(first.y), [{ x: first.x, y: first.y }]);
  assert.ok(other === null || other.d > 0.2);
  assert.equal(nearestSeat(seats, 9999, 9999, []), null);
});

test('greeting picks the nearest neighbour within reach; the head turns only as far as a neck can', () => {
  const people = [{ key: 'a', X: 2, Z: 0 }, { key: 'b', X: 0, Z: 1 }, { key: 'c', X: 9, Z: 9 }];
  assert.equal(nearestPerson(people, 0, 0).key, 'b');
  assert.equal(nearestPerson(people, 20, 20), null);
  const eye = { x: 0, y: 1.6, z: 0 };
  assert.deepEqual(headTurn(eye, 0, null), { yaw: 0, pitch: 0 });
  const left = headTurn(eye, 0, { x: 2, y: 1.6, z: 2 });
  assert.ok(Math.abs(left.yaw - Math.PI / 4) < 1e-9 && Math.abs(left.pitch) < 1e-9);
  assert.equal(headTurn(eye, 0, { x: 3, y: 1.6, z: 0.2 }).yaw, 1.15); // as far as it goes
  assert.deepEqual(headTurn(eye, 0, { x: 0, y: 1.6, z: -3 }), { yaw: 0, pitch: 0 }); // behind
  assert.ok(headTurn(eye, 0, { x: 0, y: 9, z: 1 }).pitch <= 0.4);
});

test('the gamepad: the right stick looks, B or RT runs, X sits, Start changes mode', () => {
  const pad = (axes, down = []) => ({ axes, buttons: Array.from({ length: 16 }, (_, k) => ({ pressed: down.includes(k) })) });
  const now = readPad(pad([0, 0, 0.9, -0.1], [7, 2]));
  assert.ok(now.rx > 0.8 && now.ry === 0 && now.run && now.sit && !now.menu);
  assert.equal(readPad(null).run, false);
  const hit = pressed(readPad(pad([0, 0, 0, 0])), readPad(pad([0, 0, 0, 0], [2, 9])));
  assert.equal(hit.sit && hit.menu && !hit.confirm, true);
});
