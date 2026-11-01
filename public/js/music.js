// The xóm's lofi, made in the browser with Web Audio (no recordings, nothing to license): warm electric piano,
// a round bass, soft drums, a đàn bầu-like melody, vinyl crackle, rain at night, now and then a bicycle bell.
// It follows the xóm's hour (see music-score.js). If public/music/lofi.mp3 exists, that file plays instead,
// so anyone can swap in their own track.
import { BARS, BPM, CHORDS, STEPS_PER_BAR, hz, moodAt, phrase } from './music-score.js';
import { noise } from './rng.js';

const LOOKAHEAD_S = 0.15;
const TICK_MS = 30;
const SWING = 0.58; // the off-beat eighth comes late
const TRACK_URL = '/music/lofi.mp3';
const VOLUME = 0.55;
const MAKEUP = 4;

function noiseBuffer(ac, seconds, color = 'white') {
  const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let k = 0; k < data.length; k += 1) {
    const white = Math.random() * 2 - 1;
    last = color === 'brown' ? (last + 0.02 * white) / 1.02 : white;
    data[k] = color === 'brown' ? last * 3.5 : white;
  }
  return buffer;
}

/** A soft envelope on a gain node. */
function envelope(gain, t, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function synth(ac, out) {
  const tone = (type, freq, t, peak, attack, decay, dest = out, detune = 0) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    envelope(gain, t, peak, attack, decay);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
    return osc;
  };
  const hiss = noiseBuffer(ac, 2);
  const burst = (t, peak, decay, filterType, freq, q = 1) => {
    const src = ac.createBufferSource();
    src.buffer = hiss;
    const filter = ac.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ac.createGain();
    envelope(gain, t, peak, 0.002, decay);
    src.connect(filter).connect(gain).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.05);
  };
  return {
    piano(note, t, length) { // two slightly detuned sines and a soft overtone: an old electric piano
      tone('sine', hz(note), t, 0.07, 0.01, length, out, -4);
      tone('sine', hz(note), t, 0.05, 0.01, length * 0.9, out, 5);
      tone('triangle', hz(note) * 2, t, 0.012, 0.005, length * 0.4);
    },
    bass(note, t, length) { tone('sine', hz(note), t, 0.22, 0.02, length); },
    kick(t, level) {
      const osc = tone('sine', 110, t, 0.5 * level, 0.003, 0.32);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    },
    snare(t, level) { burst(t, 0.12 * level, 0.18, 'bandpass', 1800, 0.8); tone('triangle', 190, t, 0.04 * level, 0.002, 0.08); },
    hat(t, level) { burst(t, 0.035 * level, 0.04, 'highpass', 7000); },
    bau(note, t, length, slide) { // đàn bầu: a pure tone that slides up into the note and wavers
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const vibrato = ac.createOscillator();
      const depth = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz(note - slide), t);
      osc.frequency.exponentialRampToValueAtTime(hz(note), t + (slide ? 0.18 : 0.01));
      vibrato.frequency.value = 5.2;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(hz(note) * 0.012, t + length);
      vibrato.connect(depth).connect(osc.frequency);
      envelope(gain, t, 0.09, 0.04, length + 0.3);
      osc.connect(gain).connect(out);
      [osc, vibrato].forEach((o) => { o.start(t); o.stop(t + length + 0.5); });
    },
    bell(t) { [2480, 3110].forEach((f, k) => tone('sine', f, t + k * 0.12, 0.03, 0.002, 0.9)); tone('sine', 2480, t + 0.24, 0.025, 0.002, 0.9); },
    cricket(t) { for (let k = 0; k < 3; k += 1) tone('sine', 4300 + Math.random() * 300, t + k * 0.07, 0.008, 0.005, 0.04); },
  };
}

/** Rain on the roof in the music when it rains in the xóm; the drums keep their heads down. */
function withWeather(mood, weather) {
  if (weather === 'rain' || weather === 'storm') return { ...mood, rain: Math.max(mood.rain, weather === 'storm' ? 0.95 : 0.75), drums: mood.drums * 0.5 };
  if (weather === 'hot') return { ...mood, brightness: mood.brightness + 600 };
  return mood;
}

/** A looping bed of filtered noise (vinyl or rain) whose level can be eased. */
function bed(ac, out, buffer, filterType, freq) {
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  src.start();
  return gain;
}

/** Vinyl: a quiet hiss with sparse dust clicks. */
function vinylBuffer(ac) {
  const buffer = noiseBuffer(ac, 4);
  const data = buffer.getChannelData(0);
  for (let k = 0; k < data.length; k += 1) data[k] = data[k] * 0.15 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 2.5 : 0);
  return buffer;
}

/**
 * The music player. `hourOf()` gives the xóm's hour, `seed` makes each day's melody its own.
 * start() must be called from a click (browsers allow sound only then).
 */
export function createMusic({ hourOf, seed = 1, weatherOf = () => 'clear' }) {
  let ac = null;
  let track = null;
  let timer = 0;
  let playing = false;

  async function startTrack() {
    try {
      const res = await fetch(TRACK_URL, { method: 'HEAD' });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    track ??= Object.assign(new Audio(TRACK_URL), { loop: true, volume: VOLUME });
    await track.play();
    return true;
  }

  function startSynth() {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') ac.resume();
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(VOLUME, ac.currentTime + 2.5);
    const tape = ac.createBiquadFilter(); // the warm, slightly muffled lofi sound
    tape.type = 'lowpass';
    tape.Q.value = 0.4;
    const makeup = ac.createGain(); // the parts are mixed quietly; bring the whole up, then hold the peaks down
    makeup.gain.value = MAKEUP;
    const glue = ac.createDynamicsCompressor();
    glue.threshold.value = -14;
    glue.knee.value = 8;
    glue.ratio.value = 10;
    glue.attack.value = 0.005;
    glue.release.value = 0.2;
    tape.connect(makeup).connect(glue).connect(master).connect(ac.destination);
    const play = synth(ac, tape);
    const vinyl = bed(ac, master, vinylBuffer(ac), 'bandpass', 2500);
    const rain = bed(ac, master, noiseBuffer(ac, 3, 'brown'), 'lowpass', 1400);
    vinyl.gain.value = 0.05;

    const step = 60 / BPM / 2; // one eighth note
    let next = ac.currentTime + 0.1;
    resync = () => { next = ac.currentTime + 0.1; };
    let index = 0;
    const schedule = () => {
      const mood = withWeather(moodAt(hourOf()), weatherOf());
      tape.frequency.setTargetAtTime(mood.brightness, ac.currentTime, 2);
      rain.gain.setTargetAtTime(mood.rain * 0.18, ac.currentTime, 3);
      while (next < ac.currentTime + LOOKAHEAD_S) {
        const bar = Math.floor(index / STEPS_PER_BAR);
        const s = index % STEPS_PER_BAR;
        const t = next + (s % 2 ? step * (SWING - 0.5) * 2 : 0);
        const chord = CHORDS[bar % BARS];
        if (s === 0) chord.voicing.forEach((n, k) => play.piano(n, t + k * 0.015, step * 7));
        if (s === 5 && noise(seed, bar, 11) < 0.5) chord.voicing.slice(1).forEach((n) => play.piano(n, t, step * 2));
        if (s === 0 || (s === 4 && noise(seed, bar, 12) < 0.6)) play.bass(chord.root, t, step * 3.5);
        if (mood.drums > 0) {
          if (s === 0 || (s === 5 && noise(seed, bar, 13) < 0.4)) play.kick(t, mood.drums);
          if (s === 2 || s === 6) play.snare(t, mood.drums);
          play.hat(t, mood.drums * (s % 2 ? 0.6 : 1));
        }
        if (noise(seed, bar, 14) < mood.melody) {
          for (const n of phrase(seed, bar)) if (n.step === s) play.bau(n.note, t, n.length * step, n.slide);
        }
        if (s === 0 && noise(seed, bar, 15) < 0.08) play.bell(t + step * 3);
        if (mood.crickets && noise(seed, index, 16) < mood.crickets * 0.15) play.cricket(t);
        next += step;
        index += 1;
      }
    };
    tick = schedule;
    return master;
  }

  let master = null;
  let tick = null;
  let resync = () => {};
  return {
    get playing() { return playing; },
    async start() {
      if (playing) return;
      playing = true;
      if (await startTrack()) return;
      if (master) {
        await ac.resume();
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setTargetAtTime(VOLUME, ac.currentTime, 0.6);
        resync();
      } else {
        master = startSynth();
      }
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    /** After a click or tap: let the sound out if the browser held it back (it blocks autoplay). */
    unlock() {
      if (!playing) return;
      if (ac?.state === 'suspended') ac.resume();
      if (track?.paused) track.play().catch(() => {});
    },
    stop() {
      playing = false;
      track?.pause();
      clearInterval(timer);
      if (master && ac) {
        master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25);
        setTimeout(() => { if (!playing) ac.suspend(); }, 900);
      }
    },
  };
}
