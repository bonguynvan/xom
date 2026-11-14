// Everything the visitor does with their hands, gathered into one reading per frame: keys, the mouse (dragged,
// or locked to the view on a desktop), two on-screen sticks on a phone (left walks, right looks), a gamepad
// (left stick walks, right looks, A greets, X sits, B or RT runs, Start changes mode). player.js decides what
// the reading means.
import { pressed, readPad } from './gamepad.js';

const DRAG = { yaw: 0.005, pitch: 0.004 }; // radians per pixel dragged
const LOCKED = 0.0024; // radians per pixel with the mouse locked
const STICK_LOOK = { yaw: 2.6, pitch: 1.5 }; // radians per second at full push

/**
 * `dom` is the canvas; `canLock()` says whether a click may lock the mouse (walking, not flying);
 * `onAction(name)` gets 'greet', 'sit' and 'menu'.
 */
export function createInput({ dom, canLock = () => false, onAction = () => {} }) {
  const keys = new Set();
  const pointers = new Map();
  const sticks = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
  let pinch = 0;
  let acc = { yaw: 0, pitch: 0, panX: 0, panY: 0, zoom: 1 }; // gathered since the last reading
  let touched = -Infinity; // performance.now() of the last input of any kind
  let pad = readPad(null);
  const titled = () => document.body.classList.contains('titled'); // the title screen has the keys and the pad
  const locked = () => document.pointerLockElement === dom;
  const touch = () => { touched = performance.now(); };

  dom.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.joystick')) return;
    if (!locked()) { try { dom.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ } }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, moved: 0, mouse: e.pointerType === 'mouse' });
    touch();
  });
  dom.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || locked()) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    p.moved += Math.abs(dx) + Math.abs(dy);
    touch();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) acc.zoom *= pinch / d;
      pinch = d;
      return;
    }
    if (p.button === 2 || e.shiftKey) { acc.panX += dx; acc.panY += dy; } else { acc.yaw += dx * DRAG.yaw; acc.pitch += dy * DRAG.pitch; }
  });
  const end = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    pinch = 0;
    // a plain click (not a drag) on a desktop while walking: hold the mouse, so looking round needs no button
    if (p && e.type === 'pointerup' && p.mouse && p.button === 0 && p.moved < 5 && !locked() && canLock()) dom.requestPointerLock?.();
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    if (!locked()) return;
    acc.yaw += e.movementX * LOCKED;
    acc.pitch += e.movementY * LOCKED;
    touch();
  });
  dom.addEventListener('wheel', (e) => { e.preventDefault(); acc.zoom *= Math.exp(e.deltaY * 0.0012); touch(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, dialog') || titled()) return;
    if (!e.repeat) {
      if (e.code === 'KeyE') onAction('greet');
      if (e.code === 'KeyC') onAction('sit');
      if (e.code === 'KeyF') onAction('menu');
    }
    keys.add(e.code);
    if (e.code === 'Equal' || e.code === 'NumpadAdd') acc.zoom *= 0.8;
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') acc.zoom *= 1.25;
    touch();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  /** An on-screen stick for touch: `which` = 'move' (walk that way, further = faster) or 'look'. */
  function joystick(el, which = 'move') {
    const knob = el.querySelector('.knob');
    let id = null;
    let cx = 0;
    let cy = 0;
    const move = (e) => {
      if (e.pointerId !== id) return;
      const r = el.getBoundingClientRect().width / 2;
      let x = (e.clientX - cx) / r;
      let y = (e.clientY - cy) / r;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      sticks[which] = { x, y };
      knob.style.transform = `translate(${x * r * 0.6}px, ${y * r * 0.6}px)`;
      touch();
    };
    el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
    el.addEventListener('pointermove', move);
    const stop = (e) => { if (e.pointerId !== id) return; id = null; sticks[which] = { x: 0, y: 0 }; knob.style.transform = ''; };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  }

  /**
   * This frame's reading: { x, z } the push (right +, back +; length 0..1), `analog` (true when it came from a
   * stick, so its length is a speed), `run`, `yaw`/`pitch` (radians to turn the view by), `panX`/`panY`
   * (pixels, the overview), `zoom` (a factor), `looked` (the view was turned by hand).
   */
  function read(dt) {
    const now = titled() ? readPad(null) : readPad(navigator.getGamepads?.()[0] ?? null);
    const hit = pressed(pad, now);
    pad = now;
    if (hit.confirm) onAction('greet');
    if (hit.sit) onAction('sit');
    if (hit.menu) onAction('menu');
    const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const kz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
    const sx = sticks.move.x + now.x;
    const sz = sticks.move.y + now.y;
    const analog = kx === 0 && kz === 0 && Math.hypot(sx, sz) > 0;
    let x = kx + sx;
    let z = kz + sz;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    const lx = sticks.look.x + now.rx;
    const ly = sticks.look.y + now.ry;
    if (lx || ly || now.x || now.y) touch();
    const out = {
      x, z, analog,
      run: keys.has('ShiftLeft') || keys.has('ShiftRight') || now.run || Math.hypot(sticks.move.x, sticks.move.y) > 0.94,
      yaw: acc.yaw + lx * STICK_LOOK.yaw * dt, pitch: acc.pitch + ly * STICK_LOOK.pitch * dt,
      panX: acc.panX, panY: acc.panY, zoom: acc.zoom,
      looked: acc.yaw !== 0 || acc.pitch !== 0 || lx !== 0 || ly !== 0,
    };
    acc = { yaw: 0, pitch: 0, panX: 0, panY: 0, zoom: 1 };
    return out;
  }

  return {
    read, joystick,
    get touched() { return touched; },
    get locked() { return locked(); },
    unlock() { if (locked()) document.exitPointerLock?.(); },
  };
}
