import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, NODES, ROAD_LENGTH, nearestNode, onRoad, routeNodes, smooth } from '../public/js/map.js';
import { PLACES } from '../public/js/places.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('every node can reach every other: the xóm is one connected web of ways', () => {
  for (let to = 0; to < NODES.length; to += 7) {
    const path = routeNodes(0, to);
    assert.equal(path[0], 0);
    assert.equal(path[path.length - 1], to);
    for (let k = 1; k < path.length; k += 1) assert.ok(dist(NODES[path[k - 1]], NODES[path[k]]) < 40, `jump in route to ${to}`);
  }
});

test('ways are not a grid: plenty of them run at an angle', () => {
  let slanted = 0;
  for (let id = 1; id < NODES.length; id += 1) {
    const dx = Math.abs(NODES[id].x - NODES[id - 1].x);
    const dy = Math.abs(NODES[id].y - NODES[id - 1].y);
    if (dx > 2 && dy > 2) slanted += 1;
  }
  assert.ok(slanted > NODES.length / 5, `${slanted} of ${NODES.length} steps are slanted`);
});

test('every door and seat opens onto a way close by', () => {
  for (const p of PLACES) {
    assert.ok(Number.isInteger(p.entry), `${p.id} has an entry`);
    const from = p.door ?? p;
    assert.ok(dist(from, NODES[p.entry]) < 45, `${p.id} door is ${Math.round(dist(from, NODES[p.entry]))} from its way`);
    for (const s of p.spots) if (s.entry !== undefined) assert.ok(dist(s, NODES[s.entry]) < 45, `${p.id} seat far from a way`);
  }
});

test('the road runs across the map and past both edges', () => {
  assert.ok(onRoad(0).x < 0 && onRoad(ROAD_LENGTH).x > MAP.w);
  const mid = onRoad(ROAD_LENGTH / 2);
  assert.ok(mid.y > 250 && mid.y < 350);
  assert.ok(onRoad(ROAD_LENGTH / 2, 8).y > mid.y, 'positive side is towards the viewer');
});

test('smooth curves pass through their knots', () => {
  const line = smooth([{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 0 }], 5);
  assert.deepEqual(line[0], { x: 0, y: 0 });
  assert.deepEqual(line[line.length - 1], { x: 100, y: 0 });
  assert.ok(line.some((p) => Math.abs(p.x - 50) < 0.01 && Math.abs(p.y - 30) < 0.01));
  assert.equal(nearestNode(NODES[5]), 5);
});
