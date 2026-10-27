// Where the window looks on the map. Pure helpers so the maths is testable without a browser.
// A view is { w, h, scale, camX, camY }: map point (x, y) is drawn at ((x - camX) * scale, (y - camY) * scale).
import { MAP } from './map.js';

const MAX_ZOOM = 4; // times the starting scale

/** Zoom limits for a w × h canvas: start by filling the window, zoom out to see the whole map. */
export function fit(w, h) {
  const contain = Math.min(w / MAP.w, h / MAP.h);
  const cover = Math.max(w / MAP.w, h / MAP.h);
  return { min: contain, start: cover, max: cover * MAX_ZOOM };
}

/** Keep the map in view: centred when it is smaller than the window, otherwise no empty edges. */
export function clampView(view) {
  const axis = (cam, size, span) => (span >= size ? (size - span) / 2 : Math.max(0, Math.min(size - span, cam)));
  return { ...view, camX: axis(view.camX, MAP.w, view.w / view.scale), camY: axis(view.camY, MAP.h, view.h / view.scale) };
}

/** Zoom by `factor` keeping the map point under screen point (sx, sy) where it is. */
export function zoomAt(view, factor, sx, sy, limits) {
  const scale = Math.max(limits.min, Math.min(limits.max, view.scale * factor));
  const mx = view.camX + sx / view.scale;
  const my = view.camY + sy / view.scale;
  return clampView({ ...view, scale, camX: mx - sx / scale, camY: my - sy / scale });
}

export const panBy = (view, dx, dy) => clampView({ ...view, camX: view.camX - dx / view.scale, camY: view.camY - dy / view.scale });

/** The idle drift: a slow stroll left and right that turns around at either edge. */
export function drift(view, dir, dt, speed = 12) {
  const next = clampView({ ...view, camX: view.camX + dir * speed * (dt / 1000) });
  return { view: next, dir: next.camX === view.camX + dir * speed * (dt / 1000) ? dir : -dir };
}

/** Wheel distance in pixels: Firefox reports lines (deltaMode 1) or pages (2), Chromium pixels. */
export function wheelPixels(e) {
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  return delta * ([1, 32, 600][e.deltaMode] ?? 1);
}
