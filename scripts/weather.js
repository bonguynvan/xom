// The xóm's weather: Hà Nội's, fetched by the server every 15 minutes from Open-Meteo (free, no key, no
// visitor data: the browser never calls out) and shared with every page, so everyone sees the same sky.

export const HANOI = { latitude: 21.0285, longitude: 105.8542 };
const URL_BASE = 'https://api.open-meteo.com/v1/forecast';
const EVERY_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 8000;
export const KINDS = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'hot', 'cold'];

/** Open-Meteo's "current" block to one of KINDS (WMO weather codes). */
export function classify(current) {
  const code = Number(current?.weather_code);
  const temp = Number(current?.temperature_2m);
  const wet = Number(current?.precipitation) >= 0.2;
  if (code >= 95) return 'storm';
  if (wet || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (temp >= 33) return 'hot';
  if (temp <= 15) return 'cold';
  if (Number(current?.cloud_cover) >= 75 || code === 3) return 'cloudy';
  return 'clear';
}

/** Keeps the latest weather; calls onChange when it changes. Failures keep the last known weather. */
export function createWeather({ fetchImpl = fetch, onChange = () => {}, place = HANOI } = {}) {
  let current = { kind: 'clear', tempC: 28, at: 0 };
  const url = `${URL_BASE}?latitude=${place.latitude}&longitude=${place.longitude}`
    + '&current=temperature_2m,precipitation,weather_code,cloud_cover&timezone=Asia%2FHo_Chi_Minh';

  async function refresh() {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const next = { kind: classify(body.current), tempC: Math.round(Number(body.current?.temperature_2m) || current.tempC), at: Date.now() };
      const changed = next.kind !== current.kind || next.tempC !== current.tempC;
      current = next;
      if (changed) onChange(current);
    } catch (error) {
      console.error('Không lấy được thời tiết:', error.message);
    }
  }

  let timer = null;
  return {
    get: () => ({ kind: current.kind, tempC: current.tempC }),
    start() { refresh(); timer = setInterval(refresh, EVERY_MS); timer.unref?.(); },
    stop() { clearInterval(timer); },
    refresh,
  };
}
