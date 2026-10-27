import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampView, drift, fit, panBy, wheelPixels, zoomAt } from '../public/js/camera.js';
import { MAP } from '../public/js/map.js';

test('the window starts filled with map and can zoom out to the whole xóm', () => {
  const wide = fit(2800, 1000);
  assert.equal(wide.start, 2800 / MAP.w);
  assert.equal(wide.min, 1000 / MAP.h);
  assert.ok(wide.max > wide.start);
  const phone = fit(720, 1400);
  assert.equal(phone.start, 1400 / MAP.h, 'a tall phone fills its height and shows part of the map');
});

test('the camera never shows empty edges, and centres a map smaller than the window', () => {
  const view = { w: 1000, h: 500, scale: 1 };
  assert.deepEqual(clampView({ ...view, camX: -50, camY: -50 }), { ...view, camX: 0, camY: 0 });
  assert.deepEqual(clampView({ ...view, camX: 9999, camY: 9999 }), { ...view, camX: MAP.w - 1000, camY: MAP.h - 500 });
  const small = clampView({ w: 1000, h: 500, scale: 0.5, camX: 0, camY: 0 });
  assert.equal(small.camX, (MAP.w - 2000) / 2);
});

test('zooming keeps the point under the cursor in place', () => {
  const limits = fit(1400, 700);
  const view = { w: 1400, h: 700, scale: 1, camX: 0, camY: 0 };
  const zoomed = zoomAt(view, 2, 700, 350, limits);
  assert.equal(zoomed.scale, 2);
  assert.equal(zoomed.camX + 700 / zoomed.scale, 700);
  assert.equal(zoomed.camY + 350 / zoomed.scale, 350);
  assert.equal(zoomAt(view, 100, 0, 0, limits).scale, limits.max);
});

test('dragging pans by the same distance on screen', () => {
  const view = { w: 700, h: 350, scale: 2, camX: 300, camY: 100 };
  const moved = panBy(view, -100, -40);
  assert.equal(moved.camX, 350);
  assert.equal(moved.camY, 120);
});

test('the idle drift turns around at the edge of the map', () => {
  const view = { w: 700, h: 350, scale: 1, camX: MAP.w - 700, camY: 0 };
  assert.equal(drift(view, 1, 100).dir, -1);
  const mid = drift({ ...view, camX: 300 }, 1, 1000);
  assert.ok(mid.view.camX > 300 && mid.dir === 1);
});

test('Firefox line and page wheel deltas scroll as far as Chromium pixels', () => {
  assert.equal(wheelPixels({ deltaX: 0, deltaY: 100, deltaMode: 0 }), 100);
  assert.equal(wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }), 96);
  assert.equal(wheelPixels({ deltaX: -40, deltaY: 2, deltaMode: 0 }), -40);
});
