// Every character from Đua Vịt Peti, visiting the xóm, most of them several times over. The big machines (and
// the buildings on legs) keep to the main road, helicopters, dragons and Lạc birds fly over, everyone else
// roams the alleys at random, day in, day out. Names and colours come from
// duavit's shared/catalog.js (commit 6121521); characters the 1990s cast already uses are not repeated.

const ROAD = { tank: 90, tank843: 90, helicopter: 96, palace: 100, nhaTho: 100, tram: 110, doubleDecker: 110, excavator: 96, roller: 90, forklift: 86 };
const SIZE = { elephant: 84, nineTuskElephant: 90, dragon: 96, camel: 80, horse: 80, cow: 76, tiger: 72, mouse: 40, frog: 40, rabbit: 46, turtle: 48, lacBird: 54, liXi: 50, chauMai: 60 };
const SPEED = { turtle: 8, mouse: 30, horse: 36, tiger: 34, rabbit: 32, fox: 30, dragon: 28, ninja: 34, mummy: 10, buiCay: 9, chauMai: 10, banhChung: 14 };
const ANIMAL = new Set(['horse', 'rabbit', 'turtle', 'pig', 'penguin', 'camel', 'tiger', 'fox', 'cow', 'elephant', 'frog', 'mouse', 'dragon', 'lacBird', 'nineTuskElephant', 'deCon', 'lan']);

const CATALOG = [
  ['horse', 'Ngựa', '#9a5b2e'], ['rabbit', 'Thỏ', '#efe7da'], ['turtle', 'Rùa', '#3f9d4a'], ['pig', 'Heo', '#f5a9bc'],
  ['penguin', 'Cánh cụt', '#2b2d42'], ['camel', 'Lạc đà', '#d8ad5f'], ['tiger', 'Hổ', '#f28c28'], ['fox', 'Cáo', '#e8692c'],
  ['cow', 'Bò', '#f7f3ea'], ['elephant', 'Voi', '#a7b1c2'], ['frog', 'Ếch', '#6cc04a'], ['mouse', 'Chuột', '#b8b2a7'],
  ['tank', 'Xe tăng 390', '#55703f'], ['tank843', 'Xe tăng 843', '#4f6a45'], ['helicopter', 'Trực thăng', '#5f6b4e'],
  ['palace', 'Dinh mini', '#f4f1ea'], ['nhaTho', 'Nhà thờ Đức Bà mini', '#c8613f'], ['giong', 'Thánh Gióng', '#6b6f78'],
  ['dragon', 'Rồng', '#3f9d6a'], ['lacBird', 'Chim Lạc', '#c94f3d'], ['nineTuskElephant', 'Voi chín ngà', '#a7b1c2'],
  ['excavator', 'Xe xúc', '#f2b705'], ['roller', 'Xe lu', '#f28c28'], ['forklift', 'Xe nâng', '#ff7a1a'], ['tram', 'Tàu điện', '#b5523b'],
  ['starShield', 'Đội trưởng Mễ', '#2d4fa0'], ['nonLaHero', 'Siêu nhân Nón Lá', '#18a999'], ['robot', 'Người sắt đồng nát', '#9aa0aa'],
  ['ninja', 'Ninja ú òa', '#2b2d42'], ['buiCay', 'Bụi cây biết nói', '#5fa04e'], ['astronaut', 'Phi hành gia Cuội', '#f4f1ea'],
  ['mummy', 'Xác ướp mất ngủ', '#efe4c8'], ['cowboy', 'Cao bồi miền Tây', '#a0522d'], ['flagBro', 'Anh trai cờ Mỹ', '#d62828'],
  ['doubleDecker', 'Xe buýt Luân Đôn', '#d62828'], ['banhMi', 'Bánh mì ổ bự', '#e3a04f'], ['traSua', 'Trà sữa full topping', '#c8a27c'],
  ['pho', 'Phở tái nạm', '#f7f3ea'], ['saurieng', 'Sầu riêng thơm lừng', '#9bbf3a'], ['lan', 'Ông Lân', '#d62828'],
  ['banhChung', 'Bánh chưng', '#3f8f3a'], ['liXi', 'Bao lì xì', '#d62828'], ['chauMai', 'Chậu mai', '#f4f8fc'], ['deCon', 'Dê con', '#f4f1ea'],
];

const YOUNG = new Set(['horse', 'pig', 'rabbit', 'cow', 'deCon', 'mouse', 'frog', 'turtle', 'penguin', 'fox', 'tiger', 'elephant']);
const FLYING = new Set(['helicopter', 'dragon', 'lacBird']);
/** How many of each come to visit: a few tanks, a sky full of helicopters, two or three of everyone else. */
const COUNT = { tank: 3, tank843: 3, helicopter: 4, dragon: 2, lacBird: 3 };
const copies = (id, name) => {
  const n = COUNT[id] ?? (ROAD[id] ? 2 : YOUNG.has(id) ? 3 : 2);
  return Array.from({ length: n }, (_, k) => (k === 0 ? name : YOUNG.has(id) && k === 1 ? `${name} con` : `${name} ${k + 1}`));
};
const HUMAN_FACE = { skin: '#f1c9a5', eyes: 'dot', mouth: 'smile' };
const VISITOR_LINES = ['Xóm vui quá!', 'Đường nào ra chợ nhỉ?', 'Đua một vòng không?', 'Ở đây có trà đá không?', 'Lạc đường rồi!'];

/** Cast entries (see cast.js) for the visitors from Đua Vịt. */
export const DUAVIT_CAST = CATALOG.map(([id, name, color]) => ({
  id: `dv_${id}`,
  painter: id,
  kind: FLYING.has(id) ? 'flyer' : ROAD[id] ? 'vehicle' : 'stray',
  names: copies(id, name),
  color,
  size: ROAD[id] ?? SIZE[id] ?? 62,
  speed: FLYING.has(id) ? 46 : ROAD[id] ? 30 : SPEED[id] ?? 20,
  bio: 'Từ Đua Vịt Peti sang xóm chơi, đi lang thang khắp các ngõ.',
  look: ANIMAL.has(id) ? { skin: color, eyes: 'dot', mouth: 'flat' } : HUMAN_FACE,
  lines: ANIMAL.has(id) ? [] : VISITOR_LINES,
}));
