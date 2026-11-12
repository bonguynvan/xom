// The title screen: your character on a plinth that turns slowly one way and back (the face is never away for
// long) in a small studio (warm key light, cool rim light, a contact shadow), drawn on its own transparent
// canvas over the xóm, which goes on living behind it, out of focus. Beside it: the look, shirt colour,
// headwear, one thing to carry, and the name. State lives in select-state.js (pure); this file is the DOM
// (built node by node, styles through classes and CSSOM, as the CSP wants) and the studio.
import * as THREE from '../vendor/three/three.module.min.js';
import { GUEST_LOOKS } from '../guests.js';
import { createAvatar } from './avatar.js';
import { pressed, readPad } from './gamepad.js';
import { EXTRAS, HATS, SHIRTS, choiceOf, initial, reduce, toPrefs } from './select-state.js';

const $ = (id) => document.getElementById(id);

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(20, 12, 8, 0.75)');
  g.addColorStop(0.55, 'rgba(20, 12, 8, 0.28)');
  g.addColorStop(1, 'rgba(20, 12, 8, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildStudio(canvas, rigs, low) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !low, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 2));
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 30);
  const spin = new THREE.Group();
  scene.add(spin);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.74, 0.16, 56), new THREE.MeshStandardMaterial({ color: 0xf1e3c4, roughness: 0.6 }));
  plinth.position.y = 0.08;
  plinth.receiveShadow = true;
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.665, 0.018, 8, 64), new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.45 }));
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.16;
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.163;
  const avatar = createAvatar(rigs);
  avatar.group.position.y = 0.16;
  spin.add(plinth, rimRing, blob, avatar.group);
  const key = new THREE.SpotLight(0xffd2a0, 70, 12, 0.55, 0.7, 2); // warm, from the front right, above
  key.position.set(2.3, 3.5, 2.9);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = !low;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0006;
  const rim = new THREE.DirectionalLight(0x9cc2ff, 2.6); // cool, from behind: the edge of the shoulders and the hat
  rim.position.set(-2.2, 2.4, -3);
  scene.add(key, key.target, rim, new THREE.HemisphereLight(0xfff0dc, 0x3a3046, 0.6));

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tall = camera.aspect < 0.75; // a narrow column: stand further back so the hat is never cut off
    camera.position.set(0, 1.18, tall ? 6.4 : 5.4);
    camera.lookAt(0, 0.98, 0);
    camera.updateProjectionMatrix();
  }
  return { renderer, scene, camera, spin, avatar, resize };
}

function chips(host, name, options, onPick, swatch = false) {
  host.replaceChildren(...options.map((o) => {
    const input = Object.assign(document.createElement('input'), { type: 'radio', name, value: o.id });
    const face = document.createElement('span');
    if (swatch) { face.className = 'dot'; face.style.backgroundColor = o.color; face.title = o.label; input.setAttribute('aria-label', o.label); } else face.textContent = o.label;
    input.addEventListener('change', () => onPick(o.id));
    const label = document.createElement('label');
    label.className = swatch ? 'swatch' : 'chip';
    label.append(input, face);
    return label;
  }));
  return (id) => { for (const input of host.querySelectorAll('input')) input.checked = input.value === id; };
}

/**
 * `enter(prefs, choice)` resolves to { ok, name, look } or { ok: false, message }; `entered(choice, name)` runs once
 * the visitor is in; `watch()` when they only want to look. `reduced` = prefers-reduced-motion.
 */
export function createTitle({ rigs, prefs, low = false, reduced = false, enter, entered, watch }) {
  const root = $('title');
  const studio = buildStudio($('studio'), rigs, low);
  let state = initial(prefs);
  let open = false;
  let idle = 0; // seconds since the plinth was last dragged
  let nextWave = 1.2;
  let pad = readPad(null);
  let drag = null;
  let base = -0.2; // where the plinth rests; dragging moves it
  let phase = 0;

  const dispatch = (action) => { const next = reduce(state, action); if (next !== state) { state = next; render(); } };
  const setLook = chips($('looks'), 'look', GUEST_LOOKS, (id) => { dispatch({ type: 'look', id }); studio.avatar.wave(); });
  const setShirt = chips($('shirts'), 'shirt', SHIRTS, (id) => dispatch({ type: 'shirt', id }), true);
  const setHat = chips($('hats'), 'hat', HATS, (id) => dispatch({ type: 'hat', id }));
  const setExtra = chips($('extras'), 'extra', EXTRAS, (id) => dispatch({ type: 'extra', id }));

  function render() {
    setLook(state.look);
    setShirt(state.shirt);
    setHat(state.hat);
    setExtra(state.extra);
    if ($('name').value !== state.name) $('name').value = state.name;
    $('name').setAttribute('aria-invalid', String(Boolean(state.error)));
    $('name-error').textContent = state.error ?? '';
    $('name-error').hidden = !state.error;
    $('title-go').disabled = state.busy;
    $('title-go').textContent = state.busy ? 'Đang vào…' : state.returning ? `Vào tiếp: ${state.name}` : 'Vào xóm';
    $('title-lede').textContent = state.returning ? 'Mừng bạn về xóm. Vào luôn, hoặc đổi dáng, đổi tên tuỳ thích.' : 'Chọn một dáng người, đặt tên, rồi bước ra ngõ.';
    studio.avatar.set(choiceOf(state));
  }

  async function go() {
    dispatch({ type: 'submit' });
    if (!state.busy) { $('name').focus(); return; }
    const result = await enter(toPrefs(state), choiceOf(state));
    if (!result.ok) { dispatch({ type: 'refused', message: result.message }); $('name').focus(); return; }
    dispatch({ type: 'joined', name: result.name, look: result.look }); // the server's answer wins
    close();
    entered(choiceOf(state), state.name, toPrefs(state));
  }

  $('name').addEventListener('input', () => dispatch({ type: 'name', value: $('name').value }));
  $('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  $('name-random').addEventListener('click', () => dispatch({ type: 'random', r1: Math.random(), r2: Math.random(), r3: Math.random() }));
  $('title-go').addEventListener('click', go);
  $('title-watch').addEventListener('click', () => { close(); watch(); });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); watch(); } });

  // drag the plinth round
  const canvas = $('studio');
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag === null) return; base += (e.clientX - drag) * 0.012; drag = e.clientX; idle = 0; });
  const drop = () => { drag = null; };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  window.addEventListener('resize', () => { if (open) studio.resize(); });

  function show() {
    if (open) return;
    open = true;
    root.hidden = false;
    document.body.classList.add('titled');
    base = -0.2;
    phase = 0;
    studio.resize();
    render();
    $('title-go').focus({ preventScroll: true });
  }
  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    document.body.classList.remove('titled');
    $('scene').focus({ preventScroll: true });
  }

  /** Each frame while open: the gamepad, the turning plinth, a wave now and then, and the studio's picture. */
  function update(dt) {
    if (!open) return;
    const now = readPad(navigator.getGamepads?.()[0] ?? null);
    const hit = pressed(pad, now);
    pad = now;
    if (hit.left) { dispatch({ type: 'step', by: -1 }); studio.avatar.wave(); }
    if (hit.right) { dispatch({ type: 'step', by: 1 }); studio.avatar.wave(); }
    if (hit.confirm) go();
    if (hit.back) { close(); watch(); return; }
    idle += dt;
    if (!reduced && drag === null && idle > 1.5) phase += dt * 0.4;
    studio.spin.rotation.y = base + Math.sin(phase) * 0.85;
    nextWave -= dt;
    if (nextWave <= 0) { studio.avatar.wave(); nextWave = reduced ? Infinity : 6.5; }
    studio.avatar.update(dt);
    studio.renderer.render(studio.scene, studio.camera);
  }

  return { open: show, close, update, get isOpen() { return open; }, get state() { return state; } };
}
