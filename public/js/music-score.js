// The score of the xóm's lofi, as pure data (testable without a browser): an autumn-in-Hà-Nội progression,
// a melody in the northern five-note scale (ngũ cung Bắc: D F G A C) with đàn bầu slides, and how the mood
// follows the hour. music.js turns it into sound.
import { noise } from './rng.js';

export const BPM = 72;
export const STEPS_PER_BAR = 8; // eighth notes
export const BARS = 8; // then the progression repeats

const midi = (name, octave) => 12 * (octave + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[name[0]] + (name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0);
export const hz = (note) => 440 * 2 ** ((note - 69) / 12);

/** Eight bars of soft seventh and ninth chords: Dm9 G13 Cmaj9 Am9 / Fmaj7 Em7 Dm9 A7sus. Voicings in MIDI notes. */
export const CHORDS = [
  { root: midi('D', 2), voicing: [midi('F', 3), midi('A', 3), midi('C', 4), midi('E', 4)] },
  { root: midi('G', 2), voicing: [midi('F', 3), midi('B', 3), midi('E', 4), midi('A', 4)] },
  { root: midi('C', 2), voicing: [midi('E', 3), midi('G', 3), midi('B', 3), midi('D', 4)] },
  { root: midi('A', 1), voicing: [midi('G', 3), midi('C', 4), midi('E', 4), midi('B', 4)] },
  { root: midi('F', 2), voicing: [midi('E', 3), midi('A', 3), midi('C', 4), midi('G', 4)] },
  { root: midi('E', 2), voicing: [midi('D', 3), midi('G', 3), midi('B', 3), midi('D', 4)] },
  { root: midi('D', 2), voicing: [midi('F', 3), midi('A', 3), midi('C', 4), midi('E', 4)] },
  { root: midi('A', 1), voicing: [midi('G', 3), midi('D', 4), midi('E', 4), midi('A', 4)] },
];

/** Ngũ cung Bắc on D, two octaves for the melody. */
export const PENTATONIC = ['D', 'F', 'G', 'A', 'C'].flatMap((n) => [midi(n, 4), midi(n, 5)]).sort((a, b) => a - b);

/**
 * The melody of one bar: a few notes on the pentatonic scale, walking mostly by step, with long held notes,
 * each maybe sliding up into place like a đàn bầu. Deterministic: the same (seed, bar) gives the same phrase.
 * Returns [{ step, length (in steps), note, slide (semitones to slide up from) }].
 */
export function phrase(seed, bar) {
  if (bar % 4 === 3) return []; // breathe every fourth bar
  const notes = [];
  let at = Math.floor(noise(seed, bar, 1) * 2) * 2;
  let pos = 2 + Math.floor(noise(seed, bar, 2) * 5);
  for (let k = 0; at < STEPS_PER_BAR && k < 4; k += 1) {
    const length = [1, 2, 2, 3, 4][Math.floor(noise(seed, bar, k, 3) * 5)];
    const walk = Math.floor(noise(seed, bar, k, 4) * 5) - 2; // mostly small steps
    pos = Math.max(0, Math.min(PENTATONIC.length - 1, pos + walk));
    const slide = noise(seed, bar, k, 5) < 0.45 ? 2 : 0;
    if (noise(seed, bar, k, 6) < 0.8) notes.push({ step: at, length: Math.min(length, STEPS_PER_BAR - at), note: PENTATONIC[pos], slide });
    at += length;
  }
  return notes;
}

/** How the music sits at an hour: drums, rain, crickets, brightness, how often the melody plays. */
export function moodAt(hour) {
  const night = hour >= 22 || hour < 5;
  const evening = hour >= 18 && hour < 22;
  const morning = hour >= 5 && hour < 10;
  return {
    drums: night ? 0 : evening ? 0.7 : morning ? 0.6 : 0.85,
    rain: night ? 0.55 : evening ? 0.35 : 0.08,
    crickets: night ? 0.5 : evening ? 0.2 : 0,
    brightness: morning ? 4200 : night ? 1800 : evening ? 2400 : 3200, // low-pass cutoff in Hz
    melody: night ? 0.5 : 1,
  };
}
