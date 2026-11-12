// How surfaces answer the weather, added to the standard material's shader (shade.js): everything darkens and
// shines a little when it rains, the road and pavements gather puddles that mirror the sky and the lamps and
// ring with drops, and every old wall has its band of damp and moss above the ground whatever the weather.
// All of it is a few lines of noise in the fragment shader: no extra textures, no extra draws.
import { hook } from './shade.js';

/** Shared by every weathered material: set once a frame (surface.js `setWeather`). */
const UNIFORMS = { xomWet: { value: 0 }, xomRain: { value: 0 }, xomTime: { value: 0 } };

const VERTEX = /* glsl */`
  vec4 xomWorld = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    xomWorld = instanceMatrix * xomWorld;
  #endif
  vXomWorld = (modelMatrix * xomWorld).xyz;
`;

const COMMON = /* glsl */`
  varying vec3 vXomWorld;
  uniform float xomWet;
  uniform float xomRain;
  uniform float xomTime;
  float xomHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float xomNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(xomHash(i), xomHash(i + vec2(1.0, 0.0)), f.x), mix(xomHash(i + vec2(0.0, 1.0)), xomHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec2 xomRipple(vec2 p, float t) { // one drop's widening ring in each cell
    vec2 cell = floor(p); vec2 f = fract(p) - 0.5; float h = xomHash(cell);
    float age = fract(t * (0.8 + h * 0.6) + h * 9.0); float d = length(f); float r = age * 0.45;
    float ring = sin((d - r) * 48.0) * smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - age);
    return (f / max(d, 1e-3)) * ring;
  }
`;

const KINDS = {
  // roads, pavements, yards: puddles in the hollows
  ground: /* glsl */`
    float xomHollow = xomNoise(vXomWorld.xz * 0.33) * 0.6 + xomNoise(vXomWorld.xz * 1.1 + 7.0) * 0.4;
    float xomPuddle = smoothstep(0.66 - xomWet * 0.2, 0.72 - xomWet * 0.2, xomHollow) * xomWet;
    diffuseColor.rgb *= mix(1.0, 0.55, max(xomWet * 0.7, xomPuddle));
    roughnessFactor = mix(mix(roughnessFactor, 0.42, xomWet * 0.8), 0.03, xomPuddle);
  `,
  // bare earth and grass: darker when wet, no mirror
  earth: /* glsl */`
    float xomPuddle = 0.0;
    diffuseColor.rgb *= 1.0 - xomWet * 0.28;
    roughnessFactor = mix(roughnessFactor, 0.6, xomWet * 0.5);
  `,
  // walls: rising damp and moss near the ground always; soaked streaks from the top in the rain
  wall: /* glsl */`
    float xomPuddle = 0.0;
    float xomEdge = 0.55 + 0.9 * xomNoise(vec2(vXomWorld.x + vXomWorld.z, vXomWorld.y) * 1.3);
    float xomBand = 1.0 - smoothstep(0.1, xomEdge, vXomWorld.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.5, 0.6, 0.38) + vec3(0.0, 0.012, 0.0), xomBand * 0.6);
    float xomStreak = xomNoise(vec2((vXomWorld.x + vXomWorld.z) * 2.6, vXomWorld.y * 0.22));
    diffuseColor.rgb *= 1.0 - xomWet * (0.12 + 0.26 * xomStreak * xomStreak);
    roughnessFactor = mix(roughnessFactor, 0.5, xomWet * (0.3 + 0.5 * xomStreak) + xomBand * 0.15);
  `,
  // roofs and anything else out in the rain
  roof: /* glsl */`
    float xomPuddle = 0.0;
    diffuseColor.rgb *= 1.0 - xomWet * 0.3;
    roughnessFactor = mix(roughnessFactor, 0.3, xomWet * 0.7);
  `,
};

const NORMAL = /* glsl */`
  if (xomPuddle > 0.001) { // still water lies flat whatever the tiles under it do; drops ring it
    vec2 xomRing = (xomRipple(vXomWorld.xz * 2.3, xomTime) + xomRipple(vXomWorld.xz * 3.7 + 11.0, xomTime * 1.3)) * xomRain * 0.35;
    vec3 xomUp = normalize(mat3(viewMatrix) * normalize(vec3(xomRing.x, 1.0, xomRing.y)));
    normal = normalize(mix(normal, xomUp, xomPuddle));
  }
`;

/** Make a standard material answer the weather as a 'ground', 'earth', 'wall' or 'roof'. Returns the material. */
export function weathered(material, kind) {
  return hook(material, `weather-${kind}`, (shader) => {
    Object.assign(shader.uniforms, UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vXomWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${KINDS[kind]}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${NORMAL}`);
  });
}

/** Once a frame: `wet` 0..1 (how soaked things are), `rain` 0..1 (how hard it is falling now), `time` seconds. */
export function setWeather(wet, rain, time) {
  UNIFORMS.xomWet.value = wet;
  UNIFORMS.xomRain.value = rain;
  UNIFORMS.xomTime.value = time;
}
