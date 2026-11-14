// This page's link to the xóm's server: the live stream (weather, who is watching, the ward's notices, the
// visitors) and "coming home" (POST /api/join with the private id the stream gave us). The server is the
// authority on names and looks; nothing here is trusted by it. Also the stored choices (localStorage).
import { PREFS_KEY, readPrefs } from './select-state.js';

export const loadPrefs = () => { try { return readPrefs(localStorage.getItem(PREFS_KEY) ?? ''); } catch { return {}; } };
export const savePrefs = (prefs) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode: fine */ } };

const FEEL_KEY = 'xom.feel'; // '0' = no sprint zoom and no camera bob; anything else, or nothing, = on
export const loadFeel = () => { try { return localStorage.getItem(FEEL_KEY) !== '0'; } catch { return true; } };
export const saveFeel = (on) => { try { localStorage.setItem(FEEL_KEY, on ? '1' : '0'); } catch { /* private mode: fine */ } };

const QUALITY_KEY = 'xom.quality'; // 'auto' (or nothing) or a tier name from quality.js
export const loadQuality = () => { try { return localStorage.getItem(QUALITY_KEY) ?? 'auto'; } catch { return 'auto'; } };
export const saveQuality = (choice) => { try { localStorage.setItem(QUALITY_KEY, choice); } catch { /* private mode: fine */ } };

const GRACE_MS = 4000; // after joining, the stream may still send one list made before we were in it

export function createSession({ enabled = true, onData = () => {}, onHello = () => {}, onKicked = () => {}, onDown = () => {}, onMoves = () => {} } = {}) {
  const s = { sid: null, me: null, joinedAt: 0, moving: false };
  if (enabled && 'EventSource' in window) {
    const source = new EventSource('/api/live');
    source.addEventListener('hello', (event) => {
      try { s.sid = JSON.parse(event.data).sid; } catch { return; }
      const was = s.me;
      s.me = null; // a new stream (first load or after a drop): the server has forgotten us
      onHello(was !== null);
    });
    source.addEventListener('kicked', () => { s.me = null; onKicked(); });
    source.addEventListener('message', (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      const guests = Array.isArray(data.guests) ? data.guests : [];
      if (s.me && Date.now() - s.joinedAt > GRACE_MS && !guests.some((g) => g.id === s.me)) s.me = null;
      onData({ ...data, guests });
    });
    source.addEventListener('moves', (event) => { // where the walking guests are: [[id, x, y, heading, state], …]
      try { const list = JSON.parse(event.data); if (Array.isArray(list)) onMoves(list); } catch { /* a broken line: wait for the next */ }
    });
    source.addEventListener('error', () => onDown()); // EventSource retries by itself
  }

  async function post(path, body) {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: res.ok, body: await res.json().catch(() => ({})) };
  }

  return {
    get sid() { return s.sid; },
    get me() { return s.me; },
    /** Come home: { ok, name, look } as the server decided, { ok: false, message } when refused, { offline } with no stream. */
    async join(name, look) {
      if (!s.sid) return { ok: false, offline: true };
      try {
        const { ok, body } = await post('/api/join', { sid: s.sid, name, look });
        if (!ok) return { ok: false, message: body.error ?? 'Chưa vào được, thử lại nhé.' };
        s.me = body.id;
        s.joinedAt = Date.now();
        return { ok: true, name: body.name, look: body.look };
      } catch {
        return { ok: false, message: 'Mất kết nối, thử lại nhé.' };
      }
    },
    /** Say where this page's character is ({ x, y, h, a }, map units). One message in flight at a time; true if it was sent. */
    move(state) {
      if (!s.sid || !s.me || s.moving) return false;
      s.moving = true;
      post('/api/move', { sid: s.sid, x: state.x, y: state.y, h: state.h, a: state.a }).catch(() => {}).finally(() => { s.moving = false; });
      return true;
    },
    async leave() {
      if (!s.sid || !s.me) return;
      s.me = null;
      await post('/api/leave', { sid: s.sid }).catch(() => {});
    },
  };
}
