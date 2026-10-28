import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST } from '../public/js/cast.js';
import { CIVIC } from '../public/js/civic.js';
import { clinicBusy, exerciseBusy, extrasAt, extrasFrom, schoolBusy, yardBusy } from '../public/js/extras.js';
import { NODES } from '../public/js/map.js';
import { PLACES, findPlace } from '../public/js/places.js';

const box = (p) => ({ x0: p.x, x1: p.x + p.w, y0: p.front - p.depth, y1: p.front });
const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('the school, the clinic and the ward office stand where houses would have been, with a door onto a way', () => {
  const civic = PLACES.filter((p) => p.civic);
  assert.deepEqual(civic.map((p) => p.id).sort(), ['tramYTe', 'truong', 'uyBan']);
  for (const p of civic) {
    assert.equal(typeof CIVIC[p.kind], 'function', `${p.id} has a facade`);
    assert.ok(NODES[p.entry], `${p.id} opens onto the ways`);
    assert.ok(p.spots.length >= 3, `${p.id} has room for visitors`);
    for (const h of PLACES.filter((q) => q.kind === 'house')) assert.ok(!overlaps(box(p), box(h)), `${p.id} overlaps ${h.id}`);
  }
});

test('people go there: neighbours visit the clinic and the office, pupils hang about the school', () => {
  const likes = (id) => CAST.filter((c) => c.likes?.includes(id)).length;
  assert.ok(likes('tramYTe') > 20 && likes('uyBan') > 20 && likes('truong') > 20);
  assert.ok(CAST.filter((c) => c.painter === 'hocSinh').length >= 60, 'plenty of pupils');
});

test('pupils come out at the bell, patients wait in clinic hours, the old folks exercise at dawn', () => {
  assert.equal(schoolBusy(9.2), 1);
  assert.equal(schoolBusy(10), 0);
  assert.equal(schoolBusy(20), 0);
  assert.ok(clinicBusy(8) > 0 && clinicBusy(12) === 0 && clinicBusy(20) === 0);
  assert.equal(exerciseBusy(5.8), 1);
  assert.equal(exerciseBusy(8), 0);
  assert.ok(yardBusy(17) === 1 && yardBusy(22) === 0);

  const extras = extrasFrom(CAST);
  const kinds = (hour, weather) => extrasAt(extras, hour, 1000, weather).length;
  assert.ok(kinds(5.8) > kinds(4.5), 'the exercise class is out at dawn');
  assert.ok(kinds(9.2) > kinds(10), 'break time fills the school gate');
  assert.ok(kinds(17, 'rain') < kinds(17), 'the rain clears the yard');
  const school = findPlace('truong');
  const atGate = extrasAt(extras, 9.2, 1000).filter((e) => e.x > school.x - 12 && e.x < school.x + school.w + 12 && e.y > school.front && e.y < school.front + 20);
  assert.ok(atGate.length > 30, `pupils at the gate: ${atGate.length}`);
});
