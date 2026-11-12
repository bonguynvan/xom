// The middle distance of the crowd: each person is a flat picture of a real character, taken from the same
// two rigs as the people near you. At start-up every rig is drawn once from eight sides in four walking poses
// and one standing pose into a sheet; a person then costs two triangles and one instance of a single draw.
// Which cell someone shows is crowd-plan.js cellOf (pure, tested).
import * as THREE from '../vendor/three/three.module.min.js';
import * as SkeletonUtils from '../vendor/three/SkeletonUtils.js';
import { SHEET } from './crowd-plan.js';
import { hook } from './shade.js';

const CELL = { w: 64, h: 128 };
const MAX = 900;

/** Draw the sheet with the page's own renderer (so the texture lives in its context). Returns the render target. */
function bake(renderer, rigs) {
  const target = new THREE.WebGLRenderTarget(CELL.w * SHEET.cols, CELL.h * SHEET.rows, { depthBuffer: true });
  target.scissorTest = true;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  scene.add(key);
  const was = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), shadows: renderer.shadowMap.enabled };
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 0);
  [rigs.man, rigs.woman].forEach((rig, r) => {
    const model = SkeletonUtils.clone(rig.scene);
    model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    scene.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const walk = mixer.clipAction(rig.clips.walk);
    const idle = mixer.clipAction(rig.clips.idle);
    const tall = rig.height * 1.1;
    const camera = new THREE.OrthographicCamera(-tall / 4, tall / 4, tall, 0, 0.1, 20);
    for (let row = 0; row < SHEET.rows; row += 1) {
      mixer.stopAllAction();
      const action = row < SHEET.frames ? walk : idle;
      action.play();
      action.time = row < SHEET.frames ? (row / SHEET.frames) * rig.clips.walk.duration : 0;
      mixer.update(0);
      for (let dir = 0; dir < SHEET.dirs; dir += 1) {
        const a = (dir / SHEET.dirs) * Math.PI * 2; // 0 = seen from the front
        camera.position.set(Math.sin(a) * 6, 0, Math.cos(a) * 6);
        camera.lookAt(0, 0, 0);
        key.position.set(Math.sin(a + 0.6) * 4, 5, Math.cos(a + 0.6) * 4);
        const x = (r * SHEET.dirs + dir) * CELL.w;
        target.viewport.set(x, row * CELL.h, CELL.w, CELL.h);
        target.scissor.set(x, row * CELL.h, CELL.w, CELL.h);
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
      }
    }
    scene.remove(model);
  });
  renderer.setRenderTarget(was.target);
  renderer.setClearColor(was.color, was.alpha);
  renderer.shadowMap.enabled = was.shadows;
  target.texture.minFilter = THREE.LinearFilter; // no mipmaps: neighbouring cells must not bleed into each other
  target.texture.generateMipmaps = false;
  return target;
}

export function createImpostors(scene, renderer, rigs) {
  const sheet = bake(renderer, rigs);
  const quad = new THREE.PlaneGeometry(0.5, 1).translate(0, 0.5, 0); // one unit tall, standing on its base
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  cells.setUsage(THREE.DynamicDrawUsage);
  quad.setAttribute('aCell', cells);
  const material = new THREE.MeshBasicMaterial({ map: sheet.texture, alphaTest: 0.5, side: THREE.DoubleSide });
  hook(material, 'impostor-cell', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv = (uv + aCell) * vec2(${(1 / SHEET.cols).toFixed(6)}, ${(1 / SHEET.rows).toFixed(6)});`);
  });
  const mesh = new THREE.InstancedMesh(quad, material, MAX);
  mesh.name = 'impostors';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.setColorAt(0, new THREE.Color(0xffffff));
  scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const size = new THREE.Vector3();
  let n = 0;
  return {
    mesh,
    max: MAX,
    begin() { n = 0; },
    /** One person: at (X, y, Z), `height` metres tall, turned to face the camera by `facing`, showing `cell`, tinted. */
    add(X, y, Z, height, facing, cell, tint) {
      if (n >= MAX) return;
      q.setFromAxisAngle(up, facing);
      mesh.setMatrixAt(n, m4.compose(pos.set(X, y, Z), q, size.set(height * 1.1, height * 1.1, 1)));
      mesh.setColorAt(n, tint);
      cells.array[n * 2] = cell.col;
      cells.array[n * 2 + 1] = cell.row;
      n += 1;
    },
    /** `light` 0..1: how bright the street is (the pictures carry their own shading, the hour dims them). */
    end(light) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      cells.needsUpdate = true;
      material.color.setScalar(light);
    },
    get count() { return n; },
  };
}
