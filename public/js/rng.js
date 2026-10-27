// Stateless deterministic randomness: the same inputs always give the same number, so the
// simulation needs no mutable generator and replays exactly from a seed (and is easy to test).

const mix = (h) => {
  let x = h;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return x ^ (x >>> 16);
};

/** A number in [0, 1) from any list of integers (seed, agent index, tick, salt…). */
export function noise(...parts) {
  let h = 0x9e3779b9;
  for (const part of parts) h = mix(h ^ mix(part | 0));
  return (mix(h) >>> 0) / 4294967296;
}

/** Turn a word into a salt for `noise`, so call sites read `noise(seed, i, tick, salt('chat'))`. */
export function salt(word) {
  let h = 2166136261;
  for (let i = 0; i < word.length; i += 1) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
  return h | 0;
}

/** Pick from a list with a noise value in [0, 1). */
export const pickWith = (list, r) => list[Math.floor(r * list.length) % list.length];
