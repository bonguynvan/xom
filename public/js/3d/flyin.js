// The camera's way down from the sky to behind your shoulder, and the door you step out of. Pure maths.

export const FLY_SECONDS = 4.2;

/** Slow, fast, slow. */
export const ease = (t) => { const c = Math.max(0, Math.min(1, t)); return c < 0.5 ? 4 * c * c * c : 1 - ((-2 * c + 2) ** 3) / 2; };

const turn = (from, to) => { const d = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return from + d; };

/**
 * The camera at time t (0..1) between two poses { x, y, z, yaw, pitch, dist } (the point looked at, the angles
 * round it and the distance). The distance shrinks by ratio, so the zoom feels even; the yaw goes the short way
 * round and sweeps a little extra early on, so the xóm turns under you as you come down.
 */
export function flyPose(t, from, to) {
  const e = ease(t);
  const mix = (a, b) => a + (b - a) * e;
  return {
    x: mix(from.x, to.x), y: mix(from.y, to.y), z: mix(from.z, to.z),
    yaw: mix(from.yaw, turn(from.yaw, to.yaw)) + (1 - e) * e * 1.6,
    pitch: mix(from.pitch, to.pitch),
    dist: from.dist * (to.dist / from.dist) ** e,
  };
}

/** A small stable number from a name (which house is "yours"). */
export function hashName(name) {
  let h = 2166136261;
  for (const ch of String(name)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}

/**
 * Where a visitor steps out: in front of one of the tube houses, always the same for the same name. Returns map
 * units { x, y } on the way the door opens onto (clear ground, with room for the camera behind), and the
 * heading (radians, 0 = +y south) pointing away from the door. `nodes` are the ways' nodes (map.js NODES).
 */
export function doorFor(name, places, nodes = []) {
  const houses = places.filter((p) => p.kind === 'house' && p.door);
  if (houses.length === 0) return null;
  const h = houses[hashName(name) % houses.length];
  const out = h.door.y >= h.front ? 1 : -1; // the door is on the front (south) or the back
  const way = nodes[h.entry];
  const reach = way ? Math.hypot(way.x - h.door.x, way.y - h.door.y) : Infinity;
  const spot = reach > 6 && reach < 70 ? { x: way.x, y: way.y } : { x: h.door.x, y: h.door.y + out * 16 };
  return { ...spot, heading: Math.atan2(spot.x - h.door.x, spot.y - h.door.y), house: h.id };
}
