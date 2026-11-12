// How the crowd is shown: tiers without flicker, the impostor sheet's cells, stepping round the player, poses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MID_REACH, SHEET, cellOf, ridePose, sidestep, talkPose, tierOf } from '../public/js/3d/crowd-plan.js';

test('the middle-distance border has a band: someone hovering on it does not flicker', () => {
  assert.equal(tierOf(10), 'mid');
  assert.equal(tierOf(200), 'far');
  assert.equal(tierOf(MID_REACH - 1, 'mid'), 'mid');
  assert.equal(tierOf(MID_REACH - 1, 'far'), 'far', 'coming in, they change a little later');
  assert.equal(tierOf(MID_REACH + 1, 'mid'), 'mid', 'going out, they change a little later');
  assert.equal(tierOf(MID_REACH + 1, 'far'), 'far');
  let tier = 'far';
  let flips = 0;
  for (let k = 0; k < 400; k += 1) { const next = tierOf(MID_REACH + Math.sin(k) * 2, tier); if (next !== tier) flips += 1; tier = next; }
  assert.ok(flips <= 1, `${flips} flips while hovering within 2 m of the border`);
});

test('the sheet cell: front when they face the camera, back when they walk away, the frame follows the stride', () => {
  assert.deepEqual(cellOf(0, 0, 0, true), { col: 0, row: 0 });
  assert.equal(cellOf(0, Math.PI, 0, true).col, 4, 'seen from behind');
  assert.equal(cellOf(Math.PI / 2, Math.PI / 2, 0, true).col, 0, 'turning with the camera changes nothing');
  assert.equal(cellOf(0, Math.PI / 2, 0, true).col, 2);
  assert.equal(cellOf(0, -Math.PI / 2, 0, true).col, 6);
  assert.equal(cellOf(0, 0, 0.6, true).row, 2);
  assert.equal(cellOf(0, 0, 0.6, false).row, SHEET.frames, 'standing still: the idle row');
  assert.equal(cellOf(0, 0, 0, true, true).col, SHEET.dirs, 'women are the right half of the sheet');
  for (let k = -50; k < 50; k += 1) {
    const c = cellOf(k * 0.37, k * 0.91, k * 0.13, k % 2 === 0, k % 3 === 0);
    assert.ok(Number.isInteger(c.col) && c.col >= 0 && c.col < SHEET.cols && Number.isInteger(c.row) && c.row >= 0 && c.row < SHEET.rows, JSON.stringify(c));
  }
});

test('neighbours step round you: never shown inside your space, untouched outside it, no jump at the edge', () => {
  assert.deepEqual(sidestep(5, 5, 0, 0), { X: 5, Z: 5 });
  for (let k = 0; k < 200; k += 1) {
    const [x, z] = [Math.sin(k) * 0.9, Math.cos(k * 1.7) * 0.9];
    const p = sidestep(x, z, 0, 0, 0.75);
    assert.ok(Math.hypot(p.X, p.Z) >= 0.75 - 1e-9);
    if (Math.hypot(x, z) >= 0.75) assert.deepEqual(p, { X: x, Z: z });
  }
  const on = sidestep(2, 3, 2, 3, 0.75);
  assert.ok(Math.abs(Math.hypot(on.X - 2, on.Z - 3) - 0.75) < 1e-9, 'standing exactly on you, they still move aside');
  const [inside, outside] = [sidestep(0.7499, 0, 0, 0, 0.75), sidestep(0.7501, 0, 0, 0, 0.75)];
  assert.ok(Math.abs(inside.X - outside.X) < 1e-3);
});

test('on a saddle: knees up, arms forward; pedals turn the legs in opposite ways only on a bicycle', () => {
  const still = ridePose(1.3, false);
  assert.deepEqual(still.left, still.right);
  assert.ok(still.left.thigh < -1 && still.left.shin > 1 && still.arm < -0.8);
  assert.deepEqual(ridePose(9, false), still, 'a motorbike rider does not pedal');
  const a = ridePose(Math.PI / 2, true);
  assert.ok(a.left.thigh > a.right.thigh && Math.abs((a.left.thigh + a.right.thigh) / 2 - still.left.thigh) < 1e-9);
  const b = ridePose(-Math.PI / 2, true);
  assert.ok(b.left.thigh < b.right.thigh, 'half a turn later the other knee is up');
  for (let k = 0; k < 60; k += 1) { const t = talkPose(k * 0.1, k); assert.ok(t.arm < 0 && t.fore < 0 && Math.abs(t.nod) < 0.1); }
});
