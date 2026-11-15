/*
 * Astro Adventures – sound effects
 *
 * Generated in code with the Web Audio API (no sound files needed):
 * whoosh, chime, click, beeps, rumble, thud, whir, sparkle…
 *
 * window.AstroAudio = {
 *   start() / stop()          – wake the audio up (call from a click) / silence the rumble
 *   sfx(name)                 – play a sound effect
 *   rumble(level, secs)       – engine rumble, 0 (off) → 1 (full)
 *   muted / setMuted(bool)
 * }
 */
(function () {
  "use strict";

  let ctx = null;
  let master, sfxBus, reverbSend;
  let muted = false;
  try { muted = localStorage.getItem("astroMuted") === "1"; } catch (e) { /* storage may be blocked */ }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    // Everything goes through a limiter so nothing can ever crackle or clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(limiter);

    // Soft room reverb (generated impulse)
    const reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.6;
    }
    reverb.buffer = imp;
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.35;
    reverbSend.connect(reverb);
    reverb.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.6;
    sfxBus.connect(master);
    return ctx;
  }

  // Smooth noise (6 s, normalised, loops without a click)
  let noiseBuf = null;
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    const n = ctx.sampleRate * 6;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0, peak = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03;
      d[i] = last * 2 + w * 0.25;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    const fade = Math.floor(ctx.sampleRate * 0.25); // cross-fade the ends so the loop is seamless
    for (let i = 0; i < n; i++) d[i] /= peak;
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[n - fade + i] = d[n - fade + i] * (1 - k) + d[i] * k;
    }
    return noiseBuf;
  }
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); return s; };

  function tone({ freq, type = "sine", at = null, start = 0, attack = 0.01, hold = 0, release = 0.4, gain = 0.2, bus = sfxBus, toFreq = null, reverb = 0, filter = 0 }) {
    const t = at !== null ? at : ctx.currentTime + start;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + attack + hold + release);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    let node = osc;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(bus);
    if (reverb) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s);
      s.connect(reverbSend);
    }
    osc.start(t);
    osc.stop(t + attack + hold + release + 0.05);
  }

  /* ---------------- Sound effects ---------------- */

  const SFX = {
    whoosh() {
      const t = ctx.currentTime;
      const src = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(250, t);
      bp.frequency.exponentialRampToValueAtTime(3200, t + 2.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      src.connect(bp); bp.connect(g); g.connect(sfxBus);
      src.start(t); src.stop(t + 3.3);
      tone({ freq: 220, toFreq: 880, attack: 1.2, release: 1.8, gain: 0.05, reverb: 0.4 });
    },
    chime() {
      tone({ freq: midi(79), attack: 0.01, release: 1.2, gain: 0.1, reverb: 0.5 });
      tone({ freq: midi(84), start: 0.18, attack: 0.01, release: 1.5, gain: 0.1, reverb: 0.5 });
    },
    click() {
      const t = ctx.currentTime;
      const src = noise();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      src.connect(hp); hp.connect(g); g.connect(sfxBus);
      src.start(t); src.stop(t + 0.08);
      tone({ freq: 1400, attack: 0.002, release: 0.07, gain: 0.08, type: "square", filter: 3000 });
    },
    blips() {
      for (let i = 0; i < 6; i++) tone({ freq: 900 + Math.random() * 900, start: i * 0.13, attack: 0.005, release: 0.08, gain: 0.035, type: "square", filter: 3500 });
    },
    success() {
      [72, 76, 79, 84].forEach((n, i) => tone({ freq: midi(n), start: i * 0.11, attack: 0.01, release: 0.9, gain: 0.08, reverb: 0.4 }));
    },
    beep() { tone({ freq: 880, attack: 0.005, hold: 0.08, release: 0.15, gain: 0.09 }); },
    beepHigh() { tone({ freq: 1320, attack: 0.005, hold: 0.12, release: 0.2, gain: 0.1 }); },
    thud() {
      const t = ctx.currentTime;
      tone({ freq: 90, toFreq: 38, attack: 0.005, release: 0.6, gain: 0.4 });
      const src = noise();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      src.connect(lp); lp.connect(g); g.connect(sfxBus);
      src.start(t); src.stop(t + 0.75);
    },
    whir() {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.linearRampToValueAtTime(110, t + 1.6);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.2);
      g.gain.setValueAtTime(0.06, t + 1.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(lp); lp.connect(g); g.connect(sfxBus);
      osc.start(t); osc.stop(t + 1.9);
    },
    chirp() {
      tone({ freq: 700, toFreq: 1500, attack: 0.01, release: 0.12, gain: 0.04, type: "square", filter: 3000 });
      tone({ freq: 1100, toFreq: 1900, start: 0.14, attack: 0.01, release: 0.1, gain: 0.035, type: "square", filter: 3000 });
    },
    sparkle() {
      [84, 88, 91, 96, 100].forEach((n, i) => tone({ freq: midi(n), start: i * 0.08, attack: 0.005, release: 1.1, gain: 0.05, reverb: 0.6 }));
    },
    swell() {
      tone({ freq: midi(67), attack: 0.6, release: 1.5, gain: 0.05, reverb: 0.5 });
      tone({ freq: midi(74), attack: 0.6, release: 1.5, gain: 0.04, reverb: 0.5 });
    },
  };

  function sfx(name) {
    if (!ensure() || !SFX[name]) return;
    if (ctx.state === "suspended") ctx.resume();
    try { SFX[name](); } catch (e) { /* a sound should never break the story */ }
  }

  // Continuous engine rumble: a smooth, seamless loop
  let rumbleGain = null;
  function rumble(level, secs = 0.5) {
    if (!ensure()) return;
    if (!rumbleGain) {
      const src = noise();
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 140;
      lp.Q.value = 0.5;
      rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0;
      src.connect(lp); lp.connect(rumbleGain); rumbleGain.connect(sfxBus);
      src.start();
    }
    const t = ctx.currentTime;
    rumbleGain.gain.cancelScheduledValues(t);
    rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, t);
    rumbleGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)) * 0.55, t + Math.max(0.05, secs));
  }

  /* ---------------- Public API ---------------- */

  window.AstroAudio = {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      if (muted) {
      window.AstroVoice?.stop();
    }
      try { localStorage.setItem("astroMuted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
      if (ctx) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 0.3);
      }
    },
    start() {
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
    },
    stop() {
      if (ctx) rumble(0, 0.5);
    },
    sfx,
    rumble,
  };
})();
