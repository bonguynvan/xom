// The sound of the street (Web Audio, everything synthesised, nothing recorded): engines of the nearest
// motorbikes placed where they are, a horn now and then, birds by day and crickets by night, rain and its
// patter on a corrugated roof, the murmur of the market, a street vendor's wordless call, the ward loudspeaker's
// chime and muffled voice, and your own footsteps, which change with what is underfoot. The numbers come from
// sound-plan.js (pure, tested). It starts only on a click (browsers require it) and has its own switch; the
// 🎵 music is a separate thing with its own.
import { ambience, duck, enginePitch, footfalls, footstep, pickVoices, vendorCall } from './sound-plan.js';

const VOLUME = 0.85;
const ENGINES = 6;

function noiseBuffer(ac, seconds, brown) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let k = 0; k < d.length; k += 1) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[k] = last * 3.5; } else d[k] = w;
  }
  return buf;
}

/** Drops on corrugated iron: short metallic ticks at random moments, looped. */
function patterBuffer(ac) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 3), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let n = 0; n < 420; n += 1) {
    const at = Math.floor(Math.random() * (d.length - 900));
    const amp = 0.25 + Math.random() * 0.75;
    for (let k = 0; k < 800; k += 1) d[at + k] += (Math.random() * 2 - 1) * amp * Math.exp(-k / 110);
  }
  return buf;
}

export function createSound() {
  let ac = null;
  let g = null; // the graph, built on the first start
  let on = false;
  let level = 1; // the ducked bus
  let lastPhase = 0;
  let hornIn = 8;
  let callIn = 6;
  let wasSpeaking = false;
  const held = new Set();

  const panner = (x, y, z, ref = 3, max = 45) => {
    const p = new PannerNode(ac, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: ref, maxDistance: max, rolloffFactor: 1.3, positionX: x, positionY: y, positionZ: z });
    return p;
  };
  const loop = (buffer) => { const s = new AudioBufferSourceNode(ac, { buffer, loop: true }); s.start(); return s; };
  const gain = (value = 0) => new GainNode(ac, { gain: value });

  function build() {
    const master = gain(0);
    const analyser = new AnalyserNode(ac, { fftSize: 2048 });
    const glue = new DynamicsCompressorNode(ac, { threshold: -14, ratio: 5, attack: 0.005, release: 0.2 });
    glue.connect(master).connect(analyser).connect(ac.destination);
    const world = gain(1); // ducked while the loudspeaker talks
    const steps = gain(1);
    const voice = gain(1);
    for (const bus of [world, steps, voice]) bus.connect(glue);
    const white = noiseBuffer(ac, 2, false);
    const brown = noiseBuffer(ac, 4, true);
    // rain: a low wash and a little hiss
    const rain = gain();
    loop(brown).connect(new BiquadFilterNode(ac, { type: 'lowpass', frequency: 1500 })).connect(rain);
    const hiss = gain(0.12);
    loop(white).connect(new BiquadFilterNode(ac, { type: 'highpass', frequency: 5200 })).connect(hiss).connect(rain);
    rain.connect(world);
    // the patter on the nearest corrugated roof
    const tin = gain();
    const tinAt = panner(0, 4, 0, 5, 40);
    loop(patterBuffer(ac)).connect(new BiquadFilterNode(ac, { type: 'bandpass', frequency: 2800, Q: 2.5 })).connect(tin).connect(tinAt).connect(world);
    // crickets: a high tone chopped fast, swelling slowly
    const crickets = gain();
    const chirr = gain(0.5);
    const carrier = new OscillatorNode(ac, { type: 'sine', frequency: 4300 });
    const chop = new OscillatorNode(ac, { type: 'square', frequency: 27 });
    const chopDepth = gain(0.5);
    chop.connect(chopDepth).connect(chirr.gain);
    carrier.connect(chirr).connect(crickets).connect(world);
    carrier.start();
    chop.start();
    // the murmur of many people
    const crowd = gain();
    loop(brown).connect(new BiquadFilterNode(ac, { type: 'bandpass', frequency: 520, Q: 0.7 })).connect(crowd).connect(world);
    // engines: a few voices handed to whichever motorbikes are nearest
    const engines = Array.from({ length: ENGINES }, () => {
      const saw = new OscillatorNode(ac, { type: 'sawtooth', frequency: 50 });
      const sub = new OscillatorNode(ac, { type: 'square', frequency: 25 });
      const tone = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 420, Q: 1.2 });
      const out = gain();
      const at = panner(0, 0.6, 0, 3, 45);
      saw.connect(tone);
      sub.connect(gain(0.5)).connect(tone);
      tone.connect(out).connect(at).connect(world);
      saw.start();
      sub.start();
      return { id: null, saw, sub, tone, out, at };
    });
    return { master, analyser, world, steps, voice, white, rain, tin, tinAt, crickets, crowd, engines };
  }

  const move = (p, x, y, z) => { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; };

  function burst(dest, { freq, q, gain: amp, decay, thump }) {
    const t = ac.currentTime;
    const src = new AudioBufferSourceNode(ac, { buffer: g.white });
    const env = gain(0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay + 0.01);
    src.connect(new BiquadFilterNode(ac, { type: 'bandpass', frequency: freq * (0.9 + Math.random() * 0.2), Q: q })).connect(env).connect(dest);
    src.start(t, Math.random() * 1.5, decay + 0.05);
    const low = new OscillatorNode(ac, { type: 'sine', frequency: 78 });
    const lowEnv = gain(0);
    low.frequency.exponentialRampToValueAtTime(46, t + 0.07);
    lowEnv.gain.setValueAtTime(thump * 0.22, t);
    lowEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    low.connect(lowEnv).connect(dest);
    low.start(t);
    low.stop(t + 0.1);
  }

  /** A tone with an envelope at a place: the brick the horn, the birds, the vendor and the chime are made of. */
  function note(dest, { type = 'sine', from, to = from, at = 0, seconds, amp, filter = null }) {
    const t = ac.currentTime + at;
    const osc = new OscillatorNode(ac, { type, frequency: from });
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
    const env = gain(0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(amp, t + Math.min(0.03, seconds / 4));
    env.gain.setValueAtTime(amp, t + seconds * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    (filter ? osc.connect(new BiquadFilterNode(ac, filter)) : osc).connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  function speak(at) { // the loudspeaker: three chimes, then a voice you cannot make out, thin and nasal as a horn speaker is
    const out = panner(at.x, at.y, at.z, 10, 120);
    out.connect(g.voice);
    [660, 880, 990].forEach((hz, k) => note(out, { from: hz, at: k * 0.38, seconds: 0.5, amp: 0.22 }));
    const t0 = ac.currentTime + 1.4;
    const osc = new OscillatorNode(ac, { type: 'sawtooth', frequency: 150 });
    const env = gain(0);
    const horn = new BiquadFilterNode(ac, { type: 'highpass', frequency: 480 });
    for (let k = 0; k < 44; k += 1) { // syllables: a pitch and a loudness each
      const t = t0 + k * 0.15;
      osc.frequency.setValueAtTime(125 + Math.random() * 70, t);
      env.gain.setTargetAtTime(Math.random() < 0.15 ? 0 : 0.16 + Math.random() * 0.12, t, 0.02);
    }
    env.gain.setTargetAtTime(0, t0 + 6.7, 0.05);
    for (const f of [720, 1250]) osc.connect(new BiquadFilterNode(ac, { type: 'bandpass', frequency: f, Q: 5 })).connect(env);
    env.connect(horn).connect(out);
    osc.start(t0);
    osc.stop(t0 + 7);
  }

  return {
    get on() { return on; },
    async start() {
      ac ??= new AudioContext();
      g ??= build();
      await ac.resume();
      g.master.gain.setTargetAtTime(VOLUME, ac.currentTime, 0.5);
      on = true;
    },
    stop() {
      if (g) g.master.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      on = false;
    },
    /** How loud it is right now: { rms, peak } of the last 2048 samples (tests and ?perf=1). */
    level() {
      if (!g) return { rms: 0, peak: 0 };
      const data = new Float32Array(g.analyser.fftSize);
      g.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      let peak = 0;
      for (const v of data) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
      return { rms: Math.round(Math.sqrt(sum / data.length) * 1000) / 1000, peak: Math.round(peak * 1000) / 1000 };
    },
    /**
     * Each frame. `ear` = { x, y, z, fx, fz } (the camera and where it looks); `vehicles` = [{ id, x, z, speed, kind }]
     * (motor ones only), `vendors` = [{ id, x, z }], `walk` = { phase, speed, kind } (your stride and what is underfoot,
     * or null), `loa` = { speaking, x, y, z }, `tin` = { x, z } | null (the nearest corrugated roof).
     */
    update({ ear, hour, weather, vehicles = [], vendors = [], walk = null, loa = null, tin = null, dt }) {
      if (!on || !g) return;
      const t = ac.currentTime;
      const L = ac.listener;
      if (L.positionX) {
        L.positionX.value = ear.x; L.positionY.value = ear.y; L.positionZ.value = ear.z;
        L.forwardX.value = ear.fx; L.forwardY.value = 0; L.forwardZ.value = ear.fz;
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(ear.x, ear.y, ear.z); L.setOrientation(ear.fx, 0, ear.fz, 0, 1, 0); }
      const amb = ambience(hour, weather);
      g.rain.gain.setTargetAtTime(amb.rain * 0.5, t, 0.8);
      g.tin.gain.setTargetAtTime(tin ? amb.tin * 0.9 : 0, t, 0.8);
      if (tin) move(g.tinAt, tin.x, 4, tin.z);
      g.crickets.gain.setTargetAtTime(amb.crickets * 0.035, t, 1.5);
      g.crowd.gain.setTargetAtTime(amb.crowd * 0.22, t, 1.5);
      const speaking = Boolean(loa?.speaking);
      if (speaking && !wasSpeaking) speak(loa);
      wasSpeaking = speaking;
      level = duck(level, speaking, dt);
      g.world.gain.value = level;
      // birds: a chirp from somewhere up in the trees near you
      if (Math.random() < amb.birds * dt * 1.4) {
        const a = Math.random() * Math.PI * 2;
        const out = panner(ear.x + Math.cos(a) * (6 + Math.random() * 14), 6, ear.z + Math.sin(a) * (6 + Math.random() * 14), 6, 60);
        out.connect(g.world);
        const hz = 2600 + Math.random() * 1800;
        for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k += 1) note(out, { from: hz, to: hz * (1.2 + Math.random() * 0.3), at: k * 0.11, seconds: 0.08, amp: 0.12 });
      }
      // engines
      const ids = pickVoices(vehicles, ear, ENGINES, held);
      const byId = new Map(vehicles.map((v) => [v.id, v]));
      for (const e of g.engines) if (e.id !== null && !ids.includes(e.id)) { held.delete(e.id); e.id = null; e.out.gain.setTargetAtTime(0, t, 0.08); }
      for (const id of ids) {
        const e = g.engines.find((v) => v.id === id) ?? g.engines.find((v) => v.id === null);
        if (!e) break;
        const v = byId.get(id);
        e.id = id;
        held.add(id);
        move(e.at, v.x, 0.6, v.z);
        const hz = enginePitch(v.speed, v.kind) * (1 + ((id * 13) % 7) * 0.012); // no two bikes quite in tune
        e.saw.frequency.setTargetAtTime(hz, t, 0.1);
        e.sub.frequency.setTargetAtTime(hz / 2, t, 0.1);
        e.tone.frequency.setTargetAtTime(300 + v.speed * 60, t, 0.2);
        e.out.gain.setTargetAtTime(0.2, t, 0.15);
      }
      hornIn -= dt;
      if (hornIn < 0 && ids.length) { // somebody leans on the horn
        const v = byId.get(ids[Math.floor(Math.random() * ids.length)]);
        const out = panner(v.x, 0.8, v.z, 4, 70);
        out.connect(g.world);
        const twice = Math.random() < 0.4;
        for (const hz of [430, 540]) for (let k = 0; k < (twice ? 2 : 1); k += 1) note(out, { type: 'square', from: hz, at: k * 0.3, seconds: 0.22, amp: 0.1, filter: { type: 'lowpass', frequency: 2200 } });
        hornIn = 5 + Math.random() * 16;
      }
      callIn -= dt;
      if (callIn < 0 && vendors.length) { // the nearest vendor cries their wares
        const v = vendors.reduce((best, p) => (Math.hypot(p.x - ear.x, p.z - ear.z) < Math.hypot(best.x - ear.x, best.z - ear.z) ? p : best));
        const out = panner(v.x, 1.5, v.z, 5, 60);
        out.connect(g.voice);
        for (const n of vendorCall(v.id + Math.floor(t / 20))) note(out, { type: 'triangle', from: n.hz, to: n.hz * n.fall, at: n.at, seconds: n.seconds, amp: 0.2, filter: { type: 'bandpass', frequency: 950, Q: 1.6 } });
        callIn = 14 + Math.random() * 18;
      }
      // your own feet
      if (walk) {
        if (walk.speed > 0.3) for (const foot of footfalls(lastPhase, walk.phase)) burst(g.steps, footstep(walk.kind, walk.speed), foot);
        lastPhase = walk.phase;
      }
    },
  };
}
