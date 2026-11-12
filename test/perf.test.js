import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fpsOf, linesOf, pushSample, report, summarise } from '../public/js/3d/perf.js';

test('the sample window rolls and never mutates', () => {
  const a = Object.freeze([1, 2, 3]);
  assert.deepEqual(pushSample(a, 4, 3), [2, 3, 4]);
  assert.deepEqual(pushSample(a, 4, 10), [1, 2, 3, 4]);
  assert.deepEqual(a, [1, 2, 3]);
});

test('mean, p95 and worst frame', () => {
  const s = summarise([...Array(99).fill(4), 40]);
  assert.ok(Math.abs(s.avg - 4.36) < 1e-9);
  assert.equal(s.p95, 4);
  assert.equal(s.max, 40);
  assert.deepEqual(summarise([]), { avg: 0, p95: 0, max: 0 });
});

test('fps comes from the gaps between frames', () => {
  assert.ok(Math.abs(fpsOf(Array(60).fill(1000 / 60)) - 60) < 1e-6);
  assert.equal(fpsOf([]), 0);
});

test('the report is flat numbers and the overlay text is Vietnamese', () => {
  const r = report({ gaps: Array(10).fill(16.667), cpu: [3, 5], calls: 212, triangles: 1234567, textures: 40, geometries: 90, heap: 150 * 1048576 });
  assert.equal(r.fps, 60);
  assert.equal(r.cpuMs, 4);
  assert.equal(r.heapMB, 150);
  const text = linesOf(r).join('\n');
  assert.match(text, /60\.0 fps/);
  assert.match(text, /212 lần vẽ · 1\.2 M tam giác/);
  assert.match(linesOf({ ...r, heapMB: null }).join('\n'), /không cho đo/);
});
