// The page: runs the xóm in a fixed-step loop and draws it. Mostly for watching: drag to look around,
// wheel or pinch to zoom; left alone, the camera strolls by itself.
import { clampView, drift, fit, panBy, wheelPixels, zoomAt } from './camera.js';
import { hourOf } from './map.js';
import { renderFrame } from './render.js';
import { GUEST_LOOKS, cleanName, randomName } from './guests.js';
import { createMusic } from './music.js';
import { STEP_MS, createWorld, setWeather, stepWorld, syncGuests } from './world.js';

const MAX_STEPS_PER_FRAME = 40; // only guards a slow frame
const MAX_GAP_MS = 1000; // a longer pause means the tab was hidden or asleep
const IDLE_BEFORE_DRIFT_MS = 6000;
const KEY_PAN = 60; // css px per arrow press

const $ = (id) => document.getElementById(id);
const canvas = $('street');
const ctx = canvas.getContext('2d', { alpha: false });
const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }); // building bitmaps

const VN_OFFSET_MS = 7 * 3600 * 1000;
/** Now in Vietnam (UTC+7), whatever the visitor's own time zone: read it with the getUTC* methods. */
const vnNow = () => new Date(Date.now() + VN_OFFSET_MS);
const vnMinute = (d = vnNow()) => d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
const daySeed = (d = vnNow()) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
/** Real time unless the address asks to fast-forward (?tua=60: a minute of xóm per second). */
const RATE = Math.max(1 / 60, Math.min(600, Number(new URLSearchParams(location.search).get('tua')) / 60 || 1 / 60));

const state = {
  world: createWorld({ seed: daySeed(), minute: vnMinute(), rate: RATE }),
  prev: null,
  acc: 0,
  last: performance.now(),
  view: null,
  limits: null,
  driftDir: 1,
  lastInput: -Infinity,
  announcement: null,
  sid: null, // this page's private id on the live stream (needed to join)
  me: null, // this page's visitor id once it has come home to the xóm
  guests: [],
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const limits = fit(canvas.width, canvas.height);
  const old = state.view;
  // Keep looking at the same middle of the map, at the same zoom relative to the window.
  const zoom = old && state.limits ? old.scale / state.limits.start : 1;
  const scale = Math.max(limits.min, Math.min(limits.max, limits.start * zoom));
  const cx = old ? old.camX + old.w / old.scale / 2 : 700;
  const cy = old ? old.camY + old.h / old.scale / 2 : 330;
  state.limits = limits;
  state.view = clampView({ w: canvas.width, h: canvas.height, dpr, makeCanvas, scale, camX: cx - canvas.width / scale / 2, camY: cy - canvas.height / scale / 2 });
}

/** The world's minute moved to `target` (a minute of the day), forwards or back by the shortest way round. */
function clockAt(world, target) {
  const day = 24 * 60;
  const shift = ((((target - world.minute) % day) + day * 1.5) % day) - day / 2;
  return { ...world, minute: world.minute + shift };
}

const REALTIME = RATE === 1 / 60;
const RESYNC_MINUTES = 1; // in real time, a clock that drifts further than this is put right

/**
 * Step the world for the real time that passed. A hidden tab gets no frames: when it comes back the gap
 * is not simulated step by step (that could be hours) but the clock jumps, so the xóm keeps the right time.
 */
function advance(now) {
  const gap = now - state.last;
  state.last = now;
  if (gap > MAX_GAP_MS) {
    state.world = REALTIME ? clockAt(state.world, vnMinute()) : { ...state.world, minute: state.world.minute + (gap / 1000) * RATE };
    state.prev = state.world;
    state.acc = 0;
    return 0;
  }
  if (REALTIME && Math.abs(state.world.minute % (24 * 60) - vnMinute()) > RESYNC_MINUTES
    && Math.abs(state.world.minute % (24 * 60) - vnMinute()) < 24 * 60 - RESYNC_MINUTES) {
    state.world = clockAt(state.world, vnMinute());
  }
  const real = gap;
  state.acc += real;
  let steps = 0;
  while (state.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    state.prev = state.world;
    state.world = stepWorld(state.world);
    state.acc -= STEP_MS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_FRAME) state.acc = 0;
  return real;
}

function frame(now) {
  const real = advance(now);
  if (now - state.lastInput > IDLE_BEFORE_DRIFT_MS && !reducedMotion.matches) {
    const next = drift(state.view, state.driftDir, real);
    state.view = next.view;
    state.driftDir = next.dir;
  }
  renderFrame(ctx, withAnnouncement(state.world, now), state.prev, state.acc / STEP_MS, { ...state.view, me: state.me });
  showClock();
  requestAnimationFrame(frame);
}

const TICKER_SPEED = 45; // css px per second
const READ_EVERY_MS = 45000; // the loudspeaker on its pole reads the admin's notice out now and then
const READ_FOR_MS = 9000;
/** Let the map's loudspeaker read the admin's announcement (when it is not busy with its own). */
function withAnnouncement(world, now) {
  if (!state.announcement || world.broadcast || now % READ_EVERY_MS > READ_FOR_MS) return world;
  return { ...world, broadcast: { text: state.announcement } };
}

const PARTS = [[5, 'Sáng sớm'], [8, 'Sáng'], [11, 'Trưa'], [13.5, 'Chiều'], [18, 'Tối'], [22, 'Đêm']];
function showClock() {
  const hour = hourOf(state.world.minute);
  const part = [...PARTS].reverse().find(([h]) => hour >= h)?.[1] ?? 'Đêm';
  const text = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')} · ${part}`;
  if ($('clock').textContent !== text) $('clock').textContent = text;
}

function touched() {
  state.lastInput = performance.now();
  $('hint').classList.add('gone');
}

// ---------------- input: drag to look around, wheel or pinch to zoom ----------------

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointers = new Map();
const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * state.view.dpr, y: (e.clientY - r.top) * state.view.dpr }; };

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  touched();
  pointers.set(e.pointerId, local(e));
  try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  touched();
  const before = pointers.get(e.pointerId);
  const now = local(e);
  if (pointers.size === 1) {
    state.view = panBy(state.view, now.x - before.x, now.y - before.y);
  } else {
    // two fingers: zoom by their spread, and move with their midpoint
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
    const factor = Math.hypot(now.x - other.x, now.y - other.y) / Math.max(1, Math.hypot(before.x - other.x, before.y - other.y));
    const mid = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
    state.view = panBy(zoomAt(state.view, factor, mid.x, mid.y, state.limits), (now.x - before.x) / 2, (now.y - before.y) / 2);
  }
  pointers.set(e.pointerId, now);
});
const release = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size === 0) canvas.classList.remove('dragging');
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
window.addEventListener('blur', () => { pointers.clear(); canvas.classList.remove('dragging'); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  touched();
  const at = local(e);
  state.view = zoomAt(state.view, Math.exp(-wheelPixels(e) / 500), at.x, at.y, state.limits);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // leave the browser's own zoom alone
  const pan = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  const zoom = { '+': 1.25, '=': 1.25, '-': 0.8 }[e.key];
  if (!pan && !zoom) return;
  touched();
  const d = KEY_PAN * state.view.dpr;
  if (pan) state.view = panBy(state.view, pan[0] * d, pan[1] * d);
  if (zoom) state.view = zoomAt(state.view, zoom, state.view.w / 2, state.view.h / 2, state.limits);
});

// ---------------- who else is watching (and any notice from the admin) ----------------

function listen() {
  if (!('EventSource' in window)) return;
  const source = new EventSource('/api/live');
  source.addEventListener('hello', (event) => {
    try { state.sid = JSON.parse(event.data).sid; } catch { return; }
    state.me = null; // a new stream (first load or after a drop): the server has forgotten us, join again
    showJoin();
  });
  source.addEventListener('kicked', () => {
    state.me = null;
    showJoin();
    $('hint').textContent = 'Bạn đã được mời ra khỏi xóm. Lát nữa quay lại nhé.';
    $('hint').classList.remove('gone');
  });
  source.addEventListener('message', (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    state.guests = Array.isArray(data.guests) ? data.guests : [];
    state.world = syncGuests(state.world, state.guests);
    if (data.weather) state.world = setWeather(state.world, data.weather);
    if (state.me && !state.guests.some((g) => g.id === state.me)) { state.me = null; showJoin(); }
    const online = Number(data.online) || 0;
    $('online').hidden = online < 1;
    $('online').textContent = `👀 ${online.toLocaleString('vi-VN')} người đang xem`;
    state.announcement = typeof data.announcement === 'string' ? data.announcement : null;
    const maintenance = data.maintenance ? 'Xóm đang bảo trì một chút, mọi thứ vẫn chạy nhưng có thể khựng lại.' : '';
    const text = [state.announcement, maintenance].filter(Boolean).join('   ·   ');
    $('loa').hidden = !text;
    if ($('loa-text').textContent !== text) {
      $('loa-text').textContent = text;
      // A gentle, steady crawl whatever the length: the text travels the window plus itself at TICKER_SPEED.
      const distance = $('loa-text').offsetWidth;
      $('loa-text').style.animationDuration = `${Math.max(10, distance / TICKER_SPEED)}s`; // CSSOM: allowed by the CSP
    }
  });
  source.addEventListener('error', () => { $('online').hidden = true; $('join').hidden = true; }); // EventSource retries by itself
}
listen();

// ---------------- coming home to the xóm ----------------

const PREFS_KEY = 'xom.guest';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}; } catch { return {}; } };
const savePrefs = (prefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode: fine */ } };

function showJoin() {
  $('join').hidden = !state.sid;
  $('join').textContent = state.me ? '🚪 Rời xóm' : '🏠 Về xóm';
  $('join').setAttribute('aria-pressed', String(Boolean(state.me)));
  $('find-me').hidden = !state.me;
}

function buildLooks(chosen) {
  $('join-looks').replaceChildren(...GUEST_LOOKS.map((look) => {
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'look', value: look.id, checked: look.id === chosen });
    const label = document.createElement('label');
    label.append(input, Object.assign(document.createElement('span'), { textContent: look.label }));
    return label;
  }));
}

function openJoin() {
  const prefs = loadPrefs();
  $('join-name').value = prefs.name ?? randomName();
  buildLooks(prefs.look ?? GUEST_LOOKS[Math.floor(Math.random() * GUEST_LOOKS.length)].id);
  $('join-error').hidden = true;
  $('join-dialog').showModal();
  $('join-name').select();
}

async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

/** Walk the camera over to this page's character (and zoom in enough to see it). */
function findMe() {
  const me = state.world.agents.find((a) => a.guestId === state.me && a.state !== 'gone');
  if (!me) return;
  touched();
  const scale = Math.min(state.limits.max, Math.max(state.view.scale, state.limits.start * 2.2));
  state.view = clampView({ ...state.view, scale, camX: me.x - state.view.w / scale / 2, camY: me.y - state.view.h / scale / 2 });
}

$('join').addEventListener('click', async () => {
  if (!state.me) { openJoin(); return; }
  await post('/api/leave', { sid: state.sid }).catch(() => {});
  state.me = null;
  showJoin();
});
$('find-me').addEventListener('click', findMe);
$('join-cancel').addEventListener('click', () => $('join-dialog').close());
$('join-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = cleanName($('join-name').value);
  const look = new FormData($('join-form')).get('look');
  const fail = (message) => { $('join-error').textContent = message; $('join-error').hidden = false; };
  if (!name) return fail('Tên cần 2-24 chữ, không dùng từ tục hay từ cờ bạc nhé.');
  if (!look) return fail('Chọn một kiểu người nhé.');
  $('join-go').disabled = true;
  try {
    const { ok, body } = await post('/api/join', { sid: state.sid, name, look });
    if (!ok) return fail(body.error ?? 'Chưa vào được, thử lại nhé.');
    state.me = body.id;
    savePrefs({ name: body.name, look: body.look });
    $('join-dialog').close();
    showJoin();
    setTimeout(findMe, 1500); // once the server has told everyone (and us) that we are here
  } catch {
    fail('Mất kết nối, thử lại nhé.');
  } finally {
    $('join-go').disabled = false;
  }
});

// ---------------- music: lofi made in the browser, following the xóm's hour ----------------

const music = createMusic({ hourOf: () => hourOf(state.world.minute), seed: daySeed(), weatherOf: () => state.world.weather?.kind ?? 'clear' });
$('music').addEventListener('click', async () => {
  const on = !music.playing;
  $('music').setAttribute('aria-pressed', String(on));
  $('music').textContent = on ? '🎵 Tắt nhạc' : '🎵 Bật nhạc';
  try {
    if (on) await music.start(); else music.stop();
  } catch {
    $('music').textContent = '🎵 Không phát được nhạc';
  }
});

if (window.matchMedia('(pointer: coarse)').matches) $('hint').textContent = 'Kéo để xem quanh xóm · chụm hai ngón để phóng to';

new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame((now) => { state.last = now; frame(now); });
