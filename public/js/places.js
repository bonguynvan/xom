// Every building and gathering place on the map. Shops line the north side of the main road; the open
// places (chợ, đình, ao, giếng, bến xe) sit south of it; tube houses grow along every alley on their own,
// fronts facing the viewer as in a scroll painting. Each place has a door (or, for open places, seats that
// open straight onto the nearest way) and the graph node where its door meets the ways.
import { CROSSING_X, K, MAP, NODES, PAVE_N, PAVE_S, RAIL_Y, ROAD_HALF, ROAD_LINE, nearestNode, nodesNear, yOn } from './map.js';
import { noise } from './rng.js';
import { HEDGE, quanCoc } from './street-life.js';

const DEPTH = 32;
const ROOF_DEPTH = 0.6; // keep in step with buildings.js
const FLOOR = 46; // facade units per floor (buildings.js)
const REACH = 30; // how far a door may be from its way
const YARD = 68; // a house behind an alley stands this far from it: its two-floor roof stays clear
const HOMES = 80; // houses with a name the cast can live in (nha1..nha80; the night vendors live in 29-31)
const COLORS = ['#f0cf6a', '#e9c46a', '#f2d888', '#f0cf6a', '#efe3c2', '#b9d8c8', '#e8b4a0', '#bcd2dc', '#f1ece0', '#e3b75e'];
export const facadeUnits = (floors) => (floors * FLOOR + 16) * K;

const P = (x, y) => ({ x, y });
const sit = (x, y) => ({ x, y, pose: 'sit' });
const stand = (x, y) => ({ x, y, pose: 'stand' });
/** Seats of an open place: each opens onto its own nearest node, so nobody cuts across the place. */
const seats = (list) => list.map((s) => ({ ...s, entry: nearestNode(s) }));
const withDoor = (p, door = P(Math.round(p.x + p.w / 2), p.front + 2)) => ({ ...p, door, entry: nearestNode(door) });

// ---------------- shops along the main road ----------------

/** A shop drawn from its side-view facade: old (duavit-scale) widths and spots shrink by K. */
function shop(id, kind, name, x, oldW, open, oldSpots = [], floors = 2) {
  const w = Math.round(oldW * K);
  const front = Math.round(yOn(PAVE_N, x + w / 2) - 8);
  const seats = oldSpots.map(([dx, depth, pose]) => ({ x: x + dx * K, y: front + (6 + depth * 30) * K, pose }));
  const room = Math.max(3, Math.round(w / 7)); // customers standing about on the pavement
  const crowdAt = Array.from({ length: room }, (_, k) => ({ x: Math.round(x + ((k + 0.5) * w) / room), y: front + 5 + (k % 2) * 3, pose: 'stand' }));
  const spots = [...seats, ...crowdAt];
  const facadeSpots = oldSpots.map(([dx, depth]) => ({ dx, depth })); // where the facade puts its stools
  return withDoor({ id, kind, name, building: true, x, w, front, depth: DEPTH, floors, open, spots, facadeSpots });
}
const sits = (list) => list.map(([dx, depth]) => [dx, depth, 'sit']);

const SHOPS = [
  shop('traDa', 'traDa', 'Trà đá bà Tư', 22, 170, [5.5, 22], sits([[30, 0.25], [62, 0.45], [98, 0.25], [132, 0.45]])),
  shop('suaXe', 'suaXe', 'Sửa xe – Bơm vá', 86, 140, [6, 19], [[40, 0.3, 'sit'], [96, 0.2, 'stand']]),
  shop('tapHoa', 'tapHoa', 'Tạp hóa cô Ba', 162, 150, [6, 21.5], [[40, 0.2, 'stand'], [80, 0.2, 'stand'], [118, 0.2, 'stand']], 3),
  shop('hieuAnh', 'hieuAnh', 'Ảnh màu', 219, 120, [8, 20], [[40, 0.2, 'stand'], [84, 0.2, 'stand']]),
  shop('phone', 'phone', 'Điện thoại công cộng', 265, 60, [0, 24], [[30, 0.1, 'stand']]),
  shop('pho', 'pho', 'Phở', 290, 160, [5.5, 10], sits([[34, 0.25], [70, 0.45], [106, 0.25], [138, 0.45]])),
  shop('catToc', 'catToc', 'Cắt tóc', 350, 120, [7, 18], [[58, 0.4, 'sit'], [96, 0.2, 'stand']]),
  shop('bangDia', 'bangDia', 'Băng đĩa nhạc', 456, 130, [8, 22], [[36, 0.2, 'stand'], [90, 0.4, 'sit']], 3),
  shop('buuDien', 'buuDien', 'Bưu điện', 506, 170, [7, 17], [[50, 0.2, 'stand'], [96, 0.2, 'stand'], [140, 0.2, 'stand']]),
  shop('che', 'che', 'Chè', 570, 130, [9, 22], sits([[36, 0.25], [72, 0.45], [104, 0.25]])),
  shop('hieuMay', 'hieuMay', 'Hiệu may', 620, 130, [7.5, 19], [[50, 0.2, 'stand'], [94, 0.2, 'stand']], 3),
  shop('cayBang', 'cayBang', 'Gốc bàng', 708, 150, [5, 21], [[46, 0.35, 'sit'], [104, 0.35, 'sit']]),
];

/** A tree with a bench (drawn by its facade code, like a shop with no house). */
function treePlace(id, kind, name, x, front, open) {
  const spots = [[46, 0.35], [104, 0.35]].map(([dx, depth]) => sit(x + dx * K, front + (6 + depth * 30) * K));
  return withDoor({ id, kind, name, building: true, x, w: Math.round(150 * K), front, depth: 20, open, spots, facadeSpots: [] });
}

// ---------------- open places south of the road ----------------

const STALLS = [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => P(106 + c * 76, 382 + r * 50)));
const POND = { cx: 900, cy: 418, rx: 92, ry: 56 };

const OPEN = [
  { id: 'cho', kind: 'cho', name: 'Chợ', x: 80, w: 320, y0: 352, y1: 508, open: [5, 11.5], stalls: STALLS, door: P(220, 340),
    keeperAt: STALLS.map((s) => P(s.x, s.y - 4)), spots: seats(STALLS.map((s, k) => stand(s.x + (k % 2 ? 9 : -9), s.y + 12))) },
  { id: 'dinh', kind: 'dinh', name: 'Sân đình', x: 476, w: 230, y0: 340, y1: 440, front: 470, open: [5, 21.5],
    spots: seats([stand(530, 360), stand(560, 372), stand(612, 356), stand(642, 376), stand(676, 362), sit(600, 412), sit(624, 414), stand(560, 410)]) },
  { id: 'ao', kind: 'ao', name: 'Ao làng', x: POND.cx - POND.rx, w: POND.rx * 2, y0: POND.cy - POND.ry, y1: POND.cy + POND.ry, open: [5, 20],
    pond: POND, spots: seats([sit(822, 376), stand(870, 364), sit(952, 372), sit(986, 448)]) },
  { id: 'gieng', kind: 'gieng', name: 'Giếng nước', x: 1080, w: 40, y0: 380, y1: 410, front: 404, open: [5, 20],
    spots: seats([stand(1084, 414), stand(1116, 414)]) },
  { id: 'benXe', kind: 'benXe', name: 'Bến xe lam', x: 1112, w: 90, y0: 352, y1: 376, front: 372, open: [5, 21],
    spots: seats([sit(1126, 368), sit(1146, 369), sit(1166, 368), sit(1186, 369)]) },
  { id: 'sanChoi', kind: 'sanChoi', name: 'Bãi đất trống', x: 300, w: 170, y0: 56, y1: 128, open: [6, 20.5], door: P(385, 92),
    spots: seats([stand(318, 70), stand(350, 86), stand(384, 72), stand(420, 96), stand(452, 78), stand(330, 112), stand(400, 116), stand(446, 114)]) },
  { id: 'chanTau', kind: 'chanTau', name: 'Chắn tàu', x: CROSSING_X + 8, w: 16, y0: 44, y1: 66, front: 64, open: [5, 22],
    keeperAt: [P(CROSSING_X + 14, 70)], spots: [] },
].map((p) => {
  const door = p.door ?? p.keeperAt?.[0] ?? P(p.x + p.w / 2, p.y0);
  return { ...p, door, entry: nearestNode(door) };
});

/** Quán cóc in the alleys: somewhere to sit on a plastic stool. */
const QUAN = [[330, 206], [860, 186], [520, 612], [1110, 612], [1330, 412], [60, 404]]
  .map(([x, y], k) => quanCoc(`quanCoc${k + 1}`, x, y))
  .map((q) => ({ ...q, door: P(q.cx, q.cy), entry: nearestNode(P(q.cx, q.cy)), spots: seats(q.spots) }));
export const QUAN_COC = QUAN.map((q) => q.id);

// ---------------- trees, poles, lamps ----------------

/** Trees that belong to no place: the banyan behind the đình, bamboo by the pond, bananas in the gaps. */
export const TREES = [
  P(470, 344), P(766, 504), P(1046, 470), P(28, 470), P(1330, 470), P(612, 650), P(1010, 662), P(372, 470),
  P(290, 132), P(480, 70), P(478, 134), P(294, 64), P(386, 140),
].map((p, k) => ({ ...p, kind: ['da', 'tre', 'tre', 'chuoi', 'da', 'chuoi', 'chuoi', 'chuoi', 'chuoi', 'tre', 'chuoi', 'tre', 'da'][k] }));
export const POLES = [120, 350, 580, 810, 1040, 1270].map((x) => ({ x, y: Math.round(yOn(PAVE_N, x) + 7), loa: x === 580 }));
export const LAMPS = [
  ...[200, 520, 830, 1180].map((x) => P(x, Math.round(yOn(PAVE_S, x) - 6))),
  P(380, 200), P(905, 150), P(560, 602), P(1050, 610), P(160, 190), P(1200, 144),
];

// ---------------- tube houses, grown along the alleys ----------------

const overlaps = (a, b, m = 3) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const footprint = (p) => ({ x0: p.x, x1: p.x + p.w, y0: p.front - (p.depth ?? DEPTH), y1: p.front });

/** Places a house must keep clear of: shops, open places, the pond, trees, the railway. */
function obstacles() {
  return [
    ...SHOPS.map(footprint),
    ...CIVIC_PLACES.map(footprint),
    ...TREE_PLACES.map((t) => ({ x0: t.x - 8, x1: t.x + t.w + 8, y0: t.front - 30, y1: t.front })),
    ...QUAN.map((q) => ({ x0: q.x - 4, x1: q.x + q.w + 4, y0: q.y0 - 4, y1: q.y1 + 4 })),
    ...HEDGE.map((t) => ({ x0: t.x - 14, x1: t.x + 14, y0: t.y - 10, y1: t.y + 4 })),
    ...OPEN.map((p) => ({ x0: p.x - 6, x1: p.x + p.w + 6, y0: p.y0 - 6, y1: (p.front ?? p.y1) + 6 })),
    ...TREES.map((t) => ({ x0: t.x - 18, x1: t.x + 18, y0: t.y - 12, y1: t.y + 4 })),
    { x0: 0, x1: MAP.w, y0: 0, y1: RAIL_Y + 22 },
    ...ROAD_LINE.map((p) => ({ x0: p.x - 6, x1: p.x + 6, y0: p.y - ROAD_HALF - 10, y1: p.y + ROAD_HALF + 10 })), // nobody builds on the road
  ];
}

/** The tallest a house may be without its roof hiding a way behind it (at least two floors). */
function floorsFor(x, w, front, wish) {
  for (let f = wish; f > 2; f -= 1) {
    const top = front - DEPTH * ROOF_DEPTH - facadeUnits(f);
    const hidden = nodesNear(P(x + w / 2, (top + front) / 2), (front - top) / 2 + w).some((id) => {
      const n = NODES[id];
      return n.x > x - 4 && n.x < x + w + 4 && n.y > top - 6 && n.y < front - DEPTH;
    });
    if (!hidden) return f;
  }
  return 2;
}

/** Sweep the map and put a house wherever a way runs just in front of free ground. */
function growHouses() {
  const taken = obstacles();
  const houses = [];
  for (let front = 70; front <= MAP.h - 8; front += 4) {
    for (let x = 12; x < MAP.w - 40;) {
      const w = 34 + Math.floor(noise(x, front, 1) * 22);
      const box = { x0: x, x1: x + w, y0: front - DEPTH, y1: front };
      const cx = x + w / 2;
      // the door opens onto a way just in front of the house, or (set back behind a yard) one behind it;
      // cheap tests first, they reject most of the map
      const inFront = nodesNear(P(cx, front + 2), REACH).some((id) => NODES[id].y >= front - 4);
      const behind = !inFront && nodesNear(P(cx, front - YARD), 14).some((id) => NODES[id].y <= front - YARD + 6);
      const fits = (inFront || behind) && x + w <= MAP.w - 12
        && nodesNear(P(x + w / 2, front - DEPTH / 2), w).every((id) => !overlaps({ x0: NODES[id].x, x1: NODES[id].x, y0: NODES[id].y, y1: NODES[id].y }, box, 6))
        && taken.every((t) => !overlaps(t, box));
      if (!fits) { x += 4; continue; }
      const wish = 2 + Math.floor(noise(x, front, 2) * 3);
      const house = { id: `h${houses.length}`, kind: 'house', building: true, x, w, front, depth: DEPTH,
        floors: floorsFor(x, w, front, wish), color: COLORS[Math.floor(noise(x, front, 3) * COLORS.length)], spots: [] };
      houses.push(withDoor(house, inFront ? P(Math.round(cx), front + 2) : P(Math.round(cx), front - DEPTH - 2)));
      taken.push(box);
      x += w + 3;
    }
  }
  return houses;
}

/** The named homes of the cast, spread over the xóm (the rest are neighbours we never meet). */
function nameHomes(houses) {
  const named = new Map();
  for (let k = 1; k <= HOMES; k += 1) named.set(Math.floor(((k - 0.5) * houses.length) / HOMES), `nha${k}`);
  return houses.map((h, i) => (named.has(i) ? { ...h, id: named.get(i) } : h));
}

// ---------------- public buildings ----------------

/** A school, clinic or office standing where a few houses would have been (the houses grow round it). */
function civic(id, name, x, w, front, wish, open, roof) {
  const room = Math.max(3, Math.round(w / 9)); // people standing about at the door
  const spots = Array.from({ length: room }, (_, k) => stand(Math.round(x + ((k + 0.5) * w) / room), front + 5 + (k % 2) * 3));
  return withDoor({ id, kind: id, name, building: true, civic: true, x, w, front, depth: DEPTH, floors: floorsFor(x, w, front, wish),
    open, roof, spots, facadeSpots: [] });
}
const CIVIC_PLACES = [
  civic('truong', 'Trường tiểu học', 1214, 164, 190, 2, [6.5, 17.5], 'tile'),
  civic('tramYTe', 'Trạm y tế phường', 595, 102, 122, 2, [7, 17], 'flat'),
  civic('uyBan', 'UBND phường', 938, 91, 274, 3, [7.5, 17], 'flat'),
];

/** @type {Array<object>} */
const TREE_PLACES = [treePlace('cayPhuong', 'cayPhuong', 'Gốc phượng', 600, 574, [5, 21])];

export const PLACES = [...SHOPS, ...OPEN, ...TREE_PLACES, ...QUAN, ...CIVIC_PLACES, ...nameHomes(growHouses())];

export const findPlace = (id) => PLACES.find((p) => p.id === id) ?? null;
export const isOpen = (place, hour) => !place.open || (hour >= place.open[0] && hour < place.open[1]);
/** Where keeper number n of a place stands while minding it. */
export const keeperSpot = (place, n = 0) => place.keeperAt?.[n % place.keeperAt.length] ?? P(place.x + place.w * 0.82, place.front + 3);
