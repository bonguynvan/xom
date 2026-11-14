// The picture after the scene is drawn (three.js addons, vendored): ambient occlusion, bloom for lamps and lit
// windows, the film grade (ACES, warm highlights, lifted blacks, vignette, grain) and anti-aliasing. Which
// passes exist is the quality tier's business (quality.js); the lowest tier has none and draws straight to
// the screen. The numbers of the grade come from grade.js (pure, tested).
import * as THREE from '../vendor/three/three.module.min.js';
import { EffectComposer } from '../vendor/three/EffectComposer.js';
import { FXAAShader } from '../vendor/three/FXAAShader.js';
import { GTAOPass } from '../vendor/three/GTAOPass.js';
import { RenderPass } from '../vendor/three/RenderPass.js';
import { SMAAPass } from '../vendor/three/SMAAPass.js';
import { ShaderPass } from '../vendor/three/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/three/UnrealBloomPass.js';
import { GRADE_GLSL } from './grade.js';

const FilmShader = {
  name: 'XomFilm',
  defines: { ACES_FILMIC_TONE_MAPPING: '' },
  uniforms: {
    tDiffuse: { value: null }, toneMappingExposure: { value: 1 }, saturation: { value: 1 }, warmth: { value: 0 }, lift: { value: 0 },
    vignette: { value: 0 }, grain: { value: 0 }, time: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float warmth;
    uniform float lift;
    uniform float vignette;
    uniform float grain;
    uniform float time;
    varying vec2 vUv;
    #include <tonemapping_pars_fragment>
    ${GRADE_GLSL}
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec3 c = ACESFilmicToneMapping(texture2D(tDiffuse, vUv).rgb);
      c = xomGrade(c, saturation, warmth, lift, vignette, length(vUv - 0.5) * 1.5);
      c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
      c += (hash(gl_FragCoord.xy + fract(time) * 517.0) - 0.5) * grain; // grain goes on last, in display space
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * `tier` is a row of quality.js TIERS. Returns { render(dt), setSize(w, h), setLook(look), shed({ ao, bloom }) }
 * where w and h are drawing-buffer pixels and `look` comes from grade.js lookAt.
 */
export function createPost({ renderer, scene, camera, tier }) {
  if (!tier.post) {
    return {
      passes: 0,
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      setLook: (look) => { renderer.toneMappingExposure = look.exposure; },
      shed: () => {},
    };
  }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  // the scene is drawn into a half-float target with a depth texture: the occlusion pass reads that depth, so
  // the scene is never drawn a second time for it (normals are rebuilt from depth)
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(size.x, size.y) });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let ao = null;
  if (tier.ao > 0) {
    // (r170's GTAOPass throws if it is handed a depth texture at construction: give it afterwards)
    ao = new GTAOPass(scene, camera, Math.round(size.x * tier.ao), Math.round(size.y * tier.ao), undefined,
      { radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12, distanceFallOff: 1, screenSpaceRadius: false },
      { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1.5, rings: 2, samples: 12 });
    ao.setGBuffer(target.depthTexture); // from now on it never draws the scene itself
    ao.normalRenderTarget.dispose();
    const render = ao.render.bind(ao);
    ao.render = (r, write, read, ...rest) => { // whichever buffer the scene was just drawn into holds this frame's depth
      ao.gtaoMaterial.uniforms.tDepth.value = read.depthTexture;
      ao.pdMaterial.uniforms.tDepth.value = read.depthTexture;
      render(r, write, read, ...rest);
    };
    const resize = ao.setSize.bind(ao);
    ao.setSize = (w, h) => resize(Math.max(1, Math.round(w * tier.ao)), Math.max(1, Math.round(h * tier.ao)));
    composer.addPass(ao);
  }
  const bloom = tier.bloom ? new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.2, 0.6, 1) : null;
  if (bloom) composer.addPass(bloom);
  const film = new ShaderPass(FilmShader);
  film.material.toneMapped = false; // the shader tone maps by itself, whether it draws to the screen or to a buffer
  composer.addPass(film);
  let fxaa = null;
  if (tier.aa === 'smaa') composer.addPass(new SMAAPass(size.x, size.y));
  else if (tier.aa === 'fxaa') { fxaa = new ShaderPass(FXAAShader); fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y); composer.addPass(fxaa); }

  let time = 0;
  return {
    passes: composer.passes.length,
    render(dt) {
      time += dt;
      film.material.uniforms.time.value = time;
      composer.render(dt);
    },
    setSize(w, h) {
      composer.setSize(w, h);
      if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / w, 1 / h);
    },
    setLook(look) {
      const u = film.material.uniforms;
      u.toneMappingExposure.value = look.exposure;
      u.saturation.value = look.saturation;
      u.warmth.value = look.warmth;
      u.lift.value = look.lift;
      u.vignette.value = look.vignette;
      u.grain.value = tier.grain ? look.grain : 0;
      if (bloom) { bloom.strength = look.bloom; bloom.radius = look.bloomRadius; bloom.threshold = look.bloomThreshold; }
    },
    /** Shed load (quality.js `shed`): switch the heavy passes off without rebuilding anything. */
    shed({ ao: keepAo, bloom: keepBloom }) {
      if (ao) ao.enabled = keepAo > 0;
      if (bloom) bloom.enabled = keepBloom;
    },
  };
}
