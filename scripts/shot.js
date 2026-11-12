#!/usr/bin/env node
// Headless screenshots and ?perf=1 numbers, no dependencies: drives Chrome over the DevTools protocol.
//   node scripts/shot.js --out shots/ --size 1280x720 --frames 240 [--gpu] "/?gio=9" "/?gio=21&troi=rain" …
// Each path gets &dung=FRAMES&perf=1 added, is loaded from --base (default http://127.0.0.1:3500), and when the
// page sets body[data-ready] its picture is saved and its numbers printed as one JSON line.
// --do "js" runs once the splash has gone (click through a flow); --after MS then waits that long and takes the
// picture without waiting for ?dung (use with a large --frames). --name sets the file name. --seq N:MS takes N
// pictures MS apart after that (name-01.png …): a walk filmed frame by frame.
// --gpu uses the machine's GPU (real numbers on this machine); without it swiftshader (pictures only, slow).
// CHROME=/path/to/chrome overrides the browser.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const k = args.indexOf(`--${name}`); return k < 0 ? fallback : args.splice(k, 2)[1]; };
const has = (name) => { const k = args.indexOf(`--${name}`); if (k < 0) return false; args.splice(k, 1); return true; };
const out = flag('out', 'shots');
const [width, height] = flag('size', '1280x720').split('x').map(Number);
const frames = Number(flag('frames', 240));
const base = flag('base', 'http://127.0.0.1:3500');
const port = Number(flag('port', 9333));
const timeout = Number(flag('timeout', 600)) * 1000;
const gpu = has('gpu');
const act = flag('do', '');
const after = Number(flag('after', 0));
const named = flag('name', '');
const [seqCount, seqGap] = flag('seq', '0:0').split(':').map(Number);
const paths = args.length ? args : ['/'];
const CHROME = process.env.CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nameOf = (path) => `${named || (path.replace(/^\/\??/, '').replace(/[^a-z0-9.]+/gi, '-') || 'home')}-${width}x${height}.png`;

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.addEventListener('open', ok); ws.addEventListener('error', fail); });
  let id = 0;
  const waiting = new Map();
  const problems = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') problems.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((done) => { id += 1; waiting.set(id, done); ws.send(JSON.stringify({ id, method, params })); });
  return { send, problems, close: () => ws.close() };
}

const profile = mkdtempSync(join(tmpdir(), 'xom-shot-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  ...(gpu ? ['--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  'about:blank',
], { stdio: 'ignore' });

let failed = false;
try {
  mkdirSync(out, { recursive: true });
  let target;
  for (let k = 0; k < 100 && !target; k += 1) {
    await sleep(200);
    target = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).then((list) => list.find((t) => t.type === 'page')).catch(() => null);
  }
  if (!target) throw new Error('Chrome did not start');
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  if (width < 600) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); // a phone: (pointer: coarse), so the sticks show
  const evaluate = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true }).then((m) => m.result?.result?.value);
  for (const path of paths) {
    page.problems.length = 0;
    const url = `${base}${path}${path.includes('?') ? '&' : '?'}dung=${frames}&perf=1`;
    await page.send('Page.navigate', { url });
    const until = Date.now() + timeout;
    let ready = false;
    if (act || after) {
      let up = false;
      while (!up && Date.now() < until) { await sleep(300); up = await evaluate("Boolean(document.querySelector('#splash.gone'))"); }
      await sleep(600);
      if (act) await page.send('Runtime.evaluate', { expression: act, awaitPromise: true });
      await sleep(after);
      ready = up;
    }
    while (!ready && Date.now() < until) { await sleep(500); ready = (await evaluate('document.body && document.body.dataset.ready')) === '1'; }
    const perf = ready ? JSON.parse((await evaluate('document.body.dataset.perf')) || 'null') : null;
    const said = await evaluate("[document.querySelector('#name-error:not([hidden])'), document.querySelector('#hint:not(.gone)')].filter(Boolean).map((e) => e.textContent).join(' | ')");
    const renderer = await evaluate("(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; })()");
    for (let k = 1; k <= seqCount; k += 1) {
      const frame = await page.send('Page.captureScreenshot', { format: 'png' });
      if (frame.result?.data) writeFileSync(join(out, nameOf(path).replace(/\.png$/, `-${String(k).padStart(2, '0')}.png`)), Buffer.from(frame.result.data, 'base64'));
      await sleep(seqGap);
    }
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = join(out, nameOf(path));
    if (shot.result?.data) writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    if (!ready || page.problems.length) failed = true;
    console.log(JSON.stringify({ path, file, ready, said, renderer, perf, problems: page.problems.slice(0, 5) }));
  }
  page.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
