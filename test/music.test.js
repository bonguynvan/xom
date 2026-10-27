import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BARS, CHORDS, PENTATONIC, STEPS_PER_BAR, hz, moodAt, phrase } from '../public/js/music-score.js';

test('the melody stays on the northern five-note scale, inside its bar, the same every time', () => {
  for (let bar = 0; bar < 64; bar += 1) {
    const notes = phrase(20261028, bar);
    assert.deepEqual(notes, phrase(20261028, bar), 'deterministic');
    for (const n of notes) {
      assert.ok(PENTATONIC.includes(n.note), `bar ${bar}: ${n.note} off the scale`);
      assert.ok(n.step >= 0 && n.step + n.length <= STEPS_PER_BAR, `bar ${bar}: note spills over the bar`);
      assert.ok([0, 2].includes(n.slide));
    }
  }
  assert.equal(phrase(1, 3).length, 0, 'every fourth bar breathes');
  assert.ok(Array.from({ length: 16 }, (_, b) => phrase(7, b).length).reduce((a, b) => a + b) > 8, 'there is a tune');
});

test('the progression has a chord for every bar, voiced in a comfortable range', () => {
  assert.equal(CHORDS.length, BARS);
  for (const c of CHORDS) {
    assert.ok(c.root >= 33 && c.root <= 43, 'bass root in octave 1-2');
    for (const n of c.voicing) assert.ok(n >= 50 && n <= 72, `voicing note ${n}`);
  }
  assert.equal(Math.round(hz(69)), 440);
});

test('the music follows the hour: drums by day, rain and crickets at night', () => {
  assert.equal(moodAt(2).drums, 0);
  assert.ok(moodAt(2).rain > moodAt(12).rain && moodAt(2).crickets > 0);
  assert.ok(moodAt(8).brightness > moodAt(23).brightness);
  for (let h = 0; h < 24; h += 0.5) {
    const m = moodAt(h);
    for (const v of [m.drums, m.rain, m.crickets, m.melody]) assert.ok(v >= 0 && v <= 1, `hour ${h}`);
  }
});
