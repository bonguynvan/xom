// Where the floor sellers sit on the market floor with their bamboo trays, decided by noise so it never moves.
import { findPlace } from './places.js';
import { noise } from './rng.js';

const market = findPlace('cho');
/** Where the floor sellers sit with their trays (between the stalls, off the aisles). */
export const TRAYS = Array.from({ length: 28 }, (_, k) => ({ x: market.x + 14 + noise(k, 111) * (market.w - 28), y: market.y0 + 18 + noise(k, 112) * (market.y1 - market.y0 - 30), k }));
