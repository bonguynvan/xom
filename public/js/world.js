// The xóm simulation. Pure: stepWorld returns a new world and never touches the old one, and every
// random choice is noise(seed, agent, tick, purpose), so a seed replays the same day exactly.
// People walk the graph of ways (map.js) between places; vehicles ride the main road; animals potter.
import { CAST, GREETINGS, LOA_PHUONG, QUARRELS, findCast } from './cast.js';
import { lookById } from './guests.js';
import { ANYTIME, BY_HOUR, BY_PLACE, BY_WEATHER, HONKS, MEMES, MORE_GREETINGS, MORE_QUARRELS, TRAFFIC_QUARRELS, partOfDay } from './lines.js';
import { DAY, MAP, MINUTES_PER_SECOND, NODES, ROAD_LENGTH, SPEED, SPRITE, hourOf, nearestNode, nodesNear, onRoad, routeNodes } from './map.js';
import { PLACES, QUAN_COC, findPlace, isOpen, keeperSpot } from './places.js';
import { noise, pickWith, salt } from './rng.js';

export const STEP_MS = 50;
const PEOPLE = ['keeper', 'walker', 'kid', 'vendor', 'guest'];
const GUEST_LIKES = ['cho', 'traDa', 'che', 'pho', 'tapHoa', 'dinh', 'ao', 'gieng', 'benXe', 'cayBang', 'cayPhuong', 'bangDia', 'buuDien', 'sanChoi'];
const CHAT_RANGE = 8;
const CHAT_CHANCE = 0.03; // per step while two people pass each other
const CHAT_COOLDOWN_MS = 30000;
const LANE = 8; // vehicles keep right: east-bound nearer the viewer
const SUB_LANE = 5; // riders spread over a few sub-lanes on their side
const FOLLOW_GAP = 5; // a rider slows when this close behind the one in front, and stops at about FOLLOW_GAP
const FOLLOW_SPAN = 14;
const BUMP_CHANCE = 0.012; // per step for two riders practically touching (only the hasty ones get that close)
const RECENT = 6; // lines a person remembers saying, and will not say again soon
const ALL_GREETINGS = [...GREETINGS, ...MORE_GREETINGS];
const ALL_QUARRELS = [...QUARRELS, ...MORE_QUARRELS];
const YOUNG_KINDS = new Set(['kid', 'stray', 'guest']);
const ROAD_END = 140; // the road line runs on past both edges of the map; vehicles start inside it
const S = { exit: salt('exit'), target: salt('target'), spot: salt('spot'), stay: salt('stay'), say: salt('say'),
  line: salt('line'), wake: salt('wake'), sleep: salt('sleep'), meet: salt('meet'), greet: salt('greet'),
  away: salt('away'), quarrel: salt('quarrel'), dir: salt('dir'), start: salt('start'), wander: salt('wander'), pause: salt('pause'),
  loa: salt('loa'), walk: salt('walk'), rank: salt('rank'), lane: salt('lane'), hasty: salt('hasty'), bump: salt('bump'),
  pool: salt('pool'), rain: salt('rain') };

const ENTRIES = PLACES.map((p) => p.entry);
const pt = (p) => ({ x: p.x, y: p.y, n: -1 });
const nodePt = (id) => ({ x: NODES[id].x, y: NODES[id].y, n: id });
const toNode = (id) => ({ placeId: null, spot: null, entry: id, door: null, point: NODES[id] });
const homeTarget = (a) => { const h = findPlace(a.home); return { placeId: a.home, spot: null, home: true, entry: h.entry, door: h.door, point: h.door }; };

/** Bedtimes differ a little per person so the street empties gradually. */
function schedule(kind, seed, i, hours) {
  if (hours) return { wakeAt: hours[0], sleepAt: hours[1] }; // night vendors: e.g. 19.5 to 25.5 (1:30 at night)
  if (kind === 'guest') return { wakeAt: 0, sleepAt: 24.01 }; // a visitor comes whenever they like
  if (kind === 'keeper') return { wakeAt: 5 + noise(seed, i, S.wake), sleepAt: 21.5 + noise(seed, i, S.sleep) };
  if (kind === 'kid') return { wakeAt: 6.5 + noise(seed, i, S.wake), sleepAt: 19.3 + noise(seed, i, S.sleep) * 1.5 };
  const owl = noise(seed, i, S.sleep, 2) < 0.08; // a few are out till past midnight
  // The later it gets, the emptier the alleys: bedtimes spread from seven to half past ten.
  return { wakeAt: 5.5 + noise(seed, i, S.wake) * 1.5, sleepAt: owl ? 24.5 + noise(seed, i, S.sleep) : 19 + noise(seed, i, S.sleep) * 3.5 };
}
/** Awake at this hour? A bedtime past 24 means after midnight. */
const awake = (a, hour) => (a.sleepAt > 24 ? hour >= a.wakeAt || hour < a.sleepAt - 24 : hour >= a.wakeAt && hour < a.sleepAt);

/** `rate` is game minutes per real second: 1/60 is real time, the default 1 shows a day in 24 minutes. */
export function createWorld({ seed = 1, minute = 7 * 60, rate = MINUTES_PER_SECOND } = {}) {
  const hour = hourOf(minute);
  let i = 0;
  const agents = CAST.flatMap((c) => c.names.map((name) => {
    const base = { i, castId: c.id, kind: c.kind, name, painter: c.painter, color: c.color, size: (c.size ?? 68) * SPRITE,
      speed: (c.speed ?? 24) * SPEED, home: c.home ?? null, workplace: c.place ?? null, stall: c.stall ?? 0, likes: c.likes ?? [],
      ...schedule(c.kind, seed, i, c.hours), phase: 0, bubble: null, chatWith: null, chatCooldown: 0, until: 0,
      target: null, path: [], at: null, exit: null, hx: 1, hy: 0, recent: [],
      rank: noise(seed, i, S.rank), sub: (noise(seed, i, S.lane) - 0.5) * 2 * SUB_LANE, hasty: noise(seed, i, S.hasty) < 0.08 };
    i += 1;
    return place(base, seed, hour);
  }));
  return { seed, t: 0, tick: 0, minute, rate, agents: untangle(agents), broadcast: null, weather: { kind: 'clear', tempC: 28 } };
}

/** Where an animal likes to be: in the pond, or somewhere along the ways near its home. */
function haunt(a, r1, r2) {
  const home = findPlace(a.home);
  if (home.pond) {
    const { cx, cy, rx, ry } = home.pond;
    const angle = r1 * Math.PI * 2;
    return { pond: true, x: cx + Math.cos(angle) * rx * 0.75 * r2, y: cy + Math.sin(angle) * ry * 0.7 * r2 };
  }
  const near = nodesNear(NODES[home.entry], 90);
  const id = near.length ? near[Math.floor(r1 * near.length)] : home.entry;
  return { node: id, x: NODES[id].x, y: NODES[id].y };
}

/** Riders scattered on the road at the start must not sit on top of each other: the ones that would wait off the map. */
function untangle(agents) {
  const parked = new Set();
  const lanes = new Map();
  for (const a of agents) {
    if (a.kind !== 'vehicle' || a.state !== 'drive') continue;
    const key = `${a.dir}:${Math.round((a.sub ?? 0) / SUB_LANE)}`;
    lanes.set(key, [...(lanes.get(key) ?? []), a]);
  }
  for (const list of lanes.values()) {
    let last = null;
    for (const a of [...list].sort((p, q) => p.s - q.s)) {
      if (last && a.s - last.s < (a.size + last.size) * 0.45 + FOLLOW_GAP) parked.add(a.i);
      else last = a;
    }
  }
  return parked.size === 0 ? agents : agents.map((a) => (parked.has(a.i) ? { ...a, state: 'away', until: 0 } : a));
}

/** Where an agent starts the day (or the night). */
function place(a, seed, hour) {
  const r = (k) => noise(seed, a.i, S.start, k);
  if (a.kind === 'vehicle') {
    const dir = r(1) < 0.5 ? 1 : -1;
    const on = { ...a, dir, ...ride(ROAD_END + r(2) * (ROAD_LENGTH - 2 * ROAD_END), dir, a.sub) };
    return onTheRoad(a, hour) ? { ...on, state: 'drive' } : { ...on, state: 'away', until: 0 };
  }
  if (a.kind === 'flyer') return { ...a, state: 'fly', dir: r(3) < 0.5 ? 1 : -1, x: r(4) * MAP.w, y: r(5) * MAP.h };
  if (a.kind === 'stray') {
    const id = Math.floor(r(4) * NODES.length) % NODES.length;
    return { ...a, state: 'stay', dir: r(3) < 0.5 ? 1 : -1, x: NODES[id].x, y: NODES[id].y, at: id, until: 0 };
  }
  if (a.kind === 'animal') {
    const spot = haunt(a, r(1), r(2));
    return { ...a, state: 'stay', dir: r(3) < 0.5 ? 1 : -1, x: spot.x, y: spot.y, at: spot.node ?? null, until: 0 };
  }
  const home = findPlace(a.home);
  const outside = { entry: home.entry, door: home.door };
  if (!awake(a, hour)) return { ...a, state: 'inside', dir: 1, x: home.door.x, y: home.door.y, exit: outside };
  if (a.kind === 'keeper' && isOpen(findPlace(a.workplace), hour)) {
    const target = keeperTarget(a);
    return { ...a, state: 'stay', dir: -1, x: target.point.x, y: target.point.y, exit: target, target, until: Infinity };
  }
  const id = Math.floor(r(4) * NODES.length) % NODES.length;
  return { ...a, state: 'walk', dir: r(1) < 0.5 ? 1 : -1, x: NODES[id].x, y: NODES[id].y, at: id };
}

const ride = (s, dir, sub = 0) => ({ s, ...onRoad(s, (dir > 0 ? LANE : -LANE) + sub) });

/** How busy the road is, 0..1: the morning and evening rush, lunch, quiet nights. */
export function trafficAt(hour) {
  const peak = (h, at, width) => Math.max(0, 1 - Math.abs(h - at) / width);
  return Math.min(1, 0.04 + 0.3 * peak(hour, 12, 6.5) + 0.8 * peak(hour, 7.4, 1.4) + 0.8 * peak(hour, 17.4, 1.5) + 0.2 * peak(hour, 20, 2.5));
}
/** Is this rider out at this hour? The busier the hour, the more of them are. */
const onTheRoad = (a, hour) => a.rank < trafficAt(hour);

export function stepWorld(world, dt = STEP_MS) {
  const t = world.t + dt;
  const rate = world.rate ?? MINUTES_PER_SECOND;
  const minute = world.minute + (dt / 1000) * rate;
  const tick = world.tick + 1;
  const env = { seed: world.seed, t, dt, tick, rate, hour: hourOf(minute), claims: claimedSpots(world.agents),
    ahead: gapsAhead(world.agents), entering: new Set(), weather: world.weather?.kind ?? 'clear' };
  // Agents decide one after another so two of them never grab the same stool in the same step.
  const agents = world.agents.map((a) => expireBubble(updateAgent(a, env), t));
  return { ...world, t, minute, tick, agents: bumps(meet(agents, env), env), broadcast: loudspeaker(world.broadcast, minute, env) };
}

/** The xóm's weather (from the server): { kind: 'clear' | 'cloudy' | 'fog' | 'rain' | 'storm' | 'hot' | 'cold', tempC }. Pure. */
export function setWeather(world, weather) {
  const kind = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'hot', 'cold'].includes(weather?.kind) ? weather.kind : 'clear';
  const tempC = Number.isFinite(weather?.tempC) ? weather.tempC : world.weather?.tempC ?? 28;
  return world.weather?.kind === kind && world.weather?.tempC === tempC ? world : { ...world, weather: { kind, tempC } };
}
const rainy = (env) => env.weather === 'rain' || env.weather === 'storm';

/** For every rider on the road: the free road in front of them in their own sub-lane (from the last step). */
function gapsAhead(agents) {
  const lanes = new Map();
  for (const a of agents) {
    if (a.kind !== 'vehicle' || (a.state !== 'drive' && a.state !== 'bump')) continue;
    const key = `${a.dir}:${Math.round((a.sub ?? 0) / SUB_LANE)}`;
    lanes.set(key, [...(lanes.get(key) ?? []), a]);
  }
  const gaps = new Map();
  // how much free road there is at the end where riders come in, per sub-lane (key 'entry:dir:lane')
  for (const [key, list] of lanes) {
    const dir = Number(key.split(':')[0]);
    const room = Math.min(...list.map((a) => (dir > 0 ? a.s : ROAD_LENGTH - a.s)));
    gaps.set(`entry:${key}`, room);
  }
  for (const list of lanes.values()) {
    const order = [...list].sort((p, q) => (p.s - q.s) * p.dir); // from the back of the queue to the front
    for (let k = 0; k < order.length - 1; k += 1) {
      const me = order[k];
      const front = order[k + 1];
      gaps.set(me.i, { gap: Math.abs(front.s - me.s) - (me.size + front.size) * 0.45, front: front.i });
    }
  }
  return gaps;
}

/** Two riders who touch: both stop and have words, then carry on. Visual only, nobody is hurt. */
function bumps(agents, env) {
  const hits = new Map();
  for (const a of agents) {
    if (a.kind !== 'vehicle' || a.state !== 'drive' || hits.has(a.i)) continue;
    const ahead = env.ahead.get(a.i);
    if (!ahead || ahead.gap > 1.5 || hits.has(ahead.front)) continue;
    const b = agents[ahead.front];
    if (b.state !== 'drive' || env.t < a.chatCooldown || env.t < b.chatCooldown) continue; // just had words: not again so soon
    if (noise(env.seed, a.i, b.i, env.tick, S.bump) >= BUMP_CHANCE) continue;
    const [opener, reply] = freshPair(TRAFFIC_QUARRELS, a, b, noise(env.seed, a.i, b.i, env.tick, S.greet));
    const until = env.t + 4500 + noise(env.seed, b.i, a.i, env.tick, S.stay) * 3000;
    hits.set(a.i, remember(say({ ...a, state: 'bump', until }, opener, env, 0, 2600, true), opener));
    hits.set(b.i, remember(say({ ...b, state: 'bump', until }, reply, env, 1300, 2600, true), reply));
  }
  return hits.size === 0 ? agents : agents.map((a) => hits.get(a.i) ?? a);
}

function claimedSpots(agents) {
  const taken = new Set();
  for (const a of agents) if (a.target?.placeId && a.target.spot !== null && a.target.spot !== undefined) taken.add(`${a.target.placeId}:${a.target.spot}`);
  return taken;
}

const expireBubble = (a, t) => (a.bubble && t > a.bubble.until ? { ...a, bubble: null } : a);
const say = (a, text, env, delay = 0, ms = 3200, angry = false) => ({ ...a, bubble: { text, from: env.t + delay, until: env.t + delay + ms, angry } });
const LINES_BY_CAST = new Map(CAST.map((c) => [c.id, c.lines]));
const linesOf = (a) => LINES_BY_CAST.get(a.castId) ?? [];
/** Now and then, out of the blue: a line of their own. `perSecond` is the expected rate. */
function chatter(a, env, perSecond) {
  if (a.bubble || linesOf(a).length === 0 || noise(env.seed, a.i, env.tick, S.say) >= perSecond * (env.dt / 1000)) return a;
  const text = pickLine(a, env);
  return text ? { ...say(a, text, env), recent: [...(a.recent ?? []), text].slice(-RECENT) } : a;
}

/** The pools someone draws a line from right now, with weights. */
function poolsFor(a, env) {
  if (a.kind === 'animal') return [[linesOf(a), 1]];
  const pools = [[linesOf(a), a.kind === 'vehicle' ? 3 : 4]];
  if (a.kind === 'vehicle') {
    if (a.state === 'drive' && (env.ahead.get(a.i)?.gap ?? Infinity) < FOLLOW_GAP + 2) pools.push([HONKS, 6]);
    pools.push([ANYTIME, 1]);
  } else {
    pools.push([ANYTIME, 2], [BY_HOUR[partOfDay(env.hour)], 3]);
    const here = a.state === 'stay' ? a.target?.placeId : null;
    const place = here?.startsWith('quanCoc') ? 'quanCoc' : here;
    if (place && BY_PLACE[place]) pools.push([BY_PLACE[place], 4]);
  }
  const weather = env.weather === 'storm' ? 'rain' : env.weather;
  if (BY_WEATHER[weather]) pools.push([BY_WEATHER[weather], 3]);
  pools.push([MEMES, YOUNG_KINDS.has(a.kind) || a.castId === 'thanhNien' ? 3 : 0.4]);
  return pools.filter(([list]) => list && list.length > 0);
}

/** Remember a line just said (so it is not said again soon). */
const remember = (a, text) => ({ ...a, recent: [...(a.recent ?? []), text].slice(-RECENT) });

/** An exchange neither of the two has just used, starting from the rolled one. */
function freshPair(pairs, p, q, roll) {
  const start = Math.floor(roll * pairs.length);
  for (let k = 0; k < pairs.length; k += 1) {
    const [opener, reply] = pairs[(start + k) % pairs.length];
    if (!(p.recent ?? []).includes(opener) && !(q.recent ?? []).includes(reply)) return [opener, reply];
  }
  return pairs[start % pairs.length];
}

/** A line from the weighted pools, not one this person said lately. Deterministic. */
function pickLine(a, env) {
  const pools = poolsFor(a, env);
  const total = pools.reduce((n, [, w]) => n + w, 0);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let roll = noise(env.seed, a.i, env.tick, S.pool, attempt) * total;
    const [list] = pools.find(([, w]) => (roll -= w) < 0) ?? pools[0];
    const text = pickWith(list, noise(env.seed, a.i, env.tick, S.line, attempt));
    if (!(a.recent ?? []).includes(text)) return text;
  }
  return null;
}

function updateAgent(a, env) {
  if (a.state === 'gone') return a; // a visitor who has left (kept so indices stay put)
  if (a.state === 'chat') return env.t >= a.until ? { ...a, state: 'walk', chatWith: null, chatCooldown: env.t + CHAT_COOLDOWN_MS } : a;
  if (a.kind === 'vehicle') return drive(a, env);
  if (a.kind === 'animal') return potter(a, env);
  if (a.kind === 'stray') return roam(a, env);
  if (a.kind === 'flyer') return fly(a, env);
  if (!awake(a, env.hour)) return goHome(a, env);
  if (a.state === 'inside') return leaveHome(a, env);
  if (a.state === 'walk') return walk(a, env);
  return stay(a, env);
}

// ---------------- getting about ----------------

/**
 * The points to walk from where the agent is to the target, along the ways:
 * finish the leg to the next corner if under way; off the ways (at a seat, a door, home), first go back
 * out the way it came in; then the shortest route; then the door and the seat at the other end.
 */
function travel(a, target) {
  const next = a.path.findIndex((p) => p.n >= 0);
  let prefix;
  let from;
  if (next >= 0) {
    prefix = a.path.slice(0, next + 1);
    from = a.path[next].n;
  } else if (a.at !== null) {
    prefix = [];
    from = a.at;
  } else {
    const back = a.exit ?? a.target ?? { entry: nearestNode(a), door: null };
    prefix = [...(back.door ? [pt(back.door)] : []), nodePt(back.entry)];
    from = back.entry;
  }
  const legs = [...prefix, ...routeNodes(from, target.entry).slice(1).map(nodePt), ...(target.door ? [pt(target.door)] : [])];
  const last = legs[legs.length - 1] ?? { x: a.x, y: a.y };
  return last.x === target.point.x && last.y === target.point.y ? legs : [...legs, pt(target.point)];
}

const setOff = (a, target) => ({ ...a, state: 'walk', target, path: travel(a, target), exit: null });

/** Move along the path; a step may turn several corners. The heading eases round corners for drawing. */
function advance(a, env) {
  let { x, y, dir, at, hx, hy } = a;
  let budget = a.speed * (env.dt / 1000);
  const path = [...a.path];
  while (path.length > 0 && budget > 0) {
    const [next] = path;
    const dx = next.x - x;
    const dy = next.y - y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      if (Math.abs(dx) > 0.01) dir = Math.sign(dx);
      hx += (dx / d - hx) * 0.25;
      hy += (dy / d - hy) * 0.25;
    }
    if (d <= budget) { x = next.x; y = next.y; budget -= d; at = next.n >= 0 ? next.n : null; path.shift(); continue; }
    x += (dx / d) * budget;
    y += (dy / d) * budget;
    budget = 0;
  }
  const len = Math.hypot(hx, hy) || 1;
  return { ...a, x, y, dir, at, path, hx: hx / len, hy: hy / len, phase: a.phase + (env.dt / 1000) * (6 + a.speed / 2) };
}

// ---------------- people ----------------

function leaveHome(a, env) {
  if (a.kind === 'keeper' && !isOpen(findPlace(a.workplace), env.hour)) return a; // nothing to open up yet
  if (env.t < a.until) return a; // home for a while (lunch, a rest, the rain)
  if (noise(env.seed, a.i, env.tick, S.exit) > (rainy(env) && a.kind !== 'keeper' ? 0.003 : 0.02)) return a; // fewer go out in the rain
  return setOff(a, nextTarget(a, env));
}

function goHome(a, env) {
  if (a.state === 'inside') return a;
  const heading = a.target?.home && a.state === 'walk' ? a : setOff(a, homeTarget(a));
  return walk(heading, env);
}

function walk(a, env) {
  const ready = a.target ? a : setOff(a, nextTarget(a, env));
  if (ready.path.length === 0) return arrive(ready, env);
  const moved = advance(ready, env);
  if (moved.path.length === 0) return arrive(moved, env);
  if (a.kind === 'vendor' && !ready.target.home && noise(env.seed, a.i, env.tick, S.pause) < env.dt / 1000 / 14) {
    const fresh = linesOf(a).filter((l) => !(a.recent ?? []).slice(-1).includes(l));
    const call = pickWith(fresh.length ? fresh : linesOf(a), noise(env.seed, a.i, env.tick, S.line));
    return { ...say({ ...moved, state: 'stay', until: env.t + 4000 + noise(env.seed, a.i, env.tick, S.stay) * 4000 }, call, env),
      recent: [...(a.recent ?? []), call].slice(-RECENT) };
  }
  return chatter(moved, env, a.kind === 'kid' ? 1 / 25 : 1 / 60);
}

function arrive(a, env) {
  const { target } = a;
  const exit = a.at === null ? { entry: target.entry, door: target.door } : null;
  if (target.home) {
    const r = noise(env.seed, a.i, env.tick, S.stay, 2);
    const rest = rainy(env) ? 90000 + r * 150000 : 30000 + r * 90000; // ms; it rains, they stay in longer
    return { ...a, state: 'inside', target: null, path: [], bubble: null, exit, until: env.t + rest };
  }
  if (a.kind === 'vendor') return setOff(a, nextTarget(a, env)); // on to the next corner of the xóm
  if (a.kind === 'keeper' && target.placeId === a.workplace) return { ...a, state: 'stay', until: Infinity, exit };
  const visit = (a.kind === 'kid' ? 10000 : 20000) + noise(env.seed, a.i, env.tick, S.stay) * 40000;
  return { ...a, state: 'stay', until: env.t + visit, exit };
}

function stay(a, env) {
  if (a.kind === 'keeper') {
    if (!isOpen(findPlace(a.workplace), env.hour)) return goHome(a, env); // closing time
    return chatter(a, env, 1 / 28);
  }
  if (env.t < a.until) return chatter(a, env, a.kind === 'vendor' ? 0 : 1 / 45);
  if (a.kind === 'vendor') return { ...a, state: 'walk' };
  return setOff(a, nextTarget(a, env));
}

function keeperTarget(a) {
  const shop = findPlace(a.workplace);
  const point = keeperSpot(shop, a.stall);
  return { placeId: shop.id, spot: null, entry: shop.keeperAt ? nearestNode(point) : shop.entry, door: shop.keeperAt ? null : shop.door, point };
}

/** Where to go next: a keeper to work, a vendor anywhere, anyone else to a place they like that is open. */
function nextTarget(a, env) {
  const r = (k) => noise(env.seed, a.i, env.tick, S.target, k);
  if (a.kind === 'vendor') return toNode(pickWith(ENTRIES, r(1)));
  if (a.kind === 'keeper') return isOpen(findPlace(a.workplace), env.hour) ? keeperTarget(a) : homeTarget(a);
  const here = a.target?.placeId;
  if (a.kind === 'walker' || a.kind === 'kid') { // now and then home: for lunch, out of the rain, for a rest
    const lunch = env.hour >= 11 && env.hour < 13.5;
    if (r(7) < (rainy(env) ? 0.6 : lunch ? 0.3 : 0.1)) return homeTarget(a);
  }
  const hot = env.weather === 'hot' ? ['ao', 'ao', 'che', 'traDa'] : [];
  const likes = a.kind === 'walker' || a.kind === 'kid' || a.kind === 'guest' ? [...a.likes, ...QUAN_COC, ...hot] : a.likes;
  const options = likes.map(findPlace).filter((p) => p && p.id !== here && isOpen(p, env.hour));
  if (options.length === 0 || r(2) < 0.15) return toNode(Math.floor(r(3) * NODES.length) % NODES.length);
  return claimSpot(pickWith(options, r(5)), a, env);
}

function claimSpot(placeTo, a, env) {
  const free = placeTo.spots.map((_, k) => k).filter((k) => !env.claims.has(`${placeTo.id}:${k}`));
  if (free.length === 0) return { ...toNode(placeTo.entry), placeId: placeTo.id };
  const k = pickWith(free, noise(env.seed, a.i, env.tick, S.spot));
  env.claims.add(`${placeTo.id}:${k}`); // this step's own scratch set: later agents see the claim
  const seat = placeTo.spots[k];
  const fromWay = seat.entry !== undefined; // open places: each seat has its own way in
  return { placeId: placeTo.id, spot: k, entry: fromWay ? seat.entry : placeTo.entry, door: fromWay ? null : placeTo.door, point: { x: seat.x, y: seat.y } };
}

// ---------------- vehicles and animals ----------------

function drive(a, env) {
  if (a.state === 'bump') return env.t >= a.until ? { ...a, state: 'drive', chatCooldown: env.t + CHAT_COOLDOWN_MS } : a;
  if (a.state === 'away') {
    if (env.t < a.until) return a;
    if (!onTheRoad(a, env.hour)) return { ...a, until: env.t + 20000 + noise(env.seed, a.i, env.tick, S.away) * 20000 }; // not now
    const dir = noise(env.seed, a.i, env.tick, S.dir) < 0.5 ? 1 : -1;
    const lane = `${dir}:${Math.round((a.sub ?? 0) / SUB_LANE)}`;
    const room = env.ahead.get(`entry:${lane}`) ?? Infinity;
    if (room < a.size * 1.2 || env.entering.has(lane)) return { ...a, until: env.t + 1500 }; // no room at the edge yet
    env.entering.add(lane); // this step's scratch set: one rider comes in per lane per step
    return { ...a, state: 'drive', dir, ...ride(dir > 0 ? 0 : ROAD_LENGTH, dir, a.sub) };
  }
  // Keep a gap to the rider in front (the hasty ones cut it fine): a queue forms when the road is full.
  const gap = env.ahead.get(a.i)?.gap ?? Infinity;
  const keep = a.hasty ? 0 : FOLLOW_GAP;
  const pace = Math.max(0, Math.min(1, (gap - keep) / FOLLOW_SPAN));
  const s = a.s + a.dir * a.speed * pace * (env.dt / 1000);
  if (s < 0 || s > ROAD_LENGTH) {
    const r = noise(env.seed, a.i, env.tick, S.away);
    const wait = onTheRoad(a, env.hour) ? 3000 + r * 15000 : 20000 + r * 20000;
    return { ...a, state: 'away', ...ride(Math.max(0, Math.min(ROAD_LENGTH, s)), a.dir, a.sub), until: env.t + wait, bubble: null };
  }
  const moving = pace > 0.05;
  return chatter({ ...a, ...ride(s, a.dir, a.sub), phase: a.phase + (moving ? (env.dt / 1000) * (4 + a.speed / 4) : 0) }, env, moving ? 1 / 40 : 1 / 12);
}


function potter(a, env) {
  const night = env.hour >= 21.5 || env.hour < 5.5;
  if (night && a.state === 'stay') return a; // curled up near home until morning
  if (a.state === 'walk') {
    const moved = advance(a, env);
    if (moved.path.length > 0) return moved;
    return { ...moved, state: 'stay', until: env.t + 3000 + noise(env.seed, a.i, env.tick, S.stay) * 9000 };
  }
  if (env.t < a.until) return chatter(a, env, 1 / 50);
  const spot = haunt(a, noise(env.seed, a.i, env.tick, S.wander), noise(env.seed, a.i, env.tick, S.walk));
  if (spot.pond) return { ...a, state: 'walk', path: [pt(spot)] }; // ducks just swim there
  return { ...a, state: 'walk', path: travel(a, toNode(spot.node)) };
}

/** Helicopters, dragons and Lạc birds: straight across the sky to anywhere, sometimes off the map and back. */
function fly(a, env) {
  const moved = a.path.length ? advance(a, env) : a;
  if (moved.path.length > 0) return chatter(moved, env, 1 / 60);
  const r = (k) => noise(env.seed, a.i, env.tick, S.wander, k);
  const far = r(1) < 0.3; // now and then fly out over the paddies
  const to = { x: far ? (r(2) < 0.5 ? -80 : MAP.w + 80) : r(2) * MAP.w, y: r(3) * MAP.h };
  return { ...moved, state: 'fly', path: [pt(to)] };
}

/** Visitors from Đua Vịt: from any corner of the xóm to any other, a short rest, and off again. */
function roam(a, env) {
  const night = env.hour >= 22.5 || env.hour < 5;
  if (night && a.state === 'stay') return a; // even visitors sleep a little
  if (a.state === 'walk') {
    const moved = advance(a, env);
    if (moved.path.length > 0) return moved;
    return { ...moved, state: 'stay', until: env.t + 2000 + noise(env.seed, a.i, env.tick, S.stay) * 8000 };
  }
  if (env.t < a.until) return chatter(a, env, 1 / 40);
  const id = Math.floor(noise(env.seed, a.i, env.tick, S.wander) * NODES.length) % NODES.length;
  return { ...a, state: 'walk', path: travel(a, toNode(id)) };
}

// ---------------- meeting people ----------------

/** Two people passing each other may stop for small talk: a greeting, then the answer. */
function meet(agents, env) {
  const chatting = new Map();
  const free = agents.filter((a) => PEOPLE.includes(a.kind) && a.state === 'walk' && !a.target?.home && env.t >= a.chatCooldown);
  // With a thousand people about, only compare neighbours: a grid of CHAT_RANGE-sized cells.
  const cells = new Map();
  const cellOf = (a) => `${Math.floor(a.x / CHAT_RANGE)},${Math.floor(a.y / CHAT_RANGE)}`;
  free.forEach((a, k) => { const key = cellOf(a); cells.set(key, [...(cells.get(key) ?? []), k]); });
  for (let x = 0; x < free.length; x += 1) {
    const p = free[x];
    const [cx, cy] = [Math.floor(p.x / CHAT_RANGE), Math.floor(p.y / CHAT_RANGE)];
    const near = [];
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gy = cy - 1; gy <= cy + 1; gy += 1) near.push(...(cells.get(`${gx},${gy}`) ?? []));
    for (const y of near.filter((k) => k > x).sort((a, b) => a - b)) {
      const q = free[y];
      if (chatting.has(p.i) || chatting.has(q.i) || Math.hypot(p.x - q.x, p.y - q.y) > CHAT_RANGE) continue;
      if (noise(env.seed, p.i, q.i, env.tick, S.meet) >= CHAT_CHANCE) continue;
      const angry = noise(env.seed, p.i, q.i, env.tick, S.quarrel) < 0.25; // they bumped into each other
      const [opener, reply] = freshPair(angry ? ALL_QUARRELS : ALL_GREETINGS, p, q, noise(env.seed, p.i, q.i, env.tick, S.greet));
      const until = env.t + (angry ? 5000 : 3500) + noise(env.seed, q.i, p.i, env.tick, S.stay) * 2500;
      const face = Math.sign(q.x - p.x) || 1;
      chatting.set(p.i, remember(say({ ...p, state: 'chat', chatWith: q.i, until, dir: face }, opener, env, 0, angry ? 2800 : 2200, angry), opener));
      chatting.set(q.i, remember(say({ ...q, state: 'chat', chatWith: p.i, until, dir: -face }, reply, env, 1500, angry ? 2800 : 2200, angry), reply));
    }
  }
  return chatting.size === 0 ? agents : agents.map((a) => chatting.get(a.i) ?? a);
}

/** The ward loudspeaker: a few announcements at six in the morning and five in the afternoon. */
function loudspeaker(current, minute, env) {
  const dayMinute = ((minute % DAY) + DAY) % DAY;
  const onAir = (dayMinute >= 360 && dayMinute < 366) || (dayMinute >= 1020 && dayMinute < 1026);
  if (!onAir) return current && env.t <= current.until ? current : null;
  if (current && env.t <= current.until) return current;
  const day = Math.floor(minute / DAY);
  return { text: pickWith(LOA_PHUONG, noise(env.seed, day, Math.floor(dayMinute), S.loa)), until: env.t + 6000 };
}

// ---------------- visitors (people watching the page who came home to the xóm) ----------------

/** A visitor's character: a neighbour with their name and chosen look, stepping out of a house in the xóm. */
function guestAgent(guest, i, world) {
  const c = findCast(lookById(guest.look)?.castId) ?? findCast('diCho');
  const home = findPlace(`nha${1 + (Math.abs(salt(guest.id)) % 80)}`) ?? findPlace('nha1');
  return { i, castId: c.id, kind: 'guest', guestId: guest.id, name: guest.name, painter: c.painter, color: c.color,
    size: (c.size ?? 68) * SPRITE, speed: 26 * SPEED, home: home.id, workplace: null, stall: 0, likes: GUEST_LIKES,
    ...schedule('guest', world.seed, i), phase: 0, bubble: null, chatWith: null, chatCooldown: 0, until: 0,
    target: null, path: [], at: null, exit: { entry: home.entry, door: home.door }, hx: 1, hy: 0,
    state: 'walk', dir: 1, x: home.door.x, y: home.door.y };
}

/**
 * Bring the world's visitors in line with the list the server sends: newcomers step out of a house, those
 * who left are marked gone (never removed, so every index stays valid), renamed ones change. Pure.
 */
export function syncGuests(world, list) {
  const wanted = new Map(list.map((g) => [g.id, g]));
  let changed = false;
  const agents = world.agents.map((a) => {
    if (a.kind !== 'guest' || a.state === 'gone') return a;
    const g = wanted.get(a.guestId);
    if (!g) { changed = true; return { ...a, state: 'gone', target: null, path: [], bubble: null, chatWith: null }; }
    const c = findCast(lookById(g.look)?.castId);
    if (g.name === a.name && (!c || c.id === a.castId)) return a;
    changed = true;
    return { ...a, name: g.name, ...(c ? { castId: c.id, painter: c.painter, color: c.color, size: (c.size ?? 68) * SPRITE } : {}) };
  });
  const here = new Set(agents.filter((a) => a.kind === 'guest' && a.state !== 'gone').map((a) => a.guestId));
  const added = list.filter((g) => !here.has(g.id)).map((g, k) => guestAgent(g, agents.length + k, world));
  return changed || added.length ? { ...world, agents: [...agents, ...added] } : world;
}

// ---------------- the train ----------------

const TRAINS = [5.5, 8.2, 11.6, 14.3, 17.1, 19.8, 22.4]; // hours it passes, alternating directions
const TRAIN_SPEED = 130; // map units per game minute
export const TRAIN_LENGTH = 300;

/** Where the train is at a moment, or null. A pure function of the clock: nothing to simulate. */
export function trainAt(minute) {
  const hour = hourOf(minute);
  for (let k = 0; k < TRAINS.length; k += 1) {
    const since = (hour - TRAINS[k]) * 60;
    const span = (MAP.w + TRAIN_LENGTH * 2) / TRAIN_SPEED;
    if (since < 0 || since > span) continue;
    const dir = k % 2 ? -1 : 1;
    const travelled = since * TRAIN_SPEED - TRAIN_LENGTH;
    return { dir, x: dir > 0 ? travelled : MAP.w - travelled };
  }
  return null;
}
