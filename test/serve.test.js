import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADERS, handler, resolvePath } from '../scripts/serve.js';

test('paths stay inside public/', () => {
  assert.match(resolvePath('/'), /index\.html$/);
  assert.match(resolvePath('/js/main.js?v=1'), /main\.js$/);
  const publicDir = resolve(fileURLToPath(new URL('../public', import.meta.url)));
  for (const evil of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/%2e%2e/etc/passwd', '/js/..\\..\\package.json', '/%00', '/%E0%A4%A']) {
    const file = resolvePath(evil);
    assert.ok(file === null || file.startsWith(publicDir + sep), `${evil} -> ${file}`);
  }
});

test('production (deploy/xom.caddy) sends the same CSP as the dev server', () => {
  const caddy = readFileSync(new URL('../deploy/xom.caddy', import.meta.url), 'utf8');
  const csp = caddy.match(/Content-Security-Policy "([^"]+)"/)?.[1];
  assert.equal(csp, HEADERS['Content-Security-Policy']);
});

test('serves the page with a strict CSP and refuses traversal and writes', async (t) => {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('content-security-policy'), HEADERS['Content-Security-Policy']);
  assert.match(await page.text(), /Xóm/);

  assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
  const og = await fetch(`${base}/og.jpg`);
  assert.equal(og.status, 200, 'the share image');
  assert.equal(og.headers.get('content-type'), 'image/jpeg');
  assert.equal((await fetch(`${base}/js`)).status, 404);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
});
