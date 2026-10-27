import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST, GREETINGS, LOA_PHUONG, QUARRELS } from '../public/js/cast.js';
import { MAP } from '../public/js/map.js';
import { PLACES, findPlace } from '../public/js/places.js';

const KINDS = ['keeper', 'walker', 'kid', 'vendor', 'vehicle', 'animal', 'stray', 'flyer'];
// Peti never uses gambling words (see the duavit wording rules).
const BANNED = ['may rủi', 'may mắn', 'cầu may', 'giải thưởng', 'tiền thưởng', 'trúng thưởng', 'cược', 'xổ số', 'lô đề', 'bầu cua', 'đánh bạc', 'cờ bạc'];

test('every resident is well formed', () => {
  assert.equal(new Set(CAST.map((c) => c.id)).size, CAST.length, 'unique ids');
  for (const c of CAST) {
    assert.ok(KINDS.includes(c.kind), `${c.id} kind`);
    assert.ok(c.names.length >= 1 && c.names.every((n) => n.trim()), `${c.id} names`);
    assert.ok(c.bio?.trim(), `${c.id} bio`);
    assert.ok(Array.isArray(c.lines) && c.lines.every((l) => l.trim()), `${c.id} lines`);
    assert.match(c.color, /^#[0-9a-f]{6}$/i, `${c.id} color`);
    if (c.kind === 'keeper') assert.ok(findPlace(c.place), `${c.id} works somewhere real`);
    if (c.home && c.kind !== 'animal') assert.equal(findPlace(c.home)?.kind, 'house', `${c.id} lives in a house`);
    if (c.home) assert.ok(findPlace(c.home), `${c.id} has a real home`);
    for (const p of c.likes ?? []) assert.ok(findPlace(p), `${c.id} likes unknown place ${p}`);
  }
});

test('buildings in a row do not overlap, and everything is on the map', () => {
  assert.equal(new Set(PLACES.map((p) => p.id)).size, PLACES.length, 'unique ids');
  const buildings = PLACES.filter((p) => p.building);
  for (const a of buildings) {
    for (const b of buildings) {
      if (a === b) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.front <= b.front - b.depth || b.front <= a.front - a.depth;
      assert.ok(apart, `${a.id} overlaps ${b.id}`);
    }
  }
  assert.ok(buildings.filter((p) => p.kind === 'house').length >= 80, 'a xóm full of houses');
  for (const p of PLACES) {
    assert.ok(p.x >= 0 && p.x + p.w <= MAP.w, `${p.id} x`);
    for (const s of p.spots) assert.ok(s.x > 0 && s.x < MAP.w && s.y > 0 && s.y < MAP.h, `${p.id} spot`);
  }
});

test('nothing anyone says uses gambling words', () => {
  const said = [...CAST.flatMap((c) => [c.bio, ...c.lines, ...c.names]), ...GREETINGS.flat(), ...QUARRELS.flat(), ...LOA_PHUONG].map((s) => s.toLowerCase());
  for (const word of BANNED) assert.ok(!said.some((s) => s.includes(word)), word);
});

test('no house is built on the main road', async () => {
  const { ROAD_HALF, ROAD_LINE } = await import('../public/js/map.js');
  for (const h of PLACES.filter((p) => p.kind === 'house')) {
    for (const r of ROAD_LINE) {
      const onIt = r.x > h.x && r.x < h.x + h.w && r.y + ROAD_HALF > h.front - h.depth && r.y - ROAD_HALF < h.front;
      assert.ok(!onIt, `${h.id} at ${h.x},${h.front} sits on the road`);
    }
  }
});
