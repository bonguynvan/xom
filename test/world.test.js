import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAST } from '../public/js/cast.js';
import { MAP } from '../public/js/map.js';
import { createWorld, stepWorld, STEP_MS } from '../public/js/world.js';

const run = (world, seconds) => {
  let w = world;
  for (let i = 0; i < (seconds * 1000) / STEP_MS; i += 1) w = stepWorld(w, STEP_MS);
  return w;
};
const people = (w) => w.agents.filter((a) => ['keeper', 'walker', 'kid', 'vendor'].includes(a.kind));

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

test('one agent per resident name', () => {
  const w = createWorld({ seed: 1 });
  assert.equal(w.agents.length, CAST.reduce((n, c) => n + c.names.length, 0));
  assert.equal(new Set(w.agents.map((a) => a.name)).size, w.agents.length, 'names are unique');
});

test('the same seed replays the same xóm; another seed differs', () => {
  const a = run(createWorld({ seed: 42, minute: 7 * 60 }), 100);
  const b = run(createWorld({ seed: 42, minute: 7 * 60 }), 100);
  const c = run(createWorld({ seed: 43, minute: 7 * 60 }), 100);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.agents, c.agents);
});

test('a step never mutates the world it was given', () => {
  const w = deepFreeze(createWorld({ seed: 7, minute: 8 * 60 }));
  assert.doesNotThrow(() => run(w, 30));
});

test('everyone stays on the map (vehicles may wait just off it)', () => {
  const w = run(createWorld({ seed: 3, minute: 9 * 60 }), 240);
  for (const a of w.agents) {
    const margin = a.kind === 'vehicle' || a.kind === 'flyer' ? 160 : 0;
    assert.ok(a.x >= -margin && a.x <= MAP.w + margin && a.y >= 0 && a.y <= MAP.h, `${a.name} at ${a.x},${a.y}`);
  }
});

test('shopkeepers mind their shop by day', () => {
  const w = run(createWorld({ seed: 5, minute: 9 * 60 }), 90);
  const keepers = w.agents.filter((a) => a.kind === 'keeper');
  const atWork = keepers.filter((a) => a.state === 'stay' && a.target?.placeId === a.workplace);
  assert.ok(atWork.length >= keepers.length - 2, `${atWork.length}/${keepers.length} at work`);
});

test('at night people go home and the street empties', () => {
  const w = run(createWorld({ seed: 9, minute: 22 * 60 }), 6 * 60); // 22:00 -> 04:00
  const inside = people(w).filter((a) => a.state === 'inside');
  assert.ok(inside.length >= people(w).length * 0.8, `${inside.length}/${people(w).length} inside`);
});

test('nobody sits on someone else\'s stool', () => {
  let w = createWorld({ seed: 11, minute: 8 * 60 });
  for (let i = 0; i < 6; i += 1) {
    w = run(w, 30);
    const taken = w.agents.filter((a) => a.state === 'stay' && a.target?.spot !== null && a.target?.spot !== undefined)
      .map((a) => `${a.target.placeId}:${a.target.spot}`);
    assert.equal(new Set(taken).size, taken.length, `duplicate spots at ${i}: ${taken.join(' ')}`);
  }
});

test('a chat always has two sides', () => {
  let w = createWorld({ seed: 21, minute: 8 * 60 });
  let chats = 0;
  for (let i = 0; i < 1200; i += 1) {
    w = stepWorld(w, STEP_MS);
    for (const a of w.agents.filter((x) => x.state === 'chat')) {
      chats += 1;
      const other = w.agents[a.chatWith];
      assert.equal(other.state, 'chat');
      assert.equal(other.chatWith, a.i);
    }
  }
  assert.ok(chats > 0, 'people do meet and talk');
});

test('the ward loudspeaker speaks at dawn', () => {
  const w = run(createWorld({ seed: 2, minute: 5 * 60 + 58 }), 5);
  assert.ok(w.broadcast && w.broadcast.text.length > 0);
});

test('the clock can run in real time', () => {
  const w = run(createWorld({ seed: 1, minute: 600, rate: 1 / 60 }), 60);
  assert.ok(Math.abs(w.minute - 601) < 1e-6);
});

test('the clock runs one game minute per real second', () => {
  const w = run(createWorld({ seed: 1, minute: 600 }), 10);
  assert.ok(Math.abs(w.minute - 610) < 1e-6);
});

test('a keeper whose shop has closed stays home instead of popping in and out of the door', () => {
  let w = createWorld({ seed: 4, minute: 10 * 60 + 30 }); // the phở stall closes at 10:00
  let exits = 0;
  let wasInside = false;
  for (let i = 0; i < (120 * 1000) / STEP_MS; i += 1) {
    w = stepWorld(w, STEP_MS);
    const baChin = w.agents.find((a) => a.castId === 'baChin');
    if (wasInside && baChin.state !== 'inside') exits += 1;
    wasInside = baChin.state === 'inside';
  }
  assert.ok(exits <= 1, `left home ${exits} times in two minutes`);
});

/** Run a whole day, calling `check(world)` once a game minute. */
const everyMinute = (world, minutes, check) => {
  let w = world;
  for (let m = 0; m < minutes; m += 1) {
    for (let k = 0; k < 1000 / STEP_MS; k += 1) w = stepWorld(w, STEP_MS);
    check(w);
  }
  return w;
};

test('street vendors keep walking all over the xóm', () => {
  const span = new Map();
  everyMinute(createWorld({ seed: 11, minute: 7 * 60 }), 13 * 60, (w) => {
    for (const a of w.agents.filter((x) => x.kind === 'vendor' && x.wakeAt < 12)) { // the day vendors (the night ones sleep now)
      const [lo, hi] = span.get(a.i) ?? [Infinity, -Infinity];
      span.set(a.i, [Math.min(lo, a.x), Math.max(hi, a.x)]);
    }
  });
  for (const [i, [lo, hi]] of span) assert.ok(hi - lo > MAP.w * 0.45, `vendor ${i} covered only ${Math.round(lo)}..${Math.round(hi)}`);
});

test('nobody walking stands still for long, and heading home always means walking (or inside)', () => {
  const still = new Map();
  everyMinute(createWorld({ seed: 4, minute: 6 * 60 }), 24 * 60, (w) => {
    for (const a of w.agents) {
      if (a.target?.home) assert.ok(a.state === 'walk' || a.state === 'inside', `${a.name} going home while ${a.state}`);
      if (a.state !== 'walk') { still.delete(a.i); continue; }
      const seen = still.get(a.i);
      if (!seen || seen.x !== a.x || seen.y !== a.y) { still.set(a.i, { x: a.x, y: a.y, minutes: 0 }); continue; }
      seen.minutes += 1;
      assert.ok(seen.minutes < 3, `${a.name} frozen at x=${a.x} while walking`);
    }
  });
});

test('a whole day and night never mutates the world it was given', () => {
  let w = createWorld({ seed: 9, minute: 16 * 60 });
  for (let k = 0; k < 14 * 60 * 20; k += 1) w = stepWorld(deepFreeze(w));
  assert.ok(w.minute > 29 * 60);
});

test('some people who bump into each other quarrel instead of chatting', () => {
  let w = createWorld({ seed: 21, minute: 8 * 60 });
  let angry = 0;
  for (let i = 0; i < 6000; i += 1) {
    w = stepWorld(w, STEP_MS);
    angry += w.agents.filter((a) => a.bubble?.angry && a.state === 'chat').length;
  }
  assert.ok(angry > 0, 'nobody ever quarrelled');
});

test('visitors step out of a house, live like neighbours day and night, and leave without disturbing anyone', async () => {
  const { syncGuests } = await import('../public/js/world.js');
  const start = deepFreeze(run(createWorld({ seed: 6, minute: 23 * 60 }), 5));
  const before = start.agents.length;
  let w = syncGuests(start, [{ id: 'g1', name: 'Cu Tèo', look: 'treCon' }, { id: 'g2', name: 'Cô Ba', look: 'aoDai' }]);
  assert.equal(w.agents.length, before + 2);
  assert.deepEqual(w.agents.slice(-2).map((a) => [a.i, a.kind, a.name]), [[before, 'guest', 'Cu Tèo'], [before + 1, 'guest', 'Cô Ba']]);
  assert.equal(syncGuests(w, [{ id: 'g1', name: 'Cu Tèo', look: 'treCon' }, { id: 'g2', name: 'Cô Ba', look: 'aoDai' }]), w, 'nothing changed, same world');
  w = run(w, 120);
  const g1 = w.agents.find((a) => a.guestId === 'g1');
  assert.notEqual(g1.state, 'inside', 'a visitor at midnight is out and about, not in bed');
  w = deepFreeze(syncGuests(w, [{ id: 'g2', name: 'Cô Ba Béo', look: 'aoDai' }]));
  assert.equal(w.agents.find((a) => a.guestId === 'g1').state, 'gone');
  assert.equal(w.agents.find((a) => a.guestId === 'g2').name, 'Cô Ba Béo');
  assert.doesNotThrow(() => run(w, 60), 'the world carries on with a gone visitor in it');
  w.agents.forEach((a, k) => assert.equal(a.i, k));
});

test('the road fills up at rush hour and empties at night', async () => {
  const { trafficAt } = await import('../public/js/world.js');
  assert.ok(trafficAt(7.5) > 0.8 && trafficAt(17.5) > 0.8, 'rush hours');
  assert.ok(trafficAt(12) < trafficAt(7.5) && trafficAt(3) < 0.1, 'quieter at noon, empty at night');
  const onRoad = (h) => run(createWorld({ seed: 4, minute: h * 60 }), 20).agents.filter((a) => a.kind === 'vehicle' && a.state !== 'away').length;
  assert.ok(onRoad(7.5) > onRoad(12) * 1.3 && onRoad(12) > onRoad(3) * 3, 'more riders out at rush hour');
});

test('at rush hour riders queue behind each other', () => {
  let w = createWorld({ seed: 4, minute: 7.5 * 60 });
  let queued = 0;
  for (let k = 0; k < 1200; k += 1) {
    const before = w;
    w = stepWorld(w, STEP_MS);
    for (const a of w.agents) {
      if (a.kind !== 'vehicle' || a.state !== 'drive' || a.hasty) continue;
      const was = before.agents[a.i];
      if (was.state === 'drive' && Math.abs(a.s - was.s) < a.speed * (STEP_MS / 1000) * 0.7) queued += 1; // held up by the one in front
    }
  }
  assert.ok(queued > 100, 'at rush hour riders are held up behind others');
});

test('people talk about the hour, the place and the weather, and do not repeat themselves', async () => {
  const { setWeather } = await import('../public/js/world.js');
  let w = setWeather(createWorld({ seed: 8, minute: 9 * 60 }), { kind: 'rain', tempC: 24 });
  const said = new Map();
  for (let k = 0; k < 2400; k += 1) {
    w = stepWorld(w, STEP_MS);
    for (const a of w.agents) if (a.bubble && a.bubble.from === w.t) said.set(a.i, [...(said.get(a.i) ?? []), a.bubble.text]);
  }
  const all = [...said.values()].flat();
  assert.ok(new Set(all).size > 150, `${new Set(all).size} different lines in two minutes`);
  assert.ok(all.some((t) => t.toLowerCase().includes('mưa')), 'someone mentions the rain');
  for (const [i, lines] of said) {
    for (let n = 1; n < lines.length; n += 1) assert.notEqual(lines[n], lines[n - 1], `agent ${i} repeats itself`);
  }
});

test('rain keeps people in: fewer out than on a dry day', async () => {
  const { setWeather } = await import('../public/js/world.js');
  const out = (kind) => {
    const w = run(setWeather(createWorld({ seed: 12, minute: 6 * 60 }), { kind, tempC: 26 }), 240);
    return w.agents.filter((a) => (a.kind === 'walker' || a.kind === 'kid') && a.state !== 'inside').length;
  };
  assert.ok(out('rain') < out('clear') * 0.8, 'the rain empties the alleys');
});

test('night vendors are out past midnight and home before dawn', () => {
  const vendors = (w) => w.agents.filter((a) => a.kind === 'vendor' && a.wakeAt >= 19);
  const late = run(createWorld({ seed: 3, minute: 23 * 60 + 50 }), 40); // 00:30
  assert.ok(vendors(late).length >= 3);
  assert.ok(vendors(late).every((a) => a.state !== 'inside'), 'all calling down the alleys at half past midnight');
  const dawn = run(createWorld({ seed: 3, minute: 4 * 60 }), 20);
  assert.ok(vendors(dawn).every((a) => a.state === 'inside'), 'all home by four');
});

test('careful riders never end up inside the rider in front, and a bump is followed by a breather', () => {
  let w = createWorld({ seed: 4, minute: 7.5 * 60 });
  const bumpedAt = new Map();
  for (let k = 0; k < 1200; k += 1) {
    const before = w;
    w = stepWorld(w, STEP_MS);
    const lanes = new Map();
    for (const a of w.agents) {
      if (a.kind !== 'vehicle' || (a.state !== 'drive' && a.state !== 'bump')) continue;
      const key = `${a.dir}:${Math.round(a.sub / 5)}`;
      lanes.set(key, [...(lanes.get(key) ?? []), a]);
      if (a.state === 'bump' && before.agents[a.i].state !== 'bump') {
        if (bumpedAt.has(a.i)) assert.ok(w.t - bumpedAt.get(a.i) > 20000, `rider ${a.i} bumps again too soon`);
        bumpedAt.set(a.i, w.t);
      }
    }
    for (const list of lanes.values()) {
      const order = [...list].sort((p, q) => (p.s - q.s) * p.dir);
      for (let n = 0; n < order.length - 1; n += 1) {
        const [me, front] = [order[n], order[n + 1]];
        if (me.hasty) continue;
        assert.ok(Math.abs(front.s - me.s) > (me.size + front.size) * 0.45 - 1, `rider ${me.i} drove into ${front.i}`);
      }
    }
  }
});
