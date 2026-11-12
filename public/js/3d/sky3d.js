// Sky and light by the xóm's clock: a physically based sky, the sun crossing from east to west a little to
// the south (Hà Nội is at 21°N), soft shadows that follow wherever you look, golden hours, a blue night with
// stars and a dim moon, and the weather from Hà Nội: rain falling round the camera, wet roads, fog, cloud.
import * as THREE from '../vendor/three/three.module.min.js';
import { Sky } from '../vendor/three/Sky.js';
import { darkAt, sunAt } from './coords.js';

const WEATHER = {
  clear: { turbidity: 6, rayleigh: 1.6, fog: 0.0035, sun: 1, wet: 0 },
  hot: { turbidity: 9, rayleigh: 1.2, fog: 0.004, sun: 1.15, wet: 0 },
  cold: { turbidity: 4, rayleigh: 2.2, fog: 0.004, sun: 0.85, wet: 0 },
  cloudy: { turbidity: 14, rayleigh: 3.5, fog: 0.006, sun: 0.45, wet: 0 },
  fog: { turbidity: 18, rayleigh: 4, fog: 0.022, sun: 0.35, wet: 0.2 },
  rain: { turbidity: 20, rayleigh: 4, fog: 0.012, sun: 0.25, wet: 1 },
  storm: { turbidity: 20, rayleigh: 4, fog: 0.016, sun: 0.12, wet: 1 },
};

export function buildSky(scene, renderer) {
  const sky = new Sky();
  sky.scale.setScalar(4000);
  scene.add(sky);
  const u = sky.material.uniforms;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.82;

  // the sky also lights and reflects in everything (image-based lighting), re-baked as the sun moves
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const skyCopy = new Sky();
  skyCopy.scale.setScalar(4000);
  skyCopy.material.uniforms = u; // same uniforms: the copy always matches the sky we see
  skyScene.add(skyCopy);
  let env = null;
  let baked = { x: 9, y: 9, z: 9, kind: '' };
  const night = new THREE.Color(0x070b16);
  function bake(kind, dark) {
    if (env) env.dispose();
    skyScene.background = dark > 0.97 ? night : null;
    skyCopy.visible = dark <= 0.97;
    env = pmrem.fromScene(skyScene, 0.02);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.25 + (1 - dark) * 0.55;
  }

  const sun = new THREE.DirectionalLight(0xfff1dc, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const span = 45;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x6b5a40, 0.5);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9fb4ff, 0);
  moon.position.set(-60, 120, -40);
  scene.add(moon);

  scene.fog = new THREE.FogExp2(0xc9d6e2, 0.0035);
  const stars = makeStars();
  scene.add(stars);
  const rain = makeRain();
  scene.add(rain.mesh);

  const fogDay = new THREE.Color();
  const fogNight = new THREE.Color(0x0d1424);
  const golden = new THREE.Color(0xffa860);
  const white = new THREE.Color(0xfff1dc);
  const sunDir = new THREE.Vector3(1, 1, 0);
  let flash = 0;

  /** Move the light for this moment; `focus` is where the camera looks, so the shadows stay sharp there. */
  function update(hour, weatherKind, focus, camera, t, dt) {
    const w = WEATHER[weatherKind] ?? WEATHER.clear;
    const s = sunAt(hour);
    const dark = darkAt(hour);
    sunDir.set(s.x, Math.max(s.y, -0.2), s.z).normalize();
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = w.turbidity;
    u.rayleigh.value = w.rayleigh * (1 - dark * 0.6);
    const low = Math.max(0, 1 - Math.abs(s.elevation) / 0.35); // the sun near the horizon: gold
    sun.color.copy(white).lerp(golden, low * 0.8);
    sun.intensity = Math.max(0, Math.sin(Math.max(0, s.elevation))) ** 0.6 * 3.9 * w.sun * (1 - dark);
    sun.position.copy(focus).addScaledVector(sunDir, 120);
    sun.target.position.copy(focus);
    sun.castShadow = sun.intensity > 0.05;
    hemi.intensity = (0.34 + (1 - dark) * 0.08) * (weatherKind === 'rain' || weatherKind === 'storm' ? 0.8 : 1);
    hemi.color.setHSL(0.6, 0.5, 0.75 - dark * 0.45);
    hemi.groundColor.setHSL(0.09, 0.3, 0.3 - dark * 0.22);
    moon.intensity = dark * 1.1;
    fogDay.setHSL(0.58, 0.25 - w.wet * 0.15, 0.78 - w.wet * 0.18).lerp(golden, low * 0.25);
    scene.fog.color.copy(fogDay).lerp(fogNight, dark);
    scene.fog.density = w.fog * (1 - dark * 0.35);
    sky.visible = dark < 0.98;
    if (Math.hypot(sunDir.x - baked.x, sunDir.y - baked.y, sunDir.z - baked.z) > 0.03 || baked.kind !== weatherKind) {
      bake(weatherKind, dark);
      baked = { x: sunDir.x, y: sunDir.y, z: sunDir.z, kind: weatherKind };
    }
    scene.environmentIntensity = (0.2 + (1 - dark) * 0.4) * (w.wet ? 0.8 : 1);
    stars.material.opacity = Math.max(0, dark - 0.4) * (w.wet ? 0.2 : 1);
    stars.position.copy(camera.position);
    rain.update(camera, w.wet > 0.5 ? (weatherKind === 'storm' ? 1 : 0.6) : 0, dt);
    if (weatherKind === 'storm' && Math.random() < dt * 0.08) flash = 1; // lightning now and then
    flash = Math.max(0, flash - dt * 4);
    hemi.intensity += flash * 3;
    return { dark, wet: w.wet, sunDir, low: low * (1 - dark), rain: w.wet > 0.5 ? (weatherKind === 'storm' ? 1 : 0.6) : 0 };
  }
  return { update, sun, sunDir };
}

function makeStars() {
  const n = 1500;
  const pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k += 1) {
    const a = Math.random() * Math.PI * 2;
    const y = 0.08 + Math.random() * 0.92;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 1500, y * 1500, Math.sin(a) * r * 1500], k * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false;
  return stars;
}

/** Rain: streaks in a box that travels with the camera, so it is always raining wherever you are. */
function makeRain() {
  const n = 7000;
  const box = 50;
  const pos = new Float32Array(n * 6);
  const drops = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * box, y: Math.random() * 30, z: (Math.random() - 0.5) * box, v: 16 + Math.random() * 6 }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab7c8, transparent: true, opacity: 0.45, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  // where a drop lands near you it throws up a little crown: three short strokes that live a fifth of a second
  const SPLASHES = 260;
  const LIFE = 0.2;
  const spos = new Float32Array(SPLASHES * 18);
  const splashes = Array.from({ length: SPLASHES }, () => ({ x: 0, z: 0, age: LIFE }));
  let next = 0;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const crowns = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd6dee8, transparent: true, opacity: 0.3, depthWrite: false }));
  crowns.frustumCulled = false;
  mesh.add(crowns);
  return {
    mesh,
    update(camera, amount, dt) {
      mesh.visible = amount > 0;
      if (!mesh.visible) return;
      const shown = Math.floor(n * amount);
      g.setDrawRange(0, shown * 2);
      for (let k = 0; k < shown; k += 1) {
        const d = drops[k];
        d.y -= d.v * dt;
        if (d.y < 0) {
          if (camera.position.y < 25 && Math.abs(d.x) < 13 && Math.abs(d.z) < 13) { splashes[next] = { x: camera.position.x + d.x, z: camera.position.z + d.z, age: 0 }; next = (next + 1) % SPLASHES; }
          d.y = 30; d.x = (Math.random() - 0.5) * box; d.z = (Math.random() - 0.5) * box;
        }
        const x = camera.position.x + d.x;
        const z = camera.position.z + d.z;
        const y = Math.max(0, camera.position.y - 15) + d.y;
        pos.set([x, y, z, x + 0.05, y + 0.55, z + 0.02], k * 6);
      }
      g.attributes.position.needsUpdate = true;
      for (let k = 0; k < SPLASHES; k += 1) {
        const s = splashes[k];
        s.age += dt;
        const live = s.age < LIFE;
        const r = live ? 0.02 + (s.age / LIFE) * 0.06 : 0;
        const up = live ? 0.05 * Math.sin((s.age / LIFE) * Math.PI) + 0.01 : 0;
        for (let a = 0; a < 3; a += 1) {
          const ang = a * 2.094 + k;
          spos.set([s.x, live ? 0.08 : -5, s.z, s.x + Math.cos(ang) * r, live ? 0.08 + up : -5, s.z + Math.sin(ang) * r], k * 18 + a * 6);
        }
      }
      sg.attributes.position.needsUpdate = true;
    },
  };
}
