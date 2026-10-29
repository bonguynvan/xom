import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLiveMode } from '../public/js/live-mode.js';

test('?live turns the page into a livestream source, ?live=0 does not', () => {
  for (const on of ['?live', '?live=1', '?live=yes', '?tua=60&live=1', '?live=TRUE']) assert.equal(isLiveMode(on), true, on);
  for (const off of ['', '?tua=60', '?live=0', '?live=false', '?live=no', '?alive=1']) assert.equal(isLiveMode(off), false, off);
});
