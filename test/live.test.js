import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createLive } from '../scripts/live.js';
import { createHandler } from '../scripts/serve.js';

const TOKEN = 'x'.repeat(40);

async function start(t, opts = {}) {
  const live = createLive({ token: TOKEN, ...opts });
  const server = createServer(createHandler({ live, trustProxy: opts.trustProxy ?? false })).listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  t.after(() => { live.close(); server.closeAllConnections(); server.close(); });
  return { live, base: `http://127.0.0.1:${server.address().port}` };
}

/** Open /api/live: the page's private id (from the hello event), the first state, and a way to hang up. */
async function watch(base, headers = {}) {
  const ctrl = new AbortController();
  const res = await fetch(`${base}/api/live`, { signal: ctrl.signal, headers });
  if (res.status !== 200) return { status: res.status, close: () => ctrl.abort() };
  const reader = res.body.getReader();
  let text = '';
  while (!text.includes('"online"')) text += new TextDecoder().decode((await reader.read()).value);
  const sid = JSON.parse(text.split('event: hello\ndata: ')[1].split('\n')[0]).sid;
  const data = JSON.parse(text.slice(text.indexOf('data: {"online"') + 6).split('\n')[0]);
  return { status: 200, sid, data, reader, close: () => ctrl.abort() };
}

/** The next state pushed on an open stream. */
async function nextState(w) {
  let text = '';
  for (;;) {
    text += new TextDecoder().decode((await w.reader.read()).value);
    const at = text.lastIndexOf('data: {"online"');
    if (at >= 0 && text.indexOf('\n\n', at) > 0) return JSON.parse(text.slice(at + 6).split('\n')[0]);
  }
}

const post = (base, path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

const settle = () => new Promise((done) => setTimeout(done, 80));

test('every open page counts as one watcher, and stops counting when it closes', async (t) => {
  const { live, base } = await start(t);
  const a = await watch(base);
  const b = await watch(base);
  assert.equal(b.data.online, 2);
  assert.equal(live.online(), 2);
  a.close();
  await settle();
  assert.equal(live.online(), 1);
  b.close();
  await settle();
  assert.equal(live.online(), 0);
});

test('one address cannot open endless streams', async (t) => {
  const { base } = await start(t, { trustProxy: true });
  const open = [];
  for (let k = 0; k < 12; k += 1) open.push(await watch(base, { 'X-Forwarded-For': '203.0.113.9' }));
  const extra = await watch(base, { 'X-Forwarded-For': '203.0.113.9' });
  assert.equal(extra.status, 429);
  const other = await watch(base, { 'X-Forwarded-For': '203.0.113.10' });
  assert.equal(other.status, 200);
  [...open, other].forEach((w) => w.close());
});

test('the operator API needs the token; the overview counts visits and the peak', async (t) => {
  const { base } = await start(t);
  assert.equal((await fetch(`${base}/api/ops/overview`)).status, 401);
  assert.equal((await fetch(`${base}/api/ops/overview`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  const a = await watch(base);
  const b = await watch(base);
  const res = await fetch(`${base}/api/ops/overview`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.kind, 'watch');
  assert.equal(body.live.players, 2);
  assert.equal(body.daily.length, 30);
  assert.equal(body.daily.at(-1).visits, 1, 'two tabs from one address within ten minutes are one visit');
  assert.equal(body.daily.at(-1).peakOnline, 2);
  a.close();
  b.close();
});

test('without OPS_TOKEN the operator API does not exist', async (t) => {
  const live = createLive({ token: '' });
  const server = createServer(createHandler({ live })).listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  t.after(() => { live.close(); server.close(); });
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/ops/overview`, { headers: { Authorization: 'Bearer ' } });
  assert.equal(res.status, 404);
});

test('the admin announcement reaches open pages, cleaned and capped', async (t) => {
  const { base } = await start(t);
  const res = await fetch(`${base}/api/ops/settings`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ announcement: `Loa\u0007 loa ${'a'.repeat(400)}`, maintenance: true, other: 'ignored' }),
  });
  assert.equal(res.status, 200);
  const w = await watch(base);
  assert.ok(w.data.announcement.startsWith('Loa  loa'));
  assert.equal(w.data.announcement.length, 200);
  assert.equal(w.data.maintenance, true);
  assert.equal(w.data.other, undefined);
  w.close();
  const big = await fetch(`${base}/api/ops/settings`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: 'x'.repeat(5000) }).catch(() => ({ status: 400 }));
  assert.ok([400, 413].includes(big.status));
});

test('an IPv6 visitor is counted by their /64', async () => {
  const { ipKey } = await import('../scripts/live.js');
  assert.equal(ipKey('2001:db8:1:2:aaaa::1'), ipKey('2001:db8:1:2:bbbb::9'));
  assert.notEqual(ipKey('2001:db8:1:2::1'), ipKey('2001:db8:1:3::1'));
  assert.equal(ipKey('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(ipKey('203.0.113.9'), '203.0.113.9');
});

test('no dotfiles, no unknown file types', async (t) => {
  const { base } = await start(t);
  assert.equal((await fetch(`${base}/js/duavit/VENDORED.md`)).status, 404);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('a page can come home to the xóm with a name and a look, and everyone sees it', async (t) => {
  const { live, base } = await start(t);
  const me = await watch(base);
  const other = await watch(base);
  assert.equal((await post(base, '/api/join', { sid: 'nope', name: 'Cu Tèo', look: 'treCon' })).status, 400);
  assert.equal((await post(base, '/api/join', { sid: me.sid, name: 'đm thằng', look: 'treCon' })).status, 400, 'rude names are refused');
  assert.equal((await post(base, '/api/join', { sid: me.sid, name: 'Cu Tèo', look: 'xeTang' })).status, 400, 'unknown look');
  const res = await post(base, '/api/join', { sid: me.sid, name: '  Cu   Tèo  ', look: 'treCon' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, 'Cu Tèo');
  const seen = await nextState(other);
  assert.deepEqual(seen.guests, [{ id: body.id, name: 'Cu Tèo', look: 'treCon' }]);
  assert.equal(live.guestCount(), 1);
  assert.equal((await post(base, '/api/join', { sid: me.sid, name: 'Cu Tí', look: 'treCon' })).status, 429, 'renaming is slowed down');
  me.close();
  await settle();
  assert.equal(live.guestCount(), 0, 'closing the page sends the character home');
  other.close();
});

test('leaving, the per-address cap, and the admin sending a guest away', async (t) => {
  const { live, base } = await start(t, { trustProxy: true });
  const ip = { 'X-Forwarded-For': '198.51.100.7' };
  const pages = [];
  for (let k = 0; k < 4; k += 1) pages.push(await watch(base, ip));
  for (let k = 0; k < 3; k += 1) assert.equal((await post(base, '/api/join', { sid: pages[k].sid, name: `Khách ${k}`, look: 'aoDai' })).status, 200);
  assert.equal((await post(base, '/api/join', { sid: pages[3].sid, name: 'Khách 3', look: 'aoDai' })).status, 429, 'three per address');
  assert.equal((await post(base, '/api/leave', { sid: pages[0].sid })).status, 200);
  assert.equal(live.guestCount(), 2);
  const overview = await (await fetch(`${base}/api/ops/overview`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
  const target = overview.guests[0].id;
  assert.equal((await fetch(`${base}/api/ops/guests/${target}/kick`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/api/ops/guests/${target}/kick`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` } })).status, 200);
  assert.equal(live.guestCount(), 1);
  assert.equal((await post(base, '/api/join', { sid: pages[3].sid, name: 'Quay lại', look: 'aoDai' })).status, 403, 'that address waits a while');
  pages.forEach((p) => p.close());
});
