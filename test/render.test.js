import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBuilding, drawWindowLights } from '../public/js/buildings.js';
import { PLACES } from '../public/js/places.js';
import { lightAt, renderFrame } from '../public/js/render.js';
import { drawGround, drawTrain, standing } from '../public/js/scenery.js';
import { createWorld, stepWorld, trainAt } from '../public/js/world.js';

/** A canvas context that accepts every call and property, so drawing code can run headless. */
function stubContext() {
  const handler = {
    get: (_target, prop) => {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'measureText') return () => ({ width: 40 });
      return stub;
    },
    set: () => true,
    apply: () => stub,
  };
  const stub = new Proxy(function noop() {}, handler);
  return stub;
}

test('every building, by day and by night, and all the scenery draw', () => {
  const ctx = stubContext();
  for (const p of PLACES.filter((x) => x.row)) {
    assert.doesNotThrow(() => drawBuilding(ctx, p), p.id);
    assert.doesNotThrow(() => drawWindowLights(ctx, p, 1), p.id);
  }
  assert.doesNotThrow(() => drawGround(ctx));
  for (const train of [null, { x: 400, dir: 1 }, { x: 900, dir: -1 }]) {
    assert.doesNotThrow(() => drawTrain(ctx, train));
    for (const item of standing(train)) assert.doesNotThrow(() => item.draw(ctx, { cho: true }, 1));
  }
});

test('the light is bright at noon, dark at midnight, warm at dawn and dusk', () => {
  assert.deepEqual(lightAt(12), { dark: 0, warm: 0 });
  assert.equal(lightAt(0).dark, 1);
  assert.ok(lightAt(6).warm > 0.5 && lightAt(18).warm > 0.5);
  for (let h = 0; h < 24; h += 0.25) {
    const { dark, warm } = lightAt(h);
    assert.ok(dark >= 0 && dark <= 1 && warm >= 0 && warm <= 1, `hour ${h}`);
  }
});

test('the train passes several times a day, then the line is quiet', () => {
  let passes = 0;
  let was = null;
  for (let m = 0; m < 24 * 60; m += 1) {
    const t = trainAt(m);
    if (t && !was) passes += 1;
    was = t;
  }
  assert.ok(passes >= 5, `${passes} trains`);
  assert.equal(trainAt(3 * 60), null);
});

test('a whole frame renders at any hour, zoomed in or out', () => {
  for (const minute of [6 * 60, 12 * 60, 18 * 60, 23 * 60]) {
    let world = createWorld({ seed: 3, minute });
    for (let k = 0; k < 40; k += 1) world = stepWorld(world);
    for (const view of [{ w: 1400, h: 700, scale: 1, camX: 0, camY: 0, dpr: 1 }, { w: 720, h: 900, scale: 3, camX: 500, camY: 200, dpr: 2 }]) {
      assert.doesNotThrow(() => renderFrame(stubContext(), world, world, 0.5, view));
    }
  }
});
