// ?perf=1: a small overlay with the numbers the budgets are written in (fps, CPU ms per frame, draw calls,
// triangles, textures, geometries, JS heap). The maths is pure (tested); only createPerf touches the page.

const WINDOW = 120; // frames kept: two seconds at 60 fps

/** A rolling window of samples: returns a new array, never longer than `size`. */
export const pushSample = (samples, value, size = WINDOW) => (samples.length >= size ? [...samples.slice(samples.length - size + 1), value] : [...samples, value]);

/** Mean, 95th percentile and worst of a list of milliseconds. */
export function summarise(samples) {
  if (samples.length === 0) return { avg: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  return { avg, p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], max: sorted[sorted.length - 1] };
}

/** Frames per second from the gaps between frames (ms). */
export const fpsOf = (gaps) => { const { avg } = summarise(gaps); return avg > 0 ? 1000 / avg : 0; };

const one = (n) => (Math.round(n * 10) / 10).toFixed(1);
const big = (n) => (n >= 1e6 ? `${one(n / 1e6)} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : String(Math.round(n)));

/** The numbers as one flat record (also what ?dung=N leaves in body[data-perf] for headless runs). */
export function report({ gaps, cpu, calls, triangles, textures, geometries, heap }) {
  const c = summarise(cpu);
  return {
    fps: Math.round(fpsOf(gaps) * 10) / 10, frameMs: Math.round(summarise(gaps).avg * 100) / 100,
    cpuMs: Math.round(c.avg * 100) / 100, cpuP95: Math.round(c.p95 * 100) / 100, cpuMax: Math.round(c.max * 100) / 100,
    calls, triangles, textures, geometries, heapMB: heap ? Math.round(heap / 1048576) : null,
  };
}

/** The overlay's lines of text. */
export function linesOf(r) {
  return [
    `${one(r.fps)} fps · ${one(r.frameMs)} ms`,
    `CPU ${one(r.cpuMs)} ms (p95 ${one(r.cpuP95)}, max ${one(r.cpuMax)})`,
    `${r.calls} lần vẽ · ${big(r.triangles)} tam giác`,
    `${r.textures} texture · ${r.geometries} geometry`,
    r.heapMB === null ? 'heap: trình duyệt không cho đo' : `heap ${r.heapMB} MB`,
  ];
}

/** The heaviest things in a scene: triangles per mesh (times its instances), biggest first. Reads, never changes. */
export function heaviest(scene, top = 12) {
  const rows = [];
  scene.traverse((o) => {
    if (!o.visible || !(o.isMesh || o.isPoints || o.isLine) || !o.geometry) return;
    const g = o.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
    const copies = o.isInstancedMesh ? o.count : 1;
    rows.push({ name: o.name || o.parent?.name || o.type, tris: Math.round(tris * copies), copies, shadow: Boolean(o.castShadow) });
  });
  return rows.sort((a, b) => b.tris - a.tris).slice(0, top);
}

/** Where the draw calls come from: per top-level group, how many meshes are drawn and how many of them cast a shadow. */
export function breakdown(scene) {
  const rows = new Map();
  const walk = (o, top, shown) => {
    const on = shown && o.visible;
    if (on && (o.isMesh || o.isPoints || o.isLine) && o.geometry) {
      const row = rows.get(top) ?? { name: top, meshes: 0, casters: 0 };
      row.meshes += 1;
      if (o.castShadow) row.casters += 1;
      rows.set(top, row);
    }
    for (const c of o.children) walk(c, top, on);
  };
  for (const c of scene.children) walk(c, c.name || c.type, true);
  return [...rows.values()].sort((x, y) => y.meshes - x.meshes);
}

/**
 * The overlay. begin(now) at the top of a frame, end() after the render; the text is refreshed twice a second.
 * renderer.info is reset by hand so every pass of a frame (shadows, the pond's reflection) is counted.
 */
export function createPerf(renderer, host, scene = null) {
  const box = document.createElement('pre');
  box.className = 'perf';
  box.setAttribute('aria-hidden', 'true');
  host.append(box);
  renderer.info.autoReset = false;
  let gaps = [];
  let cpu = [];
  let last = 0;
  let started = 0;
  let shown = 0;
  const snapshot = () => report({
    gaps, cpu, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, heap: performance.memory?.usedJSHeapSize,
  });
  return {
    begin(now) {
      if (last) gaps = pushSample(gaps, now - last);
      last = now;
      started = performance.now();
      renderer.info.reset();
    },
    end() {
      const now = performance.now();
      cpu = pushSample(cpu, now - started);
      if (now - shown < 500) return;
      shown = now;
      box.textContent = linesOf(snapshot()).join('\n');
    },
    snapshot: () => ({ ...snapshot(), ...(scene ? { heaviest: heaviest(scene), breakdown: breakdown(scene) } : {}) }),
  };
}
