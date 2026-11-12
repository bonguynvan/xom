// The xóm in 3D. The simulation (world.js, seeded by the day, Vietnam time, weather from
// the server), drawn with three.js: a real sky and sun, shadows, reflecting pond, real houses, skinned people.
// Walk among them with WASD (two sticks on a phone, or a gamepad); E says hello to whoever is nearest, who turns
// and waves back; C sits on a plastic stool.
import * as THREE from '../vendor/three/three.module.min.js';
import { GREETINGS } from '../cast.js';
import { extrasAt, extrasFrom } from '../extras.js';
import { CAST } from '../cast.js';
import { NODES, ROAD_HALF, ROAD_LINE, hourOf } from '../map.js';
import { createMusic } from '../music.js';
import { PLACES, POLES } from '../places.js';
import { STOOL_CLUSTERS } from '../street-life.js';
import { STEP_MS, createWorld, setWeather, stepWorld, syncGuests } from '../world.js';
import { createAvatar } from './avatar.js';
import { M, boxGrid, blockers, toX, toZ } from './coords.js';
import { buildDecals } from './decals3d.js';
import { buildDetail } from './detail3d.js';
import { createSound } from './sound3d.js';
import { surfaceKind } from './sound-plan.js';
import { KIND_OF } from './vehicles3d.js';
import { FLY_SECONDS, doorFor } from './flyin.js';
import { OPEN_KINDS, buildBuildings } from './buildings3d.js';
import { GREET_REACH, nearestPerson, nearestSeat, seatsOf } from './interact.js';
import { buildPeople, loadRigs } from './people3d.js';
import { lookAt } from './grade.js';
import { pushMove, sampleMoves, shouldSend } from './net-move.js';
import { createPerf } from './perf.js';
import { createPost } from './post.js';
import { TIERS, TIER_LABEL, adapt, nextChoice, pickTier, shed } from './quality.js';
import { createControls } from './player.js';
import { createShadows } from './shadows.js';
import { choiceOf, initial } from './select-state.js';
import { createSession, loadFeel, loadPrefs, loadQuality, saveFeel, savePrefs, saveQuality } from './session.js';
import { createTitle } from './title.js';
import { buildProps } from './props.js';
import { buildSky } from './sky3d.js';
import { setWeather as setSurfaceWeather } from './surface.js';
import { setRelief } from './textures.js';
import { KERB, buildTerrain } from './terrain.js';
import { buildTrees } from './trees.js';
import { buildMovers } from './vehicles3d.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const VN_OFFSET_MS = 7 * 3600 * 1000;
const vnNow = () => new Date(Date.now() + VN_OFFSET_MS);
const vnMinute = (d = vnNow()) => d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
const daySeed = (d = vnNow()) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
const RATE = Math.max(1 / 60, Math.min(600, Number(params.get('tua')) / 60 || 1 / 60));
const START = params.has('gio') ? Number(params.get('gio')) * 60 : vnMinute(); // ?gio=17.5 to look at a given hour
const EXTRAS = extrasFrom(CAST);
const STOP_AFTER = Number(params.get('dung')) || 0;
const LIVE = params.get('live') === '1'; // a livestream source: no buttons, no title screen, music by itself
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
/** The graphics card's name, where the browser tells (it decides the starting quality; never sent anywhere). */
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  } catch { return ''; }
}
const CHOICE = loadQuality(); // 'auto' or a tier the visitor picked
const TIER_NAME = pickTier({ forced: params.get('chatluong'), stored: CHOICE, coarse: TOUCH, memory: navigator.deviceMemory, gpu: gpuName() });
const TIER = TIERS[TIER_NAME];
const LOW = TIER_NAME === 'thap';
const SEATS = seatsOf(PLACES, STOOL_CLUSTERS, KERB);
const LOOK_HINT = TOUCH ? 'Kéo để xoay · chụm hai ngón để phóng to' : 'Kéo để xoay · chuột phải (hoặc Shift + kéo) để dời · lăn chuột để phóng to';

const state = { world: createWorld({ seed: daySeed(), minute: START, rate: RATE }), prev: null, acc: 0, last: performance.now(), said: [], facing: null, announcement: null };
if (params.get('troi')) state.world = setWeather(state.world, { kind: params.get('troi'), tempC: 28 }); // ?troi=rain to test the weather

// ---------------- renderer and scene ----------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); // anti-aliasing is a pass (post.js)
let load = { level: 0, slow: 0, avg: 0 }; // quality.js adapt: load shed while running
const ratioNow = () => Math.min(devicePixelRatio || 1, shed(TIER, load.level).ratio);
renderer.setPixelRatio(ratioNow());
renderer.shadowMap.enabled = TIER.shadows !== 'blob';
renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);

const post = createPost({ renderer, scene, camera, tier: TIER });
function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setPixelRatio(ratioNow());
  renderer.setSize(width, height, false);
  const px = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(px.x, px.y);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const progress = (text) => { $('splash-sub').textContent = text; };
const pause = () => new Promise((r) => requestAnimationFrame(() => r()));

async function setup() {
  setRelief(TIER.relief);
  const loader = new THREE.TextureLoader();
  const [grass, waterNormals] = await Promise.all(['/textures/grass.jpg', '/textures/waternormals.jpg'].map((u) => loader.loadAsync(u)));
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.anisotropy = 8;
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  progress('Trải đường, lát gạch vỉa hè');
  await pause();
  const sky = buildSky(scene, renderer);
  const terrain = buildTerrain(scene, { grass, waterNormals });
  progress('Xây nhà ống, lợp ngói');
  await pause();
  const buildings = buildBuildings(scene, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  progress('Trồng cây, kéo dây điện');
  await pause();
  const trees = buildTrees(scene);
  const detail = buildDetail(scene, { boxes: buildings.boxes, radius: TIER.detail });
  const props = buildProps(scene);
  const movers = buildMovers(scene, { barrier: terrain.barrier });
  progress('Gọi mọi người ra đường');
  const rigs = await loadRigs();
  const people = buildPeople(scene, rigs, $('bubbles'), { skinned: TIER.skinned, budget: TIER.budget, renderer: TIER.post ? renderer : null, seats: SEATS });
  const { ponds } = blockers(PLACES, OPEN_KINDS);
  const body = createAvatar(rigs);
  const actions = { run: () => {} }; // filled in once the page knows what greeting, sitting and the mode button do
  const controls = createControls({ camera, dom: canvas, body, scene, index: boxGrid(buildings.boxes), ponds, onAction: (name) => actions.run(name) });
  controls.joystick($('stick'), 'move');
  controls.joystick($('stick2'), 'look');
  const shadows = createShadows({ scene, camera, tier: TIER, sun: sky.sun });
  shadows.adopt(scene);
  return { sky, terrain, buildings, trees, props, movers, people, controls, rigs, body, actions, shadows, detail };
}

// ---------------- the simulation clock ----------------
function advance(now) {
  const gap = now - state.last;
  state.last = now;
  if (gap > 1000) { state.world = { ...state.world, minute: state.world.minute + (gap / 1000) * RATE }; state.prev = state.world; state.acc = 0; return 0; }
  state.acc += gap;
  let steps = 0;
  while (state.acc >= STEP_MS && steps < 40) {
    state.prev = state.world;
    state.world = stepWorld(state.world);
    state.acc -= STEP_MS;
    steps += 1;
  }
  if (steps === 40) state.acc = 0;
  return gap / 1000;
}

const PARTS = [[5, 'Sáng sớm'], [8, 'Sáng'], [11, 'Trưa'], [13.5, 'Chiều'], [18, 'Tối'], [22, 'Đêm']];
function showClock() {
  const h = hourOf(state.world.minute);
  const part = [...PARTS].reverse().find(([from]) => h >= from)?.[1] ?? 'Đêm';
  const text = `${part} · ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  if ($('clock').textContent !== text) $('clock').textContent = text;
}

/** E: say hello to the nearest neighbour, who stops, turns to you, waves and answers. */
function greet(people, controls, now) {
  const me = controls.state.pos;
  const who = nearestPerson(people.near.filter((p) => p.a), me.x, me.z, GREET_REACH);
  if (!who) { state.said = [{ text: 'Có ai ở đây không?', until: now + 2200, who: 'me' }]; state.facing = null; return; }
  const [hello, reply] = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  people.react(who.key, { x: me.x, z: me.z }, 3);
  state.facing = { key: who.key, until: now + 3400 }; // your head turns to them while you talk
  state.said = [{ text: hello, until: now + 2600, who: 'me' }, { text: reply, from: now + 900, until: now + 3800, who: who.key, name: who.a.name }];
}

/** Whom your head turns to: the neighbour you greeted, else whoever is talking within a few steps. */
function eyesOn(near, controls, now) {
  const me = controls.state.pos;
  const greeted = state.facing && now < state.facing.until ? near.find((p) => p.key === state.facing.key) : null;
  const talking = greeted ?? nearestPerson(near.filter((p) => p.a?.bubble && state.world.t >= p.a.bubble.from), me.x, me.z, 5);
  return talking ? { x: talking.X, y: (talking.slot?.root.position.y ?? 0) + 1.5, z: talking.Z } : null;
}

function bubblesNow(near, controls, now, me) {
  const out = [];
  const talking = state.said.some((b) => b.who === 'me' && now <= b.until);
  if (me.name && controls.state.mode === 'di' && !talking) out.push({ text: `★ ${me.name}`, X: controls.state.pos.x, Y: me.height + 0.3 + controls.avatar.position.y, Z: controls.state.pos.z, cls: 'tag' });
  for (const b of state.said) {
    if (now > b.until || (b.from && now < b.from)) continue;
    if (b.who === 'me') out.push({ text: b.text, X: controls.state.pos.x, Y: 2.15 + controls.avatar.position.y, Z: controls.state.pos.z, cls: 'mine' });
    else { const p = near.find((q) => q.key === b.who); if (p) out.push({ text: b.text, X: p.X, Y: 2.1, Z: p.Z }); }
  }
  if (state.announcement && now % 45000 < 9000) { // the loudspeaker reads out the ward's notice
    const loa = POLES.find((p) => p.loa);
    out.push({ text: `📢 ${state.announcement}`, X: toX(loa.x), Y: 8, Z: toZ(loa.y), cls: 'loa' });
  }
  return out;
}

// ---------------- go ----------------
const xom = await setup().catch((err) => {
  console.error(err);
  $('splash').classList.add('failed');
  progress('Trình duyệt này chưa dựng được xóm 3D (cần WebGL). Mời bạn thử trình duyệt khác.');
  return null;
});

if (xom) {
  const { sky, terrain, buildings, trees, props, movers, people, controls, rigs, body, actions, shadows, detail } = xom;
  const prefs = loadPrefs();
  const me = { name: null, look: null, entered: false, get height() { return body.height; } }; // this page's character
  body.set(choiceOf(initial(prefs)));
  document.body.classList.toggle('low', LOW);
  document.body.classList.toggle('live', LIVE);

  const music = createMusic({ hourOf: () => hourOf(state.world.minute), seed: daySeed(), weatherOf: () => state.world.weather?.kind ?? 'clear' });
  const showMusic = () => {
    $('music').setAttribute('aria-pressed', String(music.playing));
    $('music').textContent = music.playing ? '🎵 Tắt nhạc' : '🎵 Bật nhạc';
  };
  $('music').addEventListener('click', async () => { if (music.playing) music.stop(); else await music.start(); showMusic(); });
  if (LIVE) { // OBS lets sound start by itself; a normal browser holds it until the first click or tap
    music.start().then(showMusic).catch(() => {});
    document.addEventListener('pointerdown', () => music.unlock?.(), { once: true });
  }

  // the street's own sound: its own switch, started by a click (or by itself for a livestream)
  const sound = createSound();
  const showSound = () => {
    $('sound').setAttribute('aria-pressed', String(sound.on));
    $('sound').textContent = sound.on ? '🔊 Tắt tiếng phố' : '🔈 Tiếng phố';
  };
  $('sound').addEventListener('click', async () => { if (sound.on) sound.stop(); else await sound.start(); showSound(); });
  if (LIVE || params.get('tieng') === '1') sound.start().then(showSound).catch(() => {});
  const tinRoofs = buildings.boxes.filter((b) => b.roof === 'tin').map((b) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }));
  const loaPole = POLES.find((p) => p.loa);
  /** What the sound needs to know this frame (gathered only while it is on). */
  const hear = (dt, hour, weather, now) => {
    if (!sound.on) return;
    const walking = controls.state.mode === 'di' && !controls.state.fly;
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const ear = { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fz: fwd.z };
    const vehicles = [];
    const vendors = [];
    for (const a of state.world.agents) {
      if (a.kind === 'vehicle' && a.state === 'drive') {
        const kind = KIND_OF[a.painter] ?? 'cub';
        if (kind === 'bike' || kind === 'cyclo') continue; // pedalled: silent
        const X = toX(a.x);
        const Z = toZ(a.y);
        if (Math.hypot(X - ear.x, Z - ear.z) > 50) continue;
        const b = state.prev?.agents[a.i];
        vehicles.push({ id: a.i, x: X, z: Z, kind, speed: b ? (Math.hypot(a.x - b.x, a.y - b.y) * M) / (STEP_MS / 1000) : 0 });
      } else if (a.kind === 'vendor' && a.state === 'walk') {
        const X = toX(a.x);
        const Z = toZ(a.y);
        if (Math.hypot(X - ear.x, Z - ear.z) < 35) vendors.push({ id: a.i, x: X, z: Z });
      }
    }
    const me = controls.state.pos;
    const tin = tinRoofs.reduce((best, r) => (!best || Math.hypot(r.x - ear.x, r.z - ear.z) < Math.hypot(best.x - ear.x, best.z - ear.z) ? r : best), null);
    sound.update({
      ear, hour, weather, vehicles, vendors, dt,
      walk: walking && !controls.state.seat ? { phase: body.phase, speed: controls.state.speed, kind: surfaceKind((me.x - toX(0)) / M, (me.z - toZ(0)) / M) } : null,
      loa: { speaking: Boolean(state.announcement) && now % 45000 < 9000, x: toX(loaPole.x), y: 7, z: toZ(loaPole.y) },
      tin: tin && Math.hypot(tin.x - ear.x, tin.z - ear.z) < 40 ? tin : null,
    });
  };

  let hintTimer = 0;
  const hint = (text, ms = 9000) => {
    $('hint').textContent = text;
    $('hint').classList.remove('gone');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => $('hint').classList.add('gone'), ms);
  };
  /** 'di' walks (from `start` { spot, heading, seconds } with the camera flying in, else where you were looking); 'ngam' looks. */
  const setMode = (mode, start = null) => {
    if (mode === 'di' && start) controls.fly(start.spot, start.heading, start.seconds);
    else if (mode === 'di') controls.walk();
    else controls.look();
    document.body.classList.toggle('walking', mode === 'di');
    $('mode').textContent = mode === 'di' ? '🔭 Ngắm xóm' : '🚶 Đi dạo';
    $('who').hidden = !me.entered;
    hint(mode !== 'di' ? LOOK_HINT : TOUCH ? 'Cần trái để đi · cần phải (hoặc kéo màn hình) để nhìn quanh' : 'W A S D để đi · Shift chạy · bấm vào cảnh để khoá chuột (Esc thả) · E chào · C ngồi');
  };
  // the sprint's wider view and the camera's bob: on unless the visitor (or their system) said otherwise
  const showFeel = () => {
    $('feel').setAttribute('aria-pressed', String(controls.state.effects));
    $('feel').textContent = `🎥 ${TOUCH ? '' : 'Rung máy: '}${controls.state.effects ? 'bật' : 'tắt'}`;
  };
  controls.state.effects = !REDUCED && loadFeel();
  showFeel();
  $('feel').addEventListener('click', () => { controls.state.effects = !controls.state.effects; saveFeel(controls.state.effects); showFeel(); });
  // picture quality: automatic by the machine, or the visitor's own choice (kept in this browser; applied on a reload)
  let choice = CHOICE;
  const showQuality = () => { $('quality').textContent = `✨ Hình ảnh: ${TIER_LABEL[choice]}${choice === 'auto' ? ` (${TIER_LABEL[TIER_NAME]})` : ''}`; };
  showQuality();
  $('quality').addEventListener('click', () => {
    choice = nextChoice(choice);
    saveQuality(choice);
    showQuality();
    hint(choice === 'auto' || choice === TIER_NAME ? 'Đã lưu lựa chọn hình ảnh.' : 'Đã lưu. Tải lại trang để xóm dựng lại theo mức hình ảnh mới.', 6000);
  });

  const remote = new Map(); // guest id -> the last places they said they were (net-move.js)
  let sent = null; // the last place this page said it was
  const session = createSession({
    enabled: !params.get('troi'), // ?troi= tests a weather: the server's must not replace it
    onMoves(list) { // ten times a second: where the walking visitors are
      const at = performance.now();
      for (const [id, x, y, h, a] of list) if (id !== session.me) remote.set(id, pushMove(remote.get(id) ?? [], { t: at, x, y, h, a }));
    },
    onData(data) {
      for (const g of data.guests) if (typeof g.x === 'number' && !remote.has(g.id) && g.id !== session.me) remote.set(g.id, [{ t: performance.now(), x: g.x, y: g.y, h: g.h ?? 0, a: 'idle' }]);
      for (const id of remote.keys()) if (!data.guests.some((g) => g.id === id)) remote.delete(id); // gone home
      state.world = syncGuests(state.world, data.guests);
      if (data.weather) state.world = setWeather(state.world, data.weather);
      const online = Number(data.online) || 0;
      $('online').hidden = online < 1;
      $('online').textContent = `👀 ${online.toLocaleString('vi-VN')} người đang xem`;
      state.announcement = typeof data.announcement === 'string' ? data.announcement : null;
    },
    onHello(wasIn) { if (wasIn && me.name) session.join(me.name, me.look); }, // the stream dropped and came back: come home again quietly
    onKicked() { me.entered = false; me.name = null; setMode('ngam'); hint('Bạn đã được mời ra khỏi xóm. Lát nữa quay lại nhé.'); },
    onDown() { $('online').hidden = true; },
  });

  const title = createTitle({
    rigs, prefs, low: LOW, reduced: REDUCED,
    async enter(wanted) {
      const result = await session.join(wanted.name, wanted.look);
      return result.offline ? { ok: true, name: wanted.name, look: wanted.look } : result; // no stream: walk alone
    },
    entered(choice, name, stored) {
      savePrefs(stored);
      Object.assign(me, { name, look: choice.look, entered: true });
      body.set(choice);
      shadows.adopt(scene); // new clothes are new materials
      const door = doorFor(name, PLACES, NODES);
      setMode('di', { spot: { x: toX(door.x), z: toZ(door.y) }, heading: door.heading, seconds: REDUCED ? 0 : FLY_SECONDS });
      body.wave(2.4);
      if (!session.me) hint('Chưa nối được với xóm: bạn vẫn đi dạo được, nhưng người khác chưa thấy bạn.');
    },
    watch() { setMode('ngam'); },
  });
  const toggle = () => {
    if (title.isOpen) return;
    if (!me.entered) title.open();
    else setMode(controls.state.mode === 'di' ? 'ngam' : 'di');
  };
  $('mode').addEventListener('click', toggle);
  $('who').addEventListener('click', () => { controls.unlock(); title.open(); });
  /** C, or the stool button: sit on the nearest free plastic stool, or get up. */
  const sitDown = () => {
    if (controls.state.seat) { controls.sit(null); return; }
    const me = controls.state.pos;
    const taken = [...extrasAt(EXTRAS, hourOf(state.world.minute), state.world.t, state.world.weather?.kind ?? 'clear'), ...state.world.agents.filter((a) => a.state === 'stay')];
    const seat = nearestSeat(SEATS, me.x, me.z, taken);
    if (seat) { controls.sit(seat); hint(TOUCH ? 'Đẩy cần trái để đứng dậy' : 'Bấm C hoặc bước đi để đứng dậy', 4000); }
    else hint('Lại gần một chiếc ghế nhựa còn trống rồi ngồi nhé.', 3500);
  };
  actions.run = (name) => {
    if (title.isOpen) return;
    if (name === 'menu') { toggle(); return; }
    if (controls.state.mode !== 'di' || controls.state.fly) return;
    if (name === 'greet') { body.wave(); greet(people, controls, performance.now()); }
    if (name === 'sit') sitDown();
  };
  $('act-greet').addEventListener('click', () => actions.run('greet'));
  $('act-sit').addEventListener('click', () => actions.run('sit'));
  if (params.get('che') === 'di') { me.entered = true; setMode('di'); } // straight into the street (tests, screenshots)
  else hint(LOOK_HINT);
  const wantsTitle = !LIVE && !params.has('che');

  const perf = params.get('perf') === '1' ? createPerf(renderer, document.querySelector('.stage'), scene) : null; // ?perf=1
  const focus = new THREE.Vector3();
  const [toMapX, toMapY] = [-toX(0) / M, -toZ(0) / M]; // metres back to map units
  let t = 0;
  let frames = 0;
  let wetness = 0;
  const frame = (now) => {
    perf?.begin(now);
    const dt = Math.min(0.1, advance(now));
    t += dt;
    const hour = hourOf(state.world.minute);
    const weather = state.world.weather?.kind ?? 'clear';
    controls.update(dt, now, controls.state.mode === 'di' ? eyesOn(people.near, controls, now) : null);
    focus.copy(controls.state.mode === 'di' ? controls.state.pos : controls.state.focus);
    const light = sky.update(hour, weather, focus, camera, t, dt);
    shadows.update(focus);
    people.ground(TIER.shadows === 'blob' ? 0.3 : 0.12 + light.dark * 0.16 + light.wet * 0.08);
    buildings.setNight(light.dark, t);
    people.rain(light.rain > 0);
    props.setNight(light.dark);
    props.tick(t);
    trees.tick(t);
    terrain.water.userData.tick(t);
    wetness += (light.wet - wetness) * Math.min(1, dt * 0.25); // the ground takes a while to soak and to dry
    setSurfaceWeather(STOP_AFTER ? light.wet : wetness, light.rain, t);
    const alpha = state.acc / STEP_MS;
    const extras = extrasAt(EXTRAS, hour, state.world.t, weather);
    const riders = movers.update(state.world, state.prev, alpha, now, dt, people.riding);
    const walkingNow = controls.state.mode === 'di' && !controls.state.fly;
    if (walkingNow && me.entered && session.me) { // tell the others where you are (the server checks it and passes it on)
      const here = { x: controls.state.pos.x / M + toMapX, y: controls.state.pos.z / M + toMapY, h: controls.state.heading, a: controls.state.anim.name };
      if (shouldSend(sent, here, now) && session.move(here)) sent = { ...here, at: now };
    }
    people.update(state.world, state.prev, alpha, extras, camera, focus, dt, session.me, title.isOpen ? [] : bubblesNow(people.near, controls, now, me), {
      riders: walkingNow ? riders : [], avoid: walkingNow ? controls.state.pos : null,
      remoteOf: (id) => { const buf = remote.get(id); return buf ? sampleMoves(buf, now, Infinity) : null; }, light: (1 - light.dark * 0.72) * (1 - light.wet * 0.15),
    });
    detail.update(focus.x, focus.z, t, light.dark);
    hear(dt, hour, weather, now);
    post.setLook(lookAt(light));
    if (!STOP_AFTER && frames > 180 && document.visibilityState === 'visible') { // a machine that cannot keep up sheds load (quality.js)
      const before = load.level;
      load = adapt(load, dt * 1000, dt);
      if (load.level !== before) { post.shed(shed(TIER, load.level)); resize(); }
    }
    post.render(dt);
    title.update(dt);
    showClock();
    perf?.end();
    frames += 1;
    if (frames === 3) { $('splash').classList.add('gone'); if (wantsTitle) title.open(); }
    if (frames === 6) { // the small marks of the street come after the first picture, not before it
      const decals = buildDecals(scene, {
        houses: buildings.boxes, kerb: KERB,
        road: { points: ROAD_LINE.map((p) => ({ x: toX(p.x), z: toZ(p.y) })), half: ROAD_HALF * M },
        trees: PLACES.filter((p) => p.kind === 'cayBang' || p.kind === 'cayPhuong').map((p) => ({ x: toX(p.x + p.w / 2), z: toZ(p.front) })),
      });
      shadows.adopt(decals.mesh);
    }
    if (STOP_AFTER && frames >= STOP_AFTER) { if (perf) document.body.dataset.perf = JSON.stringify({ ...perf.snapshot(), sound: sound.level(), detail: detail.built, people: people.shown }); document.body.dataset.ready = '1'; return; } // ?dung=N: freeze (for screenshots)
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
