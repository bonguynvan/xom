// Every painter the xóm can use: borrowed duavit characters plus the 1990s cast.
import { ANIMAL_PAINTERS } from './duavit/painters.js';
import { HOLIDAY_PAINTERS } from './duavit/painters-holiday.js';
import { PEOPLE_PAINTERS } from './duavit/painters-people.js';
import { SAIGON_PAINTERS } from './duavit/painters-saigon.js';
import { TET_PAINTERS } from './duavit/painters-tet.js';
import { WORLD_PAINTERS } from './duavit/painters-world.js';
import { FOOD_PAINTERS } from './duavit/painters-food.js';
import { PEOPLE90 } from './people90.js';
import { PEOPLE90B } from './people90b.js';
import { makeFace } from './face.js';

export const PAINTERS = {
  ...ANIMAL_PAINTERS,
  ...HOLIDAY_PAINTERS,
  ...PEOPLE_PAINTERS,
  ...WORLD_PAINTERS,
  ...TET_PAINTERS,
  ...SAIGON_PAINTERS,
  ...FOOD_PAINTERS,
  dog: ANIMAL_PAINTERS.dog,
  cat: ANIMAL_PAINTERS.cat,
  chicken: ANIMAL_PAINTERS.chicken,
  duck: ANIMAL_PAINTERS.duck,
  cyclo: HOLIDAY_PAINTERS.cyclo,
  vespa: HOLIDAY_PAINTERS.vespa,
  flowerBike: HOLIDAY_PAINTERS.flowerBike,
  worker: HOLIDAY_PAINTERS.worker,
  nongDan: PEOPLE_PAINTERS.nongDan,
  xeBo: PEOPLE_PAINTERS.xeBo,
  cotDien: SAIGON_PAINTERS.cotDien,
  ongDo: TET_PAINTERS.ongDo,
  aoDai: TET_PAINTERS.aoDai,
  ongDia: TET_PAINTERS.ongDia,
  ...PEOPLE90,
  ...PEOPLE90B,
};

const faces = new Map();
/** One cartoon face per cast entry, built once. */
export function faceFor(castId, look) {
  if (!faces.has(castId)) faces.set(castId, makeFace(look));
  return faces.get(castId);
}

/**
 * Draw a resident at (x, y) on the ground, `size` units tall-ish, facing `dir` (+1 right, -1 left).
 * Painters always face right, so walking left is a mirror image (faces have no text to flip).
 */
export function drawResident(ctx, agent, look, { x, y, size, moving }) {
  const painter = PAINTERS[agent.painter];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((agent.dir < 0 ? -1 : 1) * (size / 100), size / 100);
  ctx.fillStyle = 'rgba(29, 26, 47, 0.16)';
  ctx.beginPath();
  ctx.ellipse(2, 2, 34, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  painter(ctx, agent.color, agent.phase, moving, faceFor(agent.castId, look));
  ctx.restore();
}
