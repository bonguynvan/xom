// The quality tiers and the film grade: pure maths, no GPU.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADE_GLSL, gradeColor, lookAt } from '../public/js/3d/grade.js';
import { SHED_MAX, TIERS, TIER_LABEL, TIER_NAMES, adapt, nextChoice, pickTier, shed } from '../public/js/3d/quality.js';

test('every tier has the same fields and each is no cheaper than the one below', () => {
  const keys = Object.keys(TIERS.thap).sort();
  for (const name of TIER_NAMES) assert.deepEqual(Object.keys(TIERS[name]).sort(), keys, name);
  for (let k = 1; k < TIER_NAMES.length; k += 1) {
    const [a, b] = [TIERS[TIER_NAMES[k - 1]], TIERS[TIER_NAMES[k]]];
    assert.ok(b.ratio >= a.ratio && b.skinned >= a.skinned && b.cascades >= a.cascades && b.ao >= a.ao);
  }
  assert.equal(TIERS.thap.post, false, 'the lowest tier draws straight to the screen');
  for (const name of ['auto', ...TIER_NAMES]) assert.ok(TIER_LABEL[name]);
});

test('the starting tier: a forced or stored choice wins, a phone is low, the graphics card decides the rest', () => {
  assert.equal(pickTier({ forced: 'thap', stored: 'toida', gpu: 'Apple M4' }), 'thap');
  assert.equal(pickTier({ forced: 'nonsense', stored: 'toida' }), 'toida');
  assert.equal(pickTier({ coarse: true, gpu: 'Apple GPU' }), 'thap');
  assert.equal(pickTier({ memory: 4, gpu: 'ANGLE (NVIDIA GeForce RTX 3060)' }), 'thap');
  assert.equal(pickTier({ gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620, OpenGL 4.1)' }), 'vua');
  assert.equal(pickTier({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)' }), 'cao');
  assert.equal(pickTier({ gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, D3D11)' }), 'cao');
  assert.equal(pickTier({ gpu: '' }), 'vua');
  assert.equal(pickTier({ gpu: 'Google SwiftShader' }), 'vua');
  assert.notEqual(pickTier({ gpu: 'NVIDIA GeForce RTX 4090' }), 'toida', 'the top tier is only ever chosen by hand');
});

test('the quality button goes round every choice', () => {
  let c = 'auto';
  const seen = [];
  for (let k = 0; k < 5; k += 1) { seen.push(c); c = nextChoice(c); }
  assert.deepEqual(seen, ['auto', ...TIER_NAMES]);
  assert.equal(c, 'auto');
  assert.equal(nextChoice('rubbish'), 'auto');
});

test('a page that cannot keep up sheds load step by step and never climbs back', () => {
  let s = { level: 0, slow: 0, avg: 0 };
  const before = JSON.stringify(s);
  adapt(s, 40, 0.04);
  assert.equal(JSON.stringify(s), before, 'adapt does not mutate');
  for (let k = 0; k < 60 * 2; k += 1) s = adapt(s, 16.7, 1 / 60);
  assert.equal(s.level, 0, 'a smooth page keeps everything');
  for (let k = 0; k < 25 * 2; k += 1) s = adapt(s, 40, 0.04);
  assert.equal(s.level, 0, 'two slow seconds are not enough');
  for (let k = 0; k < 25 * 3; k += 1) s = adapt(s, 40, 0.04);
  assert.equal(s.level, 1);
  for (let k = 0; k < 25 * 60; k += 1) s = adapt(s, 40, 0.04);
  assert.equal(s.level, SHED_MAX);
  for (let k = 0; k < 600; k += 1) s = adapt(s, 8, 1 / 120);
  assert.equal(s.level, SHED_MAX);
  assert.deepEqual(shed(TIERS.cao, 0), { ao: 0.5, ratio: 1.5, bloom: true });
  assert.equal(shed(TIERS.cao, 1).ao, 0);
  assert.ok(shed(TIERS.cao, 2).ratio < 1.5 && shed(TIERS.cao, 2).bloom);
  assert.equal(shed(TIERS.cao, 3).bloom, false);
});

test('the look by hour: night blooms more and lowers the threshold, rain is duller, golden hour warmer', () => {
  const day = lookAt({ dark: 0, low: 0, wet: 0 });
  const dusk = lookAt({ dark: 0.1, low: 0.9, wet: 0 });
  const night = lookAt({ dark: 1, low: 0, wet: 0 });
  const rain = lookAt({ dark: 0, low: 0, wet: 1 });
  assert.ok(night.bloom > day.bloom * 3 && night.bloomThreshold < day.bloomThreshold);
  assert.ok(day.bloomThreshold > 1, 'by day only what is brighter than white paper blooms');
  assert.ok(dusk.warmth > day.warmth && rain.warmth < day.warmth && rain.saturation < day.saturation);
  assert.ok(night.grain > day.grain && night.vignette > day.vignette);
  for (const look of [day, dusk, night, rain]) for (const [k, v] of Object.entries(look)) assert.ok(Number.isFinite(v) && v >= 0 && v < 2, k);
});

test('the film grade: lifted blacks, warm highlights, cool shadows, in range and in order', () => {
  const look = lookAt({ dark: 0, low: 0.5, wet: 0 });
  const black = gradeColor([0, 0, 0], look);
  assert.ok(black.every((c) => c > 0.01 && c < 0.06), 'black is never quite black');
  assert.ok(black[2] > black[0], 'shadows lean cool');
  const white = gradeColor([1, 1, 1], look);
  assert.ok(white[0] > white[2] && white.every((c) => c <= 1), 'highlights lean warm');
  let last = -1;
  for (let k = 0; k <= 50; k += 1) { // brighter in, brighter out
    const out = gradeColor([k / 50, k / 50, k / 50], look);
    const l = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
    assert.ok(l > last, `grey ${k}`);
    last = l;
  }
  const red = [0.8, 0.1, 0.1];
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(gradeColor(red, { ...look, saturation: 0.6 })) < spread(gradeColor(red, { ...look, saturation: 1 })));
  assert.ok(gradeColor([0.5, 0.5, 0.5], look, 1)[1] < gradeColor([0.5, 0.5, 0.5], look, 0)[1], 'corners are darker');
  assert.deepEqual(red, [0.8, 0.1, 0.1], 'the input is not changed');
  assert.match(GRADE_GLSL, /1\.070, 1\.000, 0\.880/, 'the shader uses the same tint as the JS');
});

test('cascaded shadows: the splits rise to 1, the first is tight, and the reach grows with the camera distance', async () => {
  const { SPLITS, WALK_FAR, shadowFar } = await import('../public/js/3d/quality.js');
  for (const [n, list] of Object.entries(SPLITS)) {
    assert.equal(list.length, Number(n));
    assert.equal(list.at(-1), 1);
    for (let k = 1; k < list.length; k += 1) assert.ok(list[k] > list[k - 1]);
  }
  assert.ok(SPLITS[2][0] * WALK_FAR > 10 && SPLITS[2][0] * WALK_FAR < 20, 'the near map covers the few metres round you');
  assert.equal(shadowFar(4), WALK_FAR);
  assert.ok(shadowFar(200) > 300 && shadowFar(5000) === 900);
  for (const tier of Object.values(TIERS)) if (tier.shadows === 'cascade') assert.ok(SPLITS[tier.cascades]);
});
