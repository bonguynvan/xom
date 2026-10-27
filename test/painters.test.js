import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST } from '../public/js/cast.js';
import { PAINTERS, drawResident } from '../public/js/painters.js';

/** A canvas context that accepts every call and property, so painters can run headless. */
function stubContext() {
  const handler = {
    get: (_target, prop) => (prop === Symbol.toPrimitive ? () => 0 : stub),
    set: () => true,
    apply: () => stub,
  };
  const stub = new Proxy(function noop() {}, handler);
  return stub;
}

test('every resident has a painter', () => {
  for (const c of CAST) assert.equal(typeof PAINTERS[c.painter], 'function', `${c.id} -> ${c.painter}`);
});

test('every resident draws standing and walking, both ways', () => {
  for (const c of CAST) {
    for (const dir of [1, -1]) {
      for (const moving of [false, true]) {
        const agent = { castId: c.id, painter: c.painter, color: c.color, phase: 1.7, dir };
        assert.doesNotThrow(() => drawResident(stubContext(), agent, c.look, { x: 100, y: 200, size: 68, moving }), `${c.id} dir ${dir} moving ${moving}`);
      }
    }
  }
});
