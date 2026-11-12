// The look of the picture as pure maths (node:test): what the grade is at a given hour and weather, and the
// grade itself (the same steps the shader in post.js takes after tone mapping), so it can be checked without
// a GPU. The aim is 1990s colour print film: warm highlights, blacks that never quite reach black, a little
// less saturation, a soft vignette and fine grain.

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

const WARM = [1.07, 1.0, 0.88]; // what the highlights are multiplied by at full warmth
const COOL = [0.0, 0.012, 0.022]; // what is added to the deepest shadows

/**
 * The grade for a moment. `dark` 0 (day) .. 1 (night), `low` 0..1 how near the sun is to the horizon,
 * `wet` 0..1. Returns plain numbers: exposure, saturation, warmth, lift, vignette, grain, and the bloom's
 * strength, radius and threshold (in scene-linear units: only lamps, lit windows and signs are brighter).
 */
export function lookAt({ dark = 0, low = 0, wet = 0 } = {}) {
  const d = clamp(dark);
  const w = clamp(wet);
  return {
    exposure: 0.8 - w * 0.06 * (1 - d) + d * 0.45,
    saturation: 1.0 - w * 0.16 + clamp(low) * 0.06 * (1 - d),
    warmth: clamp(0.45 + clamp(low) * 0.45 - w * 0.3 - d * 0.1),
    lift: 0.016 - d * 0.006,
    vignette: 0.22 + d * 0.16,
    grain: 0.026 + d * 0.014,
    bloom: 0.05 + d * 0.5 + w * 0.05,
    bloomRadius: 0.55 + d * 0.2,
    bloomThreshold: 1.6 - d * 1.0,
  };
}

/**
 * Grade one display-linear colour [r, g, b] (0..1, already tone mapped) with a look: saturation, warm
 * highlights and cool shadows, lifted blacks. `edge` 0 (centre) .. 1 (corner) for the vignette.
 * Returns a new [r, g, b].
 */
export function gradeColor(rgb, look, edge = 0) {
  const l = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const hi = smooth(0.3, 1, l) * look.warmth;
  const lo = (1 - l) * (1 - l) * look.warmth;
  const v = 1 - look.vignette * smooth(0.45, 1.05, edge);
  return rgb.map((c, k) => {
    const sat = l + (c - l) * look.saturation;
    const toned = sat * (1 + (WARM[k] - 1) * hi) + COOL[k] * lo;
    return clamp((look.lift + toned * (1 - look.lift)) * v);
  });
}

/** The same grade as GLSL (kept next to the JS so the two cannot drift apart unnoticed; see test/look.test.js). */
export const GRADE_GLSL = /* glsl */`
  vec3 xomGrade(vec3 c, float saturation, float warmth, float lift, float vignette, float edge) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float hi = smoothstep(0.3, 1.0, l) * warmth;
    float lo = (1.0 - l) * (1.0 - l) * warmth;
    vec3 sat = vec3(l) + (c - vec3(l)) * saturation;
    vec3 toned = sat * (vec3(1.0) + (vec3(${WARM.map((n) => n.toFixed(3)).join(', ')}) - vec3(1.0)) * hi) + vec3(${COOL.map((n) => n.toFixed(3)).join(', ')}) * lo;
    float v = 1.0 - vignette * smoothstep(0.45, 1.05, edge);
    return clamp((vec3(lift) + toned * (1.0 - lift)) * v, 0.0, 1.0);
  }
`;
