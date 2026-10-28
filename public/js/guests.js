// Visitors who "come home to the xóm": the looks they can pick and the rules for their names. Shared by the
// page (instant feedback) and the server (scripts/live.js, the authority).

/** The looks a visitor can choose; each borrows a cast type's painter and face. */
export const GUEST_LOOKS = [
  { id: 'aoDai', label: 'Cô áo dài', castId: 'diCho' },
  { id: 'ongLoe', label: 'Thanh niên ống loe', castId: 'thanhNien' },
  { id: 'nongDan', label: 'Bác nông dân', castId: 'thoCay' },
  { id: 'congNhan', label: 'Chú công nhân', castId: 'chuTho' },
  { id: 'toc', label: 'Chị tóc xoăn', castId: 'chiEm2' },
  { id: 'boDoi', label: 'Chú bộ đội', castId: 'cuuBinh' },
  { id: 'cuDo', label: 'Cụ đồ', castId: 'thayLang' },
  { id: 'treCon', label: 'Trẻ con', castId: 'treCon' },
];
export const lookById = (id) => GUEST_LOOKS.find((l) => l.id === id) ?? null;

export const NAME_MIN = 2;
export const NAME_MAX = 24;

// Peti never uses gambling words; and a xóm name should be one you can say in front of the grandmothers.
const BANNED_PHRASES = ['may rủi', 'may mắn', 'cầu may', 'giải thưởng', 'tiền thưởng', 'trúng thưởng', 'xổ số', 'lô đề',
  'bầu cua', 'đánh bạc', 'cờ bạc', 'cá độ', 'nhà cái', 'đm', 'đmm', 'địt', 'đụ', 'lồn', 'cặc', 'buồi', 'đéo', 'đĩ', 'điếm'];
const BANNED_WORDS = new Set(['cược', 'dm', 'dmm', 'dcm', 'dkm', 'djt', 'vcl', 'vkl', 'clm', 'loz', 'fuck', 'shit', 'bitch', 'admin', 'peti']);

/**
 * A visitor's name made safe to show, or null with no reason needed: letters (any Vietnamese), digits,
 * spaces and a few marks; NAME_MIN..NAME_MAX characters; nothing rude, nothing about gambling.
 */
export function cleanName(input) {
  if (typeof input !== 'string') return null;
  const name = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  if ([...name].length < NAME_MIN || [...name].length > NAME_MAX) return null;
  if (!/^[\p{L}\p{N} .'\-_]+$/u.test(name)) return null;
  const lower = name.toLowerCase();
  if (BANNED_PHRASES.some((p) => lower.includes(p))) return null;
  if (lower.split(/[^\p{L}\p{N}]+/u).some((w) => BANNED_WORDS.has(w))) return null;
  return name;
}

const FIRST = ['Cu', 'Cái', 'Anh', 'Chị', 'Cô', 'Chú', 'Bác'];
const LAST = ['Tèo', 'Tí', 'Bin', 'Bống', 'Mít', 'Na', 'Sóc', 'Tôm', 'Cốm', 'Bơ', 'Ổi', 'Su'];
/** A friendly random name to start from. */
export function randomName(r1 = Math.random(), r2 = Math.random(), r3 = Math.random()) {
  return `${FIRST[Math.floor(r1 * FIRST.length)]} ${LAST[Math.floor(r2 * LAST.length)]} ${10 + Math.floor(r3 * 90)}`;
}
