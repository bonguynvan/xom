// Seeing each other walk: the shared maths (what a move may be, how neighbours are drawn between messages)
// and the server's side of it (POST /api/move: a joined guest, a possible place, a possible speed, not too often).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { BOUNDS, BUFFER_MS, EXTRAPOLATE_MS, IDLE_GAP_MS, MAX_SPEED, MIN_GAP_MS, SEND_MS, SLACK, cleanMove, pushMove, sampleMoves, shouldSend, withinReach } from '../public/js/3d/net-move.js';
import { createLive } from '../scripts/live.js';
import { createHandler } from '../scripts/serve.js';

test('a move is cleaned: finite numbers inside the map, a known state, nothing else kept', () => {
  assert.deepEqual(cleanMove({ x: 100.123, y: 200.987, h: 1.23456, a: 'walk', extra: 'x', sid: 's' }), { x: 100.1, y: 201, h: 1.23, a: 'walk' });
  assert.equal(cleanMove({ x: 100, y: 200, h: 7, a: 'run' }).h, Math.round(Math.atan2(Math.sin(7), Math.cos(7)) * 100) / 100);
  for (const bad of [null, 'x', [], { x: '1', y: 2, h: 0, a: 'walk' }, { x: NaN, y: 2, h: 0, a: 'walk' }, { x: Infinity, y: 2, h: 0, a: 'walk' },
    { x: BOUNDS.x1 + 1, y: 2, h: 0, a: 'walk' }, { x: 5, y: BOUNDS.y0 - 1, h: 0, a: 'walk' }, { x: 5, y: 5, h: 0, a: 'fly' }, { x: 5, y: 5, h: 1e9, a: 'walk' }, { x: 5, y: 5, a: 'walk' }]) {
    assert.equal(cleanMove(bad), null, JSON.stringify(bad));
  }
});

test('reach: anywhere at first or after a long silence, otherwise only as far as a run allows', () => {
  const last = { x: 100, y: 100, at: 1000 };
  assert.ok(withinReach(null, { x: 900, y: 600 }, 5));
  assert.ok(withinReach(last, { x: 103, y: 100 }, 1100), 'a run for a tenth of a second');
  assert.ok(!withinReach(last, { x: 100 + MAX_SPEED * 0.1 + SLACK + 1, y: 100 }, 1100));
  assert.ok(withinReach(last, { x: 100 + MAX_SPEED + SLACK - 1, y: 100 }, 2000));
  assert.ok(!withinReach(last, { x: 700, y: 400 }, 1000 + IDLE_GAP_MS - 1), 'no teleport while talking');
  assert.ok(withinReach(last, { x: 700, y: 400 }, 1000 + IDLE_GAP_MS), 'back from looking from above');
  assert.ok(!withinReach(last, { x: 130, y: 100 }, 900), 'a clock that ran backwards buys nothing');
});

test('the page sends ten times a second while moving and once a second while standing', () => {
  const at = { x: 10, y: 10, h: 0, a: 'idle' };
  assert.ok(shouldSend(null, at, 0));
  const sent = { ...at, at: 1000 };
  assert.ok(!shouldSend(sent, { ...at, x: 11 }, 1000 + SEND_MS - 1));
  assert.ok(shouldSend(sent, { ...at, x: 11 }, 1000 + SEND_MS));
  assert.ok(shouldSend(sent, { ...at, a: 'sit' }, 1000 + SEND_MS));
  assert.ok(!shouldSend(sent, at, 1500), 'standing still: nothing to say yet');
  assert.ok(shouldSend(sent, at, 2000), 'but still there');
});

test('neighbours are drawn a little in the past, between messages; carried on briefly, then held', () => {
  let buf = [];
  for (let k = 0; k <= 5; k += 1) buf = pushMove(buf, { t: k * 100, x: k * 3, y: 50, h: 0.1 * k, a: 'walk' });
  const mid = sampleMoves(buf, 250 + BUFFER_MS);
  assert.ok(Math.abs(mid.x - 7.5) < 1e-9 && Math.abs(mid.h - 0.25) < 1e-9 && mid.a === 'walk');
  assert.ok(Math.abs(mid.speed - 30) < 1e-6);
  let last = -1;
  for (let now = 0; now <= 500 + BUFFER_MS + EXTRAPOLATE_MS; now += 16) { const s = sampleMoves(buf, now); assert.ok(s.x >= last - 1e-9, `no step back at ${now}`); last = s.x; }
  const ahead = sampleMoves(buf, 500 + BUFFER_MS + 100);
  assert.ok(Math.abs(ahead.x - 18) < 1e-6, 'a tenth of a second past the last message, carried on at the same speed');
  const held = sampleMoves(buf, 500 + BUFFER_MS + 2000);
  assert.ok(Math.abs(held.x - (15 + 30 * EXTRAPOLATE_MS / 1000)) < 1e-6 && held.speed === 0, 'then they stand where the carrying stopped');
  assert.equal(sampleMoves(buf, 500 + 6000), null, 'too old to trust');
  assert.ok(sampleMoves(buf, 500 + 6000, Infinity), 'unless the caller says to hold');
  assert.equal(sampleMoves([], 0), null);
  assert.deepEqual(sampleMoves([{ t: 0, x: 1, y: 2, h: 3, a: 'idle' }], 50), { x: 1, y: 2, h: 3, a: 'idle', speed: 0 });
  const turn = sampleMoves([{ t: 0, x: 0, y: 0, h: 3.1, a: 'walk' }, { t: 100, x: 0, y: 0, h: -3.1, a: 'walk' }], 50 + BUFFER_MS);
  assert.ok(Math.abs(turn.h) > 3, 'headings turn the short way round');
});

test('the buffer keeps the newest twelve in order and never changes its input', () => {
  let buf = [];
  const first = buf;
  for (let k = 0; k < 30; k += 1) buf = pushMove(buf, { t: k, x: k, y: 0, h: 0, a: 'walk' });
  assert.equal(first.length, 0);
  assert.equal(buf.length, 12);
  assert.equal(buf[0].t, 18);
  const again = pushMove(buf, { t: 25, x: 99, y: 0, h: 0, a: 'walk' });
  assert.equal(again.at(-1).x, 99, 'a message for an earlier moment replaces what came after it');
});

// ---------------- the server ----------------

async function start(t, opts = {}) {
  const live = createLive({ token: 'x'.repeat(40), ...opts });
  const server = createServer(createHandler({ live })).listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  t.after(() => { live.close(); server.closeAllConnections(); server.close(); });
  return { live, base: `http://127.0.0.1:${server.address().port}` };
}
async function watch(base) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/live`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  let text = '';
  while (!text.includes('"online"')) text += new TextDecoder().decode((await reader.read()).value);
  return { sid: JSON.parse(text.split('event: hello\ndata: ')[1].split('\n')[0]).sid, reader, close: () => ctrl.abort() };
}
async function until(w, marker) {
  let text = '';
  for (;;) {
    text += new TextDecoder().decode((await w.reader.read()).value);
    const at = text.indexOf(marker);
    if (at >= 0 && text.indexOf('\n\n', at) > 0) return text.slice(at + marker.length).split('\n')[0];
  }
}
const post = (base, path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('POST /api/move: only a joined guest, only a valid place', async (t) => {
  const clock = { now: 1_000_000 };
  const { base } = await start(t, { now: () => clock.now });
  const w = await watch(base);
  t.after(() => w.close());
  assert.equal((await post(base, '/api/move', { sid: 'nope', x: 1, y: 1, h: 0, a: 'walk' })).status, 400);
  assert.equal((await post(base, '/api/move', { sid: w.sid, x: 100, y: 100, h: 0, a: 'walk' })).status, 403, 'watching is not walking');
  assert.equal((await post(base, '/api/join', { sid: w.sid, name: 'Cu Tí', look: 'treCon' })).status, 200);
  assert.equal((await post(base, '/api/move', { sid: w.sid, x: 100, y: 100, h: 0, a: 'walk' })).status, 200);
  clock.now += 200;
  for (const bad of [{ x: 99999, y: 100, h: 0, a: 'walk' }, { x: 'a', y: 100, h: 0, a: 'walk' }, { x: 100, y: 100, h: 0, a: 'teleport' }, {}]) {
    assert.equal((await post(base, '/api/move', { sid: w.sid, ...bad })).status, 400, JSON.stringify(bad));
    clock.now += 200;
  }
  assert.equal((await fetch(`${base}/api/move`)).status, 404, 'GET is not a move');
});

test('POST /api/move: the speed cap, the pause that allows reappearing, and the per-page interval', async (t) => {
  const clock = { now: 1_000_000 };
  const { base } = await start(t, { now: () => clock.now });
  const w = await watch(base);
  t.after(() => w.close());
  await post(base, '/api/join', { sid: w.sid, name: 'Cu Tí', look: 'treCon' });
  const move = (x, y) => post(base, '/api/move', { sid: w.sid, x, y, h: 0, a: 'run' });
  assert.equal((await move(100, 300)).status, 200, 'the first place is anywhere');
  clock.now += MIN_GAP_MS - 10;
  assert.equal((await move(101, 300)).status, 429, 'too soon after the last');
  clock.now += 100;
  assert.equal((await move(103, 300)).status, 200);
  clock.now += 100;
  const far = await move(400, 300);
  assert.equal(far.status, 422, 'nobody runs 45 m in a tenth of a second');
  assert.deepEqual(await far.json().then((b) => [b.x, b.y]), [103, 300], 'the server says where it still has you');
  clock.now += 100;
  assert.equal((await move(106, 300)).status, 200, 'and carries on from there');
  clock.now += IDLE_GAP_MS;
  assert.equal((await move(900, 500)).status, 200, 'after a pause (looking from above) you may come down anywhere');
  clock.now += 6000;
  assert.equal((await post(base, '/api/join', { sid: w.sid, name: 'Cu Tèo', look: 'treCon' })).status, 200);
  clock.now += 100;
  assert.equal((await move(50, 50)).status, 200, 'coming in again starts from no place');
});

test('POST /api/move: one address cannot flood, whatever number of pages it opens', async (t) => {
  const clock = { now: 1_000_000 };
  const { base } = await start(t, { now: () => clock.now });
  const pages = await Promise.all([watch(base), watch(base), watch(base)]);
  t.after(() => pages.forEach((p) => p.close()));
  for (const [k, p] of pages.entries()) assert.equal((await post(base, '/api/join', { sid: p.sid, name: ['Cu Tí', 'Cu Tèo', 'Cu Tủn'][k], look: 'treCon' })).status, 200);
  const codes = [];
  for (let k = 0; k < 60; k += 1) { // sixty messages inside one second, spread over three pages
    clock.now += 15;
    codes.push((await post(base, '/api/move', { sid: pages[k % 3].sid, x: 100 + k * 0.1, y: 300, h: 0, a: 'walk' })).status);
  }
  const ok = codes.filter((c) => c === 200).length;
  assert.ok(ok > 5 && ok <= 45, `${ok} accepted`);
  assert.ok(codes.includes(429));
  clock.now += 1500;
  assert.equal((await post(base, '/api/move', { sid: pages[0].sid, x: 110, y: 300, h: 0, a: 'walk' })).status, 200, 'the next second starts clean');
});

test('places are passed on to every open stream, and a newcomer learns where everybody stands', async (t) => {
  const { base } = await start(t);
  const [walker, onlooker] = [await watch(base), await watch(base)];
  t.after(() => { walker.close(); onlooker.close(); });
  const joined = await (await post(base, '/api/join', { sid: walker.sid, name: 'Cu Tí', look: 'treCon' })).json();
  const heard = until(onlooker, 'event: moves\ndata: ');
  assert.equal((await post(base, '/api/move', { sid: walker.sid, x: 321.5, y: 300, h: 1.5, a: 'walk' })).status, 200);
  assert.deepEqual(JSON.parse(await heard), [[joined.id, 321.5, 300, 1.5, 'walk']]);
  const late = await watch(base);
  t.after(() => late.close());
  const state = JSON.parse(await until(late, 'data: {"online"').then((rest) => `{"online"${rest}`).catch(() => 'null'));
  const g = state?.guests?.find((q) => q.id === joined.id);
  assert.ok(!g || (g.x === 321.5 && g.y === 300), 'the state carries the place when it lists the guest');
  assert.ok(!JSON.stringify(state ?? {}).includes('127.0.0.1'), 'no address ever leaves the server');
});
