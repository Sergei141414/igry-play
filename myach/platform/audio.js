// Звук без файлов: короткие синтезированные эффекты через WebAudio.
// Контекст создаётся по первому касанию (иначе браузер его не запустит),
// на паузе (вкладка, реклама, потеря фокуса — требования 1.3, 4.7) — suspend.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let paused = false;

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (!paused && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  function tone({ freq, to = freq, dur = 0.12, type = 'sine', gain = 0.15, delay = 0 }) {
    if (muted || paused) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const sounds = {
    roll: () => tone({ freq: 220, to: 160, dur: 0.14, type: 'triangle', gain: 0.08 }),
    bump: () => tone({ freq: 140, to: 70, dur: 0.1, type: 'square', gain: 0.06 }),
    crack: () => { tone({ freq: 600, to: 120, dur: 0.18, type: 'sawtooth', gain: 0.06 }); },
    portal: () => tone({ freq: 400, to: 900, dur: 0.2, type: 'sine', gain: 0.08 }),
    mud: () => tone({ freq: 90, to: 60, dur: 0.18, type: 'triangle', gain: 0.1 }),
    goal: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.12, delay: i * 0.09 })),
    click: () => tone({ freq: 700, dur: 0.05, type: 'sine', gain: 0.05 }),
  };

  return {
    unlock: () => { ensure(); },
    play: (name) => { try { sounds[name]?.(); } catch {} },
    get muted() { return muted; },
    setMuted(m) { muted = m; },
    pause() { paused = true; ctx?.suspend().catch(() => {}); },
    resume() { paused = false; if (ctx && !muted) ctx.resume().catch(() => {}); },
    get state() { return ctx ? ctx.state : 'none'; },
  };
}
