// How much the picture may cost, as pure data and maths (node:test): four tiers, which one a machine starts on,
// and when a page that cannot keep up sheds load. Nothing here touches the page or three.js.

export const TIER_NAMES = ['thap', 'vua', 'cao', 'toida'];
export const TIER_LABEL = { auto: 'Tự động', thap: 'Thấp', vua: 'Vừa', cao: 'Cao', toida: 'Tối đa' };

/**
 * What each tier draws. `ratio` caps the device pixel ratio; `shadows` = 'blob' (dark discs under people only),
 * 'single' (one map round the focus) or 'cascade' (`cascades` maps fitted to the view); `aa` = 'none' | 'fxaa' |
 * 'smaa'; `ao` = 0 (off) or the share of the resolution the ambient occlusion is worked out at; `skinned` = how
 * many neighbours are real skinned characters and `budget` the triangles they may cost in all (shadow draws included); `relief` = normal maps on walls, roofs and ground; `detail` = metres within which shop interiors and balcony things are built and shown.
 */
export const TIERS = {
  thap: { ratio: 1, shadows: 'blob', mapSize: 0, cascades: 0, aa: 'none', post: false, bloom: false, ao: 0, grain: false, skinned: 12, budget: 300000, relief: false, detail: 0 },
  vua: { ratio: 1.5, shadows: 'single', mapSize: 1024, cascades: 1, aa: 'fxaa', post: true, bloom: true, ao: 0, grain: false, skinned: 20, budget: 500000, relief: true, detail: 15 },
  cao: { ratio: 1.5, shadows: 'cascade', mapSize: 2048, cascades: 2, aa: 'smaa', post: true, bloom: true, ao: 0.5, grain: true, skinned: 30, budget: 480000, relief: true, detail: 25 },
  toida: { ratio: 2, shadows: 'cascade', mapSize: 2048, cascades: 3, aa: 'smaa', post: true, bloom: true, ao: 1, grain: true, skinned: 40, budget: 1100000, relief: true, detail: 40 },
};

const WEAK_GPU = /Intel.*(HD|UHD) Graphics|Mali|Adreno \(TM\) [3-6]\d\d|PowerVR|SwiftShader|llvmpipe/i;
const STRONG_GPU = /Apple M\d|Apple GPU|Iris.*Xe|GeForce|Radeon|RTX|GTX|Arc\b/i;

/**
 * The tier a page starts on. `forced` = the ?chatluong= value, `stored` = the visitor's saved choice ('auto' or
 * a tier), `coarse` = a touch device, `memory` = navigator.deviceMemory (GB, may be undefined), `gpu` = the
 * unmasked renderer string (may be empty). A forced or stored tier wins; otherwise the weakest sign decides.
 */
export function pickTier({ forced = null, stored = 'auto', coarse = false, memory = undefined, gpu = '' } = {}) {
  if (TIER_NAMES.includes(forced)) return forced;
  if (TIER_NAMES.includes(stored)) return stored;
  if (coarse || (memory !== undefined && memory <= 4)) return 'thap';
  if (WEAK_GPU.test(gpu)) return 'vua';
  if (STRONG_GPU.test(gpu)) return 'cao';
  return 'vua'; // an unknown machine: the middle
}

/** The next choice when the quality button is pressed: auto, then each tier, then round again. */
export const nextChoice = (choice) => { const all = ['auto', ...TIER_NAMES]; return all[(all.indexOf(choice) + 1) % all.length]; };

// ---------------- cascaded shadows ----------------

/** Where the cascades end, as shares of the shadowed distance: a tight first one, the rest further out. */
export const SPLITS = { 1: [1], 2: [0.17, 1], 3: [0.09, 0.32, 1], 4: [0.06, 0.18, 0.45, 1] };
export const WALK_FAR = 95; // metres of shadow in front of the camera when walking

/** How far the shadows must reach for a camera `distance` metres from what it looks at (the overview is far away). */
export const shadowFar = (distance) => Math.max(WALK_FAR, Math.min(900, distance * 1.7 + 60));

// ---------------- shedding load while running ----------------

export const SHED_MAX = 3;
const SLOW_MS = 24; // a frame slower than this is under ~42 fps
const SLOW_FOR = 3; // seconds of that before a step down

/**
 * `s` = { level, slow, avg }: `level` 0 (everything the tier has) .. SHED_MAX, `slow` = seconds spent too slow
 * in a row, `avg` = the smoothed frame time. Returns the next state; the level only ever goes down the ladder
 * (a page that climbs back would oscillate). Never mutates.
 */
export function adapt(s, frameMs, dt) {
  const avg = s.avg ? s.avg + (frameMs - s.avg) * Math.min(1, dt * 2) : frameMs;
  const slow = avg > SLOW_MS ? s.slow + dt : 0;
  if (slow >= SLOW_FOR && s.level < SHED_MAX) return { level: s.level + 1, slow: 0, avg };
  return { level: s.level, slow, avg };
}

/** What a shed level takes away from a tier: first the ambient occlusion, then pixels, then the bloom too. */
export function shed(tier, level) {
  return {
    ao: level >= 1 ? 0 : tier.ao,
    ratio: tier.ratio * (level >= 3 ? 0.6 : level >= 2 ? 0.75 : 1),
    bloom: tier.bloom && level < 3,
  };
}
