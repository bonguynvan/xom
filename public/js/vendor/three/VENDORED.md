# three.js r170 (vendored)

Copied from the npm package `three@0.170.0` (MIT, see LICENSE.txt), unmodified except for import paths:

- `three.module.min.js` from `build/`
- `GLTFLoader.js`, `BufferGeometryUtils.js`, `SkeletonUtils.js`, `Sky.js` from `examples/jsm/`, with
  `from 'three'` rewritten to `from './three.module.min.js'` and `'../utils/'` to `'./'`.
- Post-processing and shadows (added 2026-11-12, 177 KB in all, same package, same MIT licence, same rewrite; every
  file sits flat in this folder, so `'../shaders/'`, `'../math/'` and `'../postprocessing/'` became `'./'`):
  `EffectComposer.js`, `RenderPass.js`, `ShaderPass.js`, `Pass.js`, `MaskPass.js`, `GTAOPass.js`, `UnrealBloomPass.js`,
  `SMAAPass.js` (from `postprocessing/`); `CopyShader.js`, `GTAOShader.js`, `PoissonDenoiseShader.js`,
  `LuminosityHighPassShader.js`, `SMAAShader.js`, `FXAAShader.js` (from `shaders/`); `SimplexNoise.js` (from `math/`);
  `CSM.js`, `CSMFrustum.js`, `CSMShader.js` (from `csm/`). `SMAAPass.js` carries its two lookup images as `data:` URLs,
  which the CSP's `img-src 'self' data:` already allows. No WASM anywhere.

Why: the CSP is `script-src 'self'`, so no CDN and no inline `<script type="importmap">`; the addons must import
three by a relative path (checked in `test/coords3d.test.js`). To update, repeat the same copy and rewrite.

Models in `public/models/`: `clips.glb` is the skeleton and the Idle, Walk, Run and TPose animations of the
three.js example `Soldier.glb` (a Mixamo character) with its meshes and pictures taken out; `remy.glb` is Mixamo's
Remy (free to use under Mixamo's terms), converted with `scripts/fbx-to-glb.py`. Both were passed through
`scripts/unpack-glb.js` so their textures are plain files the CSP allows. `public/textures/waternormals.jpg` and `grass.jpg` (resized) are from the three.js examples.
