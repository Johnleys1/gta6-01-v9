// GOLDEN TIDE — procedural audio: no audio files, everything is synthesized
// with WebAudio so the game loads with zero network requests.

import { RADIOS } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.radioGain = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.radioTimer = null; this.station = 0; this.radioOn = false; this.muted = false;
    this.waveNode = null;
  }

  /** Call from a user gesture (start button). Safe to call repeatedly. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine hum: two detuned saws through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 57;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(lp); o2.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); o2.start(); this._engineOsc2 = o2;
      // Siren: slow triangle LFO on a sine.
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.0;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.6;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 240;
      lfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start();
      // Waves: looping filtered noise, gentle.
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      const wg = this.ctx.createGain(); wg.gain.value = 0.05;
      noise.connect(bp); bp.connect(wg); wg.connect(this.master); noise.start();
      this.radioGain = this.ctx.createGain(); this.radioGain.gain.value = 0.0;
      this.radioGain.connect(this.master);
    } catch (e) { this.ctx = null; }
  }

  setEngine(speed01, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + speed01 * 0.09 : 0.0, t, 0.1);
    const f = 48 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this._engineOsc2.frequency.setTargetAtTime(f * 1.007, t, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0.0, this.ctx.currentTime, 0.2);
  }

  blip(freq = 660, dur = 0.08, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }

  gunshot(big = false) {
    if (!this.ctx) return;
    try {
      const dur = big ? 0.28 : 0.12;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = big ? 900 : 2400;
      const g = this.ctx.createGain(); g.gain.value = big ? 0.5 : 0.28;
      src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
    } catch (e) {}
  }

  explosion() {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.7);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.5;
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = this.ctx.createGain(); g.gain.value = 0.6;
      src.connect(lp); lp.connect(g); g.connect(this.master); src.start();
      this.blip(48, 0.5, 'sine', 0.4);
    } catch (e) {}
  }

  pickup() { this.blip(880, 0.1, 'sine', 0.15); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.15), 90); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 110)); }
  click() { this.blip(1200, 0.04, 'square', 0.08); }

  /** Procedural radio: a slow chord-pad loop per station, scheduled in 2-bar chunks. */
  setRadio(station, on) {
    this.station = station; this.radioOn = on;
    if (!this.ctx) return;
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
    this.radioGain.gain.setTargetAtTime(on ? 0.11 : 0.0, this.ctx.currentTime, 0.3);
    if (!on) return;
    const chords = [
      [[220, 277, 330], [174, 220, 261], [196, 246, 293], [146, 220, 293]],   // sunset FM
      [[262, 330, 392], [208, 262, 311], [233, 294, 349], [196, 247, 294]],   // latin heat
      [[110, 165, 220], [98, 147, 196], [123, 185, 247], [87, 131, 175]],     // night talk (low drone)
    ][station % 3];
    let step = 0;
    const bar = () => {
      if (!this.ctx || !this.radioOn) return;
      const chord = chords[step % chords.length]; step++;
      const t0 = this.ctx.currentTime + 0.05;
      chord.forEach((f) => {
        const o = this.ctx.createOscillator(); o.type = station === 1 ? 'triangle' : 'sine';
        o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.5, t0 + 0.4);
        g.gain.setValueAtTime(0.5, t0 + 1.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 2.0);
        o.connect(g); g.connect(this.radioGain); o.start(t0); o.stop(t0 + 2.1);
      });
      const bass = this.ctx.createOscillator(); bass.type = 'sine';
      bass.frequency.value = chord[0] / 2;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.linearRampToValueAtTime(0.6, t0 + 0.1);
      bg.gain.linearRampToValueAtTime(0.0001, t0 + 2.0);
      bass.connect(bg); bg.connect(this.radioGain); bass.start(t0); bass.stop(t0 + 2.1);
    };
    bar();
    this.radioTimer = setInterval(bar, 2000);
  }

  radioName() { return RADIOS[this.station % RADIOS.length].name; }
}
