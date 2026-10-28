import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, createWeather } from '../scripts/weather.js';

test('Open-Meteo readings become the xóm weather', () => {
  assert.equal(classify({ weather_code: 0, temperature_2m: 27, cloud_cover: 10, precipitation: 0 }), 'clear');
  assert.equal(classify({ weather_code: 61, temperature_2m: 25, precipitation: 1.2 }), 'rain');
  assert.equal(classify({ weather_code: 2, temperature_2m: 26, precipitation: 0.5 }), 'rain', 'wet is wet whatever the code');
  assert.equal(classify({ weather_code: 95, temperature_2m: 30 }), 'storm');
  assert.equal(classify({ weather_code: 45, temperature_2m: 18 }), 'fog');
  assert.equal(classify({ weather_code: 1, temperature_2m: 35.5 }), 'hot');
  assert.equal(classify({ weather_code: 1, temperature_2m: 12 }), 'cold');
  assert.equal(classify({ weather_code: 3, temperature_2m: 24 }), 'cloudy');
  assert.equal(classify(undefined), 'clear');
});

test('the server keeps the last weather, tells when it changes, and survives a failed fetch', async () => {
  let reply = { ok: true, json: async () => ({ current: { weather_code: 63, temperature_2m: 24.6, precipitation: 2 } }) };
  const changes = [];
  const w = createWeather({ fetchImpl: async () => reply, onChange: (x) => changes.push(x.kind) });
  await w.refresh();
  assert.deepEqual(w.get(), { kind: 'rain', tempC: 25 });
  reply = { ok: false, status: 503, json: async () => ({}) };
  const quiet = console.error;
  console.error = () => {};
  await w.refresh();
  console.error = quiet;
  assert.deepEqual(w.get(), { kind: 'rain', tempC: 25 }, 'a failure keeps what we had');
  assert.deepEqual(changes, ['rain']);
});
