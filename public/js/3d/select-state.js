// The character-select screen as pure data: what can be chosen, the reducer for the choices, the friendly
// name messages and the shape session.js stores in the browser ('xom.guest': { name, look } as the 2D page wrote it,
// plus shirt, hat and extra, which older entries simply lack). No DOM, no three.js: tested with node:test.
import { GUEST_LOOKS, NAME_MAX, NAME_MIN, cleanName, lookById, randomName } from '../guests.js';

export const PREFS_KEY = 'xom.guest';

export const SHIRTS = [
  { id: 'kem', label: 'Kem', color: '#f4ead2' },
  { id: 'do', label: 'Đỏ cờ', color: '#d8362f' },
  { id: 'vang', label: 'Vàng nắng', color: '#f2b705' },
  { id: 'cham', label: 'Chàm', color: '#2f4b7c' },
  { id: 'reu', label: 'Xanh rêu', color: '#5d7a3a' },
  { id: 'troi', label: 'Xanh da trời', color: '#5aa9d6' },
  { id: 'nau', label: 'Nâu đất', color: '#8a5a3c' },
  { id: 'hong', label: 'Hồng phấn', color: '#e89aae' },
];
export const HATS = [
  { id: 'none', label: 'Đầu trần' },
  { id: 'nonLa', label: 'Nón lá' },
  { id: 'muCoi', label: 'Mũ cối' },
  { id: 'muPhot', label: 'Mũ phớt' },
];
export const EXTRAS = [
  { id: 'none', label: 'Tay không' },
  { id: 'tuiVai', label: 'Túi vải' },
  { id: 'khan', label: 'Khăn quàng' },
  { id: 'donGanh', label: 'Đòn gánh' },
];

/** How each look is built in 3D and what it wears until the visitor changes it. */
export const LOOK_STYLE = {
  aoDai: { rig: 'man', height: 1.6, shirt: 'kem', hat: 'nonLa', extra: 'none' },
  ongLoe: { rig: 'youth', height: 1.72, shirt: 'troi', hat: 'none', extra: 'none' },
  nongDan: { rig: 'man', height: 1.66, shirt: 'nau', hat: 'nonLa', extra: 'donGanh' },
  congNhan: { rig: 'youth', height: 1.7, shirt: 'cham', hat: 'muCoi', extra: 'tuiVai' },
  toc: { rig: 'man', height: 1.58, shirt: 'hong', hat: 'none', extra: 'tuiVai' },
  boDoi: { rig: 'youth', height: 1.7, shirt: 'reu', hat: 'muCoi', extra: 'none' },
  cuDo: { rig: 'man', height: 1.62, shirt: 'kem', hat: 'muPhot', extra: 'khan' },
  treCon: { rig: 'man', height: 1.22, shirt: 'vang', hat: 'none', extra: 'none' },
};

const has = (list, id) => list.some((o) => o.id === id);
const styleOf = (look) => LOOK_STYLE[look] ?? LOOK_STYLE.ongLoe;
const dressed = (look) => { const s = styleOf(look); return { look, shirt: s.shirt, hat: s.hat, extra: s.extra }; };

/** Why a name cannot be used, in words a visitor can act on; null when it is fine. */
export function nameError(value) {
  if (typeof value !== 'string') return 'Đặt một cái tên đã nhé.';
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  const length = [...name].length;
  if (length === 0) return 'Đặt một cái tên đã nhé.';
  if (length < NAME_MIN) return `Tên ngắn quá, cần ít nhất ${NAME_MIN} chữ.`;
  if (length > NAME_MAX) return `Tên dài quá, tối đa ${NAME_MAX} chữ thôi.`;
  if (!/^[\p{L}\p{N} .'\-_]+$/u.test(name)) return 'Tên chỉ gồm chữ, số, dấu cách và các dấu . \' - _ thôi nhé.';
  if (cleanName(name) === null) return 'Tên này không dùng được trong xóm, chọn tên khác nhé.';
  return null;
}

/** What was stored, made safe: unknown ids and bad names are dropped, never trusted. */
export function readPrefs(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return {}; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const look = lookById(raw.look)?.id;
  const name = cleanName(raw.name);
  return {
    ...(name ? { name } : {}), ...(look ? { look } : {}),
    ...(has(SHIRTS, raw.shirt) ? { shirt: raw.shirt } : {}), ...(has(HATS, raw.hat) ? { hat: raw.hat } : {}), ...(has(EXTRAS, raw.extra) ? { extra: raw.extra } : {}),
  };
}

/** The record to store: the 2D page's { name, look } first, the 3D choices after. */
export const toPrefs = (s) => ({ name: cleanName(s.name) ?? s.name, look: s.look, shirt: s.shirt, hat: s.hat, extra: s.extra });

/** What the avatar needs to be drawn. */
export function choiceOf(s) {
  const style = styleOf(s.look);
  return { look: s.look, rig: style.rig, height: style.height, shirt: s.shirt, hat: s.hat, extra: s.extra, color: (SHIRTS.find((c) => c.id === s.shirt) ?? SHIRTS[0]).color };
}

/** The screen's first state. `rand` gives numbers in [0, 1) (passed in so tests are exact). */
export function initial(prefs = {}, rand = Math.random) {
  const look = prefs.look ?? GUEST_LOOKS[Math.floor(rand() * GUEST_LOOKS.length)].id;
  const base = dressed(look);
  return {
    ...base, shirt: prefs.shirt ?? base.shirt, hat: prefs.hat ?? base.hat, extra: prefs.extra ?? base.extra,
    name: prefs.name ?? randomName(rand(), rand(), rand()),
    error: null, busy: false, returning: Boolean(prefs.name && prefs.look),
  };
}

/** Every change to the screen. Unknown actions and unknown ids leave the state as it was. */
export function reduce(state, action) {
  if (state.busy && !['refused', 'joined'].includes(action.type)) return state; // waiting for the server: nothing moves
  switch (action.type) {
    case 'look': return lookById(action.id) ? { ...state, ...dressed(action.id) } : state;
    case 'step': {
      const k = GUEST_LOOKS.findIndex((l) => l.id === state.look);
      const next = GUEST_LOOKS[(k + action.by + GUEST_LOOKS.length) % GUEST_LOOKS.length].id;
      return { ...state, ...dressed(next) };
    }
    case 'shirt': return has(SHIRTS, action.id) ? { ...state, shirt: action.id } : state;
    case 'hat': return has(HATS, action.id) ? { ...state, hat: action.id } : state;
    case 'extra': return has(EXTRAS, action.id) ? { ...state, extra: action.id } : state;
    case 'name': return { ...state, name: action.value, error: action.value.trim() === '' ? null : nameError(action.value) };
    case 'random': return { ...state, name: randomName(action.r1, action.r2, action.r3), error: null };
    case 'submit': { const error = nameError(state.name); return error ? { ...state, error } : { ...state, error: null, busy: true }; }
    case 'refused': return { ...state, busy: false, error: action.message || 'Chưa vào được, thử lại nhé.' };
    case 'joined': return { ...state, busy: false, error: null, returning: true, name: action.name ?? state.name, ...(lookById(action.look) && action.look !== state.look ? dressed(action.look) : {}) };
    default: return state;
  }
}
