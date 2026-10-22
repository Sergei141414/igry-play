// Поляна со зверятами и праздничные эффекты (конфетти, салют, сердечки). Всё рисуется кодом.
import { SPECIES, TIER_SCALE, drawAnimal } from './animals.js';

const fit = (cv) => {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height };
};

// Псевдослучайность для декораций — одинаковая при каждой перерисовке.
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function createMeadow(cv) {
  let list = [];   // {id, x, depth, dir, speed, rest, happy, born}
  let seq = 0;

  const make = (id, i, born = -10) => ({
    id, x: 0.08 + hash(i + 1) * 0.84, depth: hash(i + 7), dir: hash(i + 3) < 0.5 ? -1 : 1,
    speed: 0.012 + hash(i + 5) * 0.02, rest: hash(i + 9) * 4, happy: 0, born,
  });

  function setAnimals(ids) { list = ids.map((id, i) => make(id, i)); seq = ids.length; }

  // Новый зверь: появляется с прыжком и сердечками. Возвращает его место на экране (для конфетти).
  function add(id, t) {
    const a = make(id, seq++, t);
    a.happy = 1.4;
    list.push(a);
    if (list.length > 60) list.shift();
    return place(a);
  }
  // Все радуются (большой приз).
  const cheer = () => { for (const a of list) a.happy = Math.max(a.happy, 0.9 + hash(a.x * 99) * 0.6); };

  let W = 1, H = 1;
  const ground = () => H * 0.42;
  function place(a) {
    const crowd = Math.max(0.45, Math.min(1, 1.1 - list.length / 50));
    const g = ground();
    const y = g + 12 + a.depth * (H - g - 20);
    const s = Math.min(H * 0.4, W * 0.17) * TIER_SCALE[SPECIES[a.id].tier] * (0.72 + 0.28 * a.depth) * crowd;
    return { x: a.x * W, y, s };
  }

  function scenery(ctx, t) {
    const g = ground();
    const sky = ctx.createLinearGradient(0, 0, 0, g);
    sky.addColorStop(0, '#7fd0ff'); sky.addColorStop(1, '#c9ecff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, g + 2);
    // солнце и облака
    ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(W - 46, 40, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i++) {
      const cx = ((hash(i) * W + t * (6 + i * 3)) % (W + 160)) - 80, cy = 20 + hash(i + 4) * (g * 0.5);
      for (const [dx, dy, r] of [[0, 0, 16], [16, -6, 20], [34, 0, 15]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill(); }
    }
    // холмы и трава
    ctx.fillStyle = '#8fd46a';
    ctx.beginPath(); ctx.moveTo(0, g + 6);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, g - 10 - Math.sin(x / 90) * 12);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    const grass = ctx.createLinearGradient(0, g, 0, H);
    grass.addColorStop(0, '#7cc95a'); grass.addColorStop(1, '#5fb048');
    ctx.fillStyle = grass; ctx.fillRect(0, g, W, H - g);
    // цветы
    for (let i = 0; i < Math.round(W / 40); i++) {
      const x = hash(i + 20) * W, y = g + 8 + hash(i + 40) * (H - g - 10);
      ctx.fillStyle = ['#fff', '#ffd84a', '#ff9bc2', '#c7a6ff'][i % 4];
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function frame(t, dt, emptyText) {
    const f = fit(cv);
    W = f.w; H = f.h;
    const ctx = f.ctx;
    scenery(ctx, t);
    // гуляют: идут, стоят, разворачиваются у краёв
    for (const a of list) {
      if (a.happy > 0) a.happy = Math.max(0, a.happy - dt);
      if (a.rest > 0) { a.rest -= dt; continue; }
      a.x += a.dir * a.speed * dt;
      if (a.x < 0.05 || a.x > 0.95) { a.dir *= -1; a.x = Math.max(0.05, Math.min(0.95, a.x)); }
      if (hash(Math.floor(t * 2) + a.depth * 1000) < 0.004) a.rest = 1 + hash(t) * 3;
    }
    const sorted = [...list].sort((p, q) => p.depth - q.depth);
    for (const a of sorted) {
      const p = place(a);
      const age = t - a.born;
      const pop = age < 0.45 ? Math.max(0.05, Math.sin((age / 0.45) * Math.PI * 0.5) * 1.1) : 1;
      drawAnimal(ctx, a.id, p.x, p.y, p.s * pop, { t, dir: a.dir, happy: a.happy > 0 ? a.happy : 0 });
      if (age >= 0 && age < 1.6) hearts(ctx, p.x, p.y - p.s, age);
    }
    if (!list.length && emptyText) {
      ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center';
      const ty = ground() + (H - ground()) / 2;
      ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,80,30,0.8)'; ctx.strokeText(emptyText, W / 2, ty);
      ctx.fillStyle = '#ffffff'; ctx.fillText(emptyText, W / 2, ty);
    }
  }

  return { setAnimals, add, cheer, frame, get count() { return list.length; } };
}

function hearts(ctx, x, y, age) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
  for (let i = -1; i <= 1; i++) {
    const hx = x + i * 14, hy = y - age * 30 - Math.abs(i) * 6, r = 5;
    ctx.fillStyle = '#ff5f8a';
    ctx.beginPath(); ctx.moveTo(hx, hy + r);
    ctx.bezierCurveTo(hx - r * 2, hy - r * 0.5, hx - r * 0.6, hy - r * 2, hx, hy - r * 0.6);
    ctx.bezierCurveTo(hx + r * 0.6, hy - r * 2, hx + r * 2, hy - r * 0.5, hx, hy + r);
    ctx.fill();
  }
  ctx.restore();
}

// Эффекты поверх всего экрана: конфетти, салют. Кадры идут, только пока есть частицы.
const COLORS = ['#ff5b5b', '#ffa53b', '#ffe14d', '#5fd36b', '#4fb3ff', '#9b6bff', '#ff7ac8'];
export function createFx(cv) {
  const parts = [];
  function confetti(x, y, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = (260 + Math.random() * 360) * power;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: COLORS[i % COLORS.length], life: 2.2 + Math.random(), kind: 'paper' });
    }
  }
  function fireworks(w, h, bursts = 4) {
    for (let b = 0; b < bursts; b++) {
      const cx = w * (0.2 + 0.6 * Math.random()), cy = h * (0.15 + 0.3 * Math.random()), c = COLORS[b % COLORS.length];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2, v = 150 + Math.random() * 120;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, life: 1.4 + Math.random() * 0.6, delay: b * 0.35, kind: 'spark' });
      }
    }
  }
  function frame(dt) {
    if (!parts.length) { if (cv.width) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); } return false; }
    const { ctx, w, h } = fit(cv);
    ctx.clearRect(0, 0, w, h);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.life <= 0 || p.y > h + 40) { parts.splice(i, 1); continue; }
      if (p.kind === 'paper') {
        p.vy += 900 * dt; p.vx *= 0.985; p.vy *= 0.985; p.rot += p.vr * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      } else {
        p.vy += 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98;
        ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    return true;
  }
  const clear = () => { parts.length = 0; };
  return { confetti, fireworks, frame, clear, get active() { return parts.length > 0; } };
}
