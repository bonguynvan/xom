// The sun's shadows. On the higher tiers they are cascaded (three.js CSM, vendored): a small sharp map for the
// few metres round you and wider ones behind it, fitted to what the camera sees, so a shadow is crisp at your
// feet and still there at the end of the street. The middle tier keeps one map round the focus (sky3d.js);
// the lowest has no maps at all (people3d.js draws a dark disc under everyone).
import * as THREE from '../vendor/three/three.module.min.js';
import { CSM } from '../vendor/three/CSM.js';
import { SPLITS, WALK_FAR, shadowFar } from './quality.js';
import { hook, litMaterials } from './shade.js';


export function createShadows({ scene, camera, tier, sun }) {
  if (tier.shadows !== 'cascade') {
    if (tier.shadows === 'single') sun.shadow.mapSize.set(tier.mapSize, tier.mapSize);
    else sun.castShadow = false;
    return { cascades: tier.shadows === 'single' ? 1 : 0, adopt: () => {}, update: () => { if (tier.shadows !== 'single') sun.castShadow = false; } };
  }
  const csm = new CSM({
    camera, parent: scene, cascades: tier.cascades, maxFar: WALK_FAR, mode: 'custom', shadowMapSize: tier.mapSize,
    lightDirection: new THREE.Vector3(-1, -1, 0).normalize(), lightIntensity: 1, lightMargin: 120, lightFar: 420,
    customSplitsCallback: (n, near, far, breaks) => { for (const s of SPLITS[n]) breaks.push(s); },
  });
  csm.fade = true; // blend from one cascade into the next instead of a visible seam
  csm.lights.forEach((light, k) => { light.shadow.bias = -0.00025 * (k + 1); light.shadow.normalBias = 0.02 + k * 0.05; });
  csm.updateFrustums();
  let far = WALK_FAR;

  /** Make the lit materials under `root` read the cascades (call again for anything added later). */
  function adopt(root) {
    for (const m of litMaterials(root)) {
      if (csm.shaders.has(m)) continue;
      m.defines = { ...(m.defines ?? {}), USE_CSM: 1, CSM_CASCADES: csm.cascades, CSM_FADE: '' };
      const breaks = [];
      csm.shaders.set(m, null);
      hook(m, 'csm', (shader) => {
        csm.getExtendedBreaks(breaks);
        shader.uniforms.CSM_cascades = { value: breaks };
        shader.uniforms.cameraNear = { value: camera.near };
        shader.uniforms.shadowFar = { value: Math.min(camera.far, csm.maxFar) };
        csm.shaders.set(m, shader);
      });
    }
  }

  return {
    cascades: csm.cascades,
    adopt,
    /** Each frame, after sky3d has set the sun: the cascades take its direction, colour and strength. */
    update(focus) {
      sun.visible = false; // the cascade lights are the sun now
      const wanted = shadowFar(camera.position.distanceTo(focus));
      if (Math.abs(wanted - far) > far * 0.08) { far = wanted; csm.maxFar = far; csm.updateFrustums(); }
      csm.lightDirection.subVectors(sun.target.position, sun.position).normalize();
      const on = sun.intensity > 0.05;
      for (const light of csm.lights) { light.color.copy(sun.color); light.intensity = on ? sun.intensity : 0; light.castShadow = on; }
      camera.updateMatrixWorld();
      csm.update();
    },
  };
}
