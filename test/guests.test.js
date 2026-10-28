import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCast } from '../public/js/cast.js';
import { GUEST_LOOKS, cleanName, randomName } from '../public/js/guests.js';

test('every guest look borrows a real cast type', () => {
  for (const l of GUEST_LOOKS) assert.ok(findCast(l.castId), `${l.id} -> ${l.castId}`);
});

test('names: trimmed and kept when friendly, refused when rude, about gambling, too short or odd', () => {
  assert.equal(cleanName('  Cô   Ba  Hàng   Xén '), 'Cô Ba Hàng Xén');
  assert.equal(cleanName("Anh Tú Đẹp Trai 99"), 'Anh Tú Đẹp Trai 99');
  for (const bad of ['a', 'x'.repeat(25), 'Đm mày', 'thằng địt', 'Vua cá độ', 'admin', 'Peti', '<b>hi</b>', 'Tên\u0007lạ', 42, null, 'vcl']) {
    assert.equal(cleanName(bad), null, String(bad));
  }
  assert.ok(cleanName(randomName()));
});
