// The whole xóm seen from above at an angle, like a scroll painting: ground coordinates are drawn as they
// are (x right, y towards the viewer) and everything that stands up is drawn upwards from its base line.
// Ways (the main road's pavements, winding alleys, dead ends, the path round the pond, zebra crossings)
// are hand-drawn curves; together they form a graph that people walk with routeNodes().

export const MAP = { w: 1400, h: 700 };
export const K = 0.35; // side-view facade drawings (duavit scale) shrunk to the map
export const SPRITE = 0.22; // characters, AoE-small: a person is about 15 units, a house 36-68
export const SPEED = 0.7; // cast speeds were written for the old side-on street
export const RAIL_Y = 28;
export const CROSSING_X = 188; // where the alley crosses the railway

/** Catmull-Rom through the knots, sampled about every `step` units: hand-drawn curves. */
export function smooth(knots, step = 10) {
  if (knots.length < 3) return densify(knots, step);
  const pts = [knots[0], ...knots, knots[knots.length - 1]];
  const out = [];
  for (let k = 1; k < pts.length - 2; k += 1) {
    const [p0, p1, p2, p3] = [pts[k - 1], pts[k], pts[k + 1], pts[k + 2]];
    const n = Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let s = 0; s < n; s += 1) {
      const t = s / n;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(knots[knots.length - 1]);
  return out;
}

/** Straight segments cut so no two points are more than `step` apart. */
export function densify(line, step = 10) {
  const out = [line[0]];
  for (let k = 1; k < line.length; k += 1) {
    const [a, b] = [line[k - 1], line[k]];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = 1; s <= n; s += 1) out.push({ x: a.x + ((b.x - a.x) * s) / n, y: a.y + ((b.y - a.y) * s) / n });
  }
  return out;
}

/** The same line moved sideways by d (positive: towards the viewer when the line runs left to right). */
export function offsetLine(line, d) {
  return line.map((p, k) => {
    const a = line[Math.max(0, k - 1)];
    const b = line[Math.min(line.length - 1, k + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}

/** Height of a left-to-right line at x. */
export function yOn(line, x) {
  for (let k = 1; k < line.length; k += 1) {
    const [a, b] = [line[k - 1], line[k]];
    if (x >= a.x && x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }
  return x < line[0].x ? line[0].y : line[line.length - 1].y;
}

const P = (x, y) => ({ x, y });

// ---------------- the main road ----------------

export const ROAD_HALF = 18;
export const ROAD_LINE = smooth([P(-120, 302), P(0, 300), P(300, 284), P(600, 298), P(900, 330), P(1150, 322), P(1400, 292), P(1520, 290)], 10);
const inside = (p) => p.x >= 8 && p.x <= MAP.w - 8;
export const PAVE_N = offsetLine(ROAD_LINE, -26).filter(inside);
export const PAVE_S = offsetLine(ROAD_LINE, 26).filter(inside);

const roadLengths = ROAD_LINE.reduce((acc, p, k) => [...acc, k === 0 ? 0 : acc[k - 1] + Math.hypot(p.x - ROAD_LINE[k - 1].x, p.y - ROAD_LINE[k - 1].y)], []);
export const ROAD_LENGTH = roadLengths[roadLengths.length - 1];
/** A point `s` along the road, moved `side` units sideways (vehicles ride lanes at ±8). */
export function onRoad(s, side = 0) {
  const clamped = Math.max(0, Math.min(ROAD_LENGTH, s));
  let k = roadLengths.findIndex((len) => len >= clamped);
  if (k <= 0) k = 1;
  const [a, b] = [ROAD_LINE[k - 1], ROAD_LINE[k]];
  const seg = roadLengths[k] - roadLengths[k - 1] || 1;
  const t = (clamped - roadLengths[k - 1]) / seg;
  const tx = (b.x - a.x) / seg;
  const ty = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * t - ty * side, y: a.y + (b.y - a.y) * t + tx * side };
}

// ---------------- alleys ----------------

const ALLEYS = [
  // north of the road: up to the level crossing, the long winding ngõ Bắc, the lanes between, dead ends
  [P(150, 270), P(140, 228), P(165, 182), P(152, 138), P(178, 92), P(CROSSING_X, 54)],
  [P(165, 182), P(262, 172), P(380, 192), P(520, 176), P(640, 152), P(780, 164), P(905, 142), P(1050, 158), P(1200, 136), P(1345, 152)],
  [P(690, 268), P(662, 222), P(640, 152)],
  [P(905, 302), P(932, 258), P(906, 212), P(905, 142)],
  [P(1250, 270), P(1232, 234), P(1205, 190), P(1200, 136)],
  [P(380, 192), P(404, 234)],
  [P(780, 164), P(760, 112), P(792, 80)],
  [P(1050, 158), P(1084, 104)],
  [P(262, 172), P(248, 112), P(282, 80)],
  [P(520, 176), P(500, 118), P(540, 84)],
  // south of the road: lanes down to ngõ Nam, the path round the pond, dead ends to the paddies
  [P(60, 326), P(48, 420), P(62, 560)],
  [P(440, 320), P(458, 380), P(430, 440), P(452, 500), P(432, 562)],
  [P(792, 352), P(752, 422), P(800, 490), P(900, 508), P(1000, 480), P(1034, 406), P(1006, 352)],
  [P(900, 508), P(902, 598)],
  [P(1250, 338), P(1272, 400), P(1240, 470), P(1262, 594)],
  [P(62, 560), P(200, 578), P(330, 556), P(432, 562), P(560, 594), P(700, 572), P(902, 598), P(1050, 602), P(1150, 582), P(1262, 594), P(1350, 600)],
  [P(330, 556), P(312, 642)],
  [P(700, 572), P(722, 652)],
  [P(1150, 582), P(1132, 662)],
  [P(200, 578), P(186, 652)],
  // more alleys: a middle one in the north-east, one along the paddies, one from the đình to the pond, the east corner
  [P(700, 226), P(820, 212), P(960, 228), P(1100, 206), P(1250, 222), P(1392, 210)],
  [P(14, 652), P(200, 646), P(400, 660), P(600, 646), P(800, 658), P(1000, 646), P(1200, 660), P(1392, 650)],
  [P(452, 500), P(600, 516), P(740, 506), P(800, 490)],
  [P(1034, 470), P(1150, 520), P(1300, 505), P(1392, 520)],
  [P(1272, 400), P(1392, 392)],
  [P(60, 470), P(160, 520), P(300, 526), P(440, 520)],
  // a footpath across the bare ground where the kids play
  [P(282, 80), P(330, 96), P(385, 92), P(440, 98), P(500, 118)],
  // into the open places: the market's aisles, the đình courtyard, the well
  [P(220, 318), P(220, 405), P(220, 505)],
  [P(92, 405), P(392, 405)],
  [P(92, 455), P(392, 455)],
  [P(590, 322), P(592, 398)],
  [P(508, 386), P(682, 386)],
  [P(1100, 348), P(1098, 396)],
];
export const ZEBRAS = [150, 440, 690, 905, 1250];

/** Every walkable way, as a sampled line. */
export const WAYS = [
  { kind: 'pave', line: PAVE_N },
  { kind: 'pave', line: PAVE_S },
  ...ALLEYS.map((knots) => ({ kind: 'alley', line: smooth(knots, 10) })),
  ...ZEBRAS.map((x) => ({ kind: 'zebra', line: densify([P(x, yOn(PAVE_N, x)), P(x, yOn(PAVE_S, x))], 10) })),
];

// ---------------- the walking graph ----------------

const JOIN = 32; // an alley's end joins whatever way passes this close
const CROSS = 8; // two ways whose points come this close cross there

function buildGraph(ways) {
  const nodes = [];
  const links = [];
  const link = (a, b) => {
    const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);
    links[a].push({ to: b, d });
    links[b].push({ to: a, d });
  };
  const owner = [];
  ways.forEach((way, w) => {
    const ids = densify(way.line, 12).map((p) => { nodes.push({ x: p.x, y: p.y }); links.push([]); owner.push(w); return nodes.length - 1; });
    for (let k = 1; k < ids.length; k += 1) link(ids[k - 1], ids[k]);
    way.ends = [ids[0], ids[ids.length - 1]];
  });
  for (const way of ways) {
    for (const end of way.ends) {
      let best = -1;
      let bestD = JOIN;
      nodes.forEach((n, id) => {
        if (owner[id] === owner[end]) return;
        const d = Math.hypot(n.x - nodes[end].x, n.y - nodes[end].y);
        if (d < bestD) { bestD = d; best = id; }
      });
      if (best >= 0) link(end, best);
    }
  }
  // ways that cross in the middle (an aisle across another) meet where their points come close
  for (let a = 0; a < nodes.length; a += 1) {
    for (let b = a + 1; b < nodes.length; b += 1) {
      if (owner[a] !== owner[b] && Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < CROSS && !links[a].some((l) => l.to === b)) link(a, b);
    }
  }
  return { nodes, links };
}

const graph = buildGraph(WAYS.map((w) => ({ ...w })));
export const NODES = graph.nodes;
const LINKS = graph.links;

const CELL = 24;
const grid = new Map();
NODES.forEach((n, id) => {
  const key = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`;
  grid.set(key, [...(grid.get(key) ?? []), id]);
});
/** Node ids within `r` of p (r up to a few cells). */
export function nodesNear(p, r) {
  const out = [];
  const span = Math.ceil(r / CELL);
  const cx = Math.floor(p.x / CELL);
  const cy = Math.floor(p.y / CELL);
  for (let gx = cx - span; gx <= cx + span; gx += 1) {
    for (let gy = cy - span; gy <= cy + span; gy += 1) {
      for (const id of grid.get(`${gx},${gy}`) ?? []) if (Math.hypot(NODES[id].x - p.x, NODES[id].y - p.y) <= r) out.push(id);
    }
  }
  return out;
}

/** The node nearest to p. */
export function nearestNode(p) {
  for (const r of [30, 80, 400, 2000]) {
    const near = nodesNear(p, r);
    if (near.length) return near.reduce((a, b) => (Math.hypot(NODES[a].x - p.x, NODES[a].y - p.y) <= Math.hypot(NODES[b].x - p.x, NODES[b].y - p.y) ? a : b));
  }
  return 0;
}

const routes = new Map();
/** Shortest walk from node a to node b, as node ids (Dijkstra; remembered, the graph never changes). */
export function routeNodes(a, b) {
  const key = `${a}:${b}`;
  if (routes.has(key)) return routes.get(key);
  const dist = new Float64Array(NODES.length).fill(Infinity);
  const prev = new Int32Array(NODES.length).fill(-1);
  const done = new Uint8Array(NODES.length);
  dist[a] = 0;
  const heap = [[0, a]];
  while (heap.length) {
    const [d, u] = popMin(heap);
    if (done[u]) continue;
    done[u] = 1;
    if (u === b) break;
    for (const { to, d: step } of LINKS[u]) {
      if (d + step < dist[to]) { dist[to] = d + step; prev[to] = u; pushHeap(heap, [d + step, to]); }
    }
  }
  const path = [];
  for (let u = b; u !== -1; u = prev[u]) path.unshift(u);
  const found = path[0] === a ? path : [a, b];
  if (routes.size > 20000) routes.clear();
  routes.set(key, found);
  return found;
}

function pushHeap(heap, item) {
  heap.push(item);
  for (let k = heap.length - 1; k > 0;) {
    const up = (k - 1) >> 1;
    if (heap[up][0] <= heap[k][0]) break;
    [heap[up], heap[k]] = [heap[k], heap[up]];
    k = up;
  }
}

function popMin(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    for (let k = 0; ;) {
      const [l, r] = [2 * k + 1, 2 * k + 2];
      let m = k;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === k) break;
      [heap[m], heap[k]] = [heap[k], heap[m]];
      k = m;
    }
  }
  return top;
}

export const MINUTES_PER_SECOND = 1;
export const DAY = 24 * 60;
export const hourOf = (minute) => ((minute % DAY) + DAY) % DAY / 60;
