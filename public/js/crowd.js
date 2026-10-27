// The rest of the neighbours: a crowd of everyday people (and their kids) generated from a few looks,
// a list of old-fashioned names and the places everybody goes. Deterministic, so the xóm is always the same.
import { noise } from './rng.js';

const GIVEN = ['Lan', 'Huệ', 'Hồng', 'Đào', 'Mai', 'Cúc', 'Hằng', 'Nga', 'Thủy', 'Vân', 'Hạnh', 'Tâm', 'Bình', 'Hòa', 'Thắng', 'Lợi',
  'Hùng', 'Dũng', 'Minh', 'Tuấn', 'Sơn', 'Hải', 'Nam', 'Bắc', 'Trung', 'Thành', 'Phúc', 'Lộc', 'Thọ', 'Tài', 'Đức', 'Nghĩa',
  'Quý', 'Hiền', 'Thảo', 'Liên', 'Nhung', 'Yến', 'Oanh', 'Loan', 'Tuyết', 'Sương', 'Thu', 'Xuân', 'Hạ', 'Đông', 'Chiến', 'Thuận',
  'An', 'Ánh', 'Bảo', 'Cường', 'Dung', 'Duyên', 'Giang', 'Hà', 'Hậu', 'Hiếu', 'Hoàng', 'Huy', 'Khánh', 'Khoa', 'Kiên', 'Linh',
  'Long', 'Ly', 'Mạnh', 'Mến', 'Nhàn', 'Ninh', 'Phượng', 'Quang', 'Quyên', 'Sáng', 'Tấn', 'Thơ', 'Thịnh', 'Tình', 'Toàn', 'Trang',
  'Trinh', 'Tú', 'Tùng', 'Uyên', 'Vinh', 'Việt', 'Vui', 'Xoan', 'Ý', 'Đạt', 'Điệp', 'Định', 'Hưng', 'Lực', 'Nguyệt', 'Thoa'];
const TITLES = ['Anh', 'Chị', 'Cô', 'Chú', 'Bác', 'Ông', 'Bà'];
const LOOKS = [
  { painter: 'coToc', skin: '#f4cfb2', mouth: 'smile', blush: true },
  { painter: 'aoDai', skin: '#f6d2b4', mouth: 'smile', blush: true },
  { painter: 'nongDan', skin: '#c98f5f', mouth: 'grin' },
  { painter: 'worker', skin: '#d8a477', mouth: 'smile', brows: 'thick' },
  { painter: 'boDoi', skin: '#cf9a6c', mouth: 'flat', brows: 'thick' },
  { painter: 'ongDo', skin: '#f0c9a6', mouth: 'flat', beard: 'long', eyes: 'sleepy' },
  { painter: 'baTrau', skin: '#e6b893', mouth: 'betel', eyes: 'sleepy' },
  { painter: 'anhRadio', skin: '#e9b98f', mouth: 'grin', glasses: 'sun' },
  { painter: 'coTapHoa', skin: '#f3cfae', mouth: 'smile' },
  { painter: 'thoAnh', skin: '#e8b994', mouth: 'o', mustache: true },
];
const COLORS = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#2d9cdb', '#ef476f', '#9b5de5', '#6b8f4e', '#c94f7c', '#4f7a8f'];
const SHOPS = ['traDa', 'pho', 'che', 'tapHoa', 'suaXe', 'catToc', 'hieuAnh', 'bangDia', 'buuDien', 'hieuMay', 'phone'];
const PLACES_TO_GO = ['cho', 'traDa', 'che', 'pho', 'tapHoa', 'dinh', 'ao', 'gieng', 'benXe', 'cayBang', 'cayPhuong', 'bangDia', 'buuDien', 'hieuMay', 'hieuAnh', 'phone'];
const LINES = ['Ăn cơm chưa?', 'Đi đâu đấy?', 'Giời ơi là giời!', 'Khiếp, ghê chưa!', 'Thời buổi gì không biết!', 'Nóng quá!',
  'Mất điện rồi!', 'Chợ hôm nay đắt quá!', 'Về ăn cơm đi!', 'Nghe gì chưa?', 'Ối giời ơi!', 'Chán như con gián!', 'Mai trả nhé!'];
const KID_NAMES = ['Tôm', 'Tép', 'Cốm', 'Bơ', 'Na', 'Mít', 'Ổi', 'Su', 'Bi', 'Bon', 'Tũn', 'Ỉn', 'Gạo', 'Nếp', 'Đậu', 'Lạc',
  'Sóc', 'Thỏ', 'Ốc', 'Hến', 'Nghêu', 'Sò', 'Mướp', 'Bầu', 'Bí', 'Khoai', 'Sắn', 'Ngô', 'Vừng', 'Kẹo', 'Bánh', 'Mận',
  'Đào', 'Xoài', 'Chanh', 'Cam', 'Quýt', 'Bưởi', 'Na Na', 'Chíp', 'Cún', 'Mèo', 'Gấu', 'Sữa', 'Bông', 'Bin'];
const KID_LINES = ['Đá bóng không?', 'Trốn tìm đi!', 'Ăn gian! Chơi lại!', 'Tao mách mẹ mày!', 'Mẹ ơi cho con năm trăm!', 'Nhảy dây không?'];

const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

/** `adults` neighbours and `kids` children, homes spread over nha1..nha`homes`. */
export function crowd(taken = new Set(), adults = 420, kids = 90, homes = 80) {
  const used = new Set(taken);
  const people = [];
  for (let k = 0; people.length < adults && k < adults * 20; k += 1) {
    const name = `${pick(TITLES, noise(k, 141))} ${pick(GIVEN, noise(k, 142))}`;
    if (used.has(name)) continue;
    used.add(name);
    const look = pick(LOOKS, noise(k, 143));
    const likes = [...SHOPS.filter((_, n) => noise(k, n, 148) < 0.4), ...PLACES_TO_GO.filter((_, n) => noise(k, n, 144) < 0.2)];
    people.push({
      id: `xom_${people.length}`, painter: look.painter, kind: 'walker', names: [name], home: `nha${1 + (people.length % homes)}`,
      color: pick(COLORS, noise(k, 145)), speed: 16 + Math.round(noise(k, 146) * 14), likes: likes.length ? likes : ['cho', 'traDa'],
      bio: 'Hàng xóm trong xóm.', look: { eyes: 'dot', ...look }, lines: LINES,
    });
  }
  const children = KID_NAMES.flatMap((n) => [`Cu ${n}`, `Cái ${n}`]).filter((n) => !used.has(n)).slice(0, kids).map((name, k) => ({
    id: `treXom_${k}`, painter: 'cuBi', kind: 'kid', names: [name], home: `nha${1 + ((k * 7) % homes)}`, color: pick(COLORS, noise(k, 147)),
    speed: 40, likes: ['sanChoi', 'dinh', 'ao', 'che', 'cayBang', 'cayPhuong', 'bangDia'], bio: 'Trẻ con trong xóm.',
    look: { skin: '#e3a876', eyes: 'wide', mouth: 'grin' }, lines: KID_LINES,
  }));
  return [...people, ...children];
}
