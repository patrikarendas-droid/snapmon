/* SNAPMON — tiny WebAudio synth for sound effects. Nothing plays until the player taps something. */
'use strict';

const SFX = (() => {
  let ctx = null, master = null, muted = false;
  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.3, delay = 0, hp = 800, lp = 8000 } = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master); s.start(t);
  }
  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(n, step * 1.6, { ...opts, delay: (opts && opts.delay || 0) + i * step }));
  return {
    unlock: ensure,
    setMuted(m) { muted = m; if (m && ctx) ctx.suspend(); else if (!m && ctx) ctx.resume(); },
    shutter() { noise(0.06, { vol: 0.5, hp: 2000 }); noise(0.09, { vol: 0.3, delay: 0.07, hp: 1200 }); tone(1800, 0.03, { vol: 0.15, delay: 0.02 }); },
    scan() { tone(220, 1.3, { type: 'sine', vol: 0.12, slide: 660 }); tone(440, 1.3, { type: 'triangle', vol: 0.05, slide: 880, delay: 0.05 }); },
    nothing() { tone(300, 0.25, { type: 'triangle', vol: 0.12, slide: -120 }); },
    encounter() { arp([196, 233, 277], 0.09, { type: 'sawtooth', vol: 0.12 }); tone(110, 0.6, { type: 'square', vol: 0.12, delay: 0.25 }); },
    rare() { arp([523, 659, 784, 1046, 1318, 1568], 0.07, { type: 'triangle', vol: 0.16 }); arp([1046, 1318], 0.12, { type: 'sine', vol: 0.1, delay: 0.5 }); },
    legendary() { arp([262, 330, 392, 523, 659, 784, 1046], 0.09, { type: 'square', vol: 0.12 }); tone(65, 1.5, { type: 'sawtooth', vol: 0.15, delay: 0.1 }); arp([1568, 2093], 0.15, { type: 'sine', vol: 0.12, delay: 0.75 }); },
    hit(weapon) {
      if (weapon === 'bullet') { noise(0.05, { vol: 0.35, hp: 1500 }); tone(900, 0.06, { vol: 0.1, slide: -500 }); }
      else if (weapon === 'orb') { tone(600, 0.25, { type: 'sine', vol: 0.18, slide: 600 }); }
      else if (weapon === 'bolt') { noise(0.25, { vol: 0.45, hp: 200 }); tone(80, 0.3, { vol: 0.2, slide: -40 }); }
      else if (weapon === 'hex') { tone(420, 0.12, { type: 'sawtooth', vol: 0.12, slide: -200 }); noise(0.06, { vol: 0.2, hp: 3000 }); }
      else { noise(0.08, { vol: 0.35, hp: 600 }); tone(160, 0.1, { vol: 0.15, slide: -80 }); }
    },
    hurt() { tone(140, 0.18, { type: 'sawtooth', vol: 0.18, slide: -70 }); noise(0.1, { vol: 0.2, hp: 300 }); },
    miss() { tone(500, 0.15, { type: 'sine', vol: 0.08, slide: -300 }); },
    heal() { arp([523, 659, 784], 0.06, { type: 'sine', vol: 0.14 }); },
    status() { tone(330, 0.2, { type: 'triangle', vol: 0.1, slide: 100 }); },
    trap() { tone(900, 0.08, { vol: 0.1 }); tone(1200, 0.08, { vol: 0.1, delay: 0.1 }); tone(900, 0.08, { vol: 0.1, delay: 0.2 }); },
    capture() { arp([392, 523, 659, 784, 1046], 0.08, { type: 'square', vol: 0.12 }); },
    breakfree() { noise(0.2, { vol: 0.3, hp: 500 }); tone(300, 0.2, { vol: 0.12, slide: -200 }); },
    victory() { arp([523, 523, 784, 1046], 0.1, { type: 'square', vol: 0.12 }); },
    defeat() { arp([392, 330, 262, 196], 0.18, { type: 'triangle', vol: 0.14 }); },
    levelup() { arp([392, 494, 587, 784, 988, 1175], 0.07, { type: 'square', vol: 0.12 }); tone(1568, 0.5, { type: 'sine', vol: 0.12, delay: 0.45 }); },
    click() { tone(1200, 0.025, { type: 'square', vol: 0.05 }); },
    coin() { tone(988, 0.06, { type: 'square', vol: 0.08 }); tone(1319, 0.12, { type: 'square', vol: 0.08, delay: 0.06 }); },
  };
})();
