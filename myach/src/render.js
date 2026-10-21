// Отрисовка поля на canvas. Вся графика — кодом: архив лёгкий, на любом экране резко.

const COL = {
  grassA: '#3fa34d', grassB: '#379445', line: 'rgba(255,255,255,0.55)',
  cone: '#ff7a1a', coneDark: '#d95a00', mud: '#7a5230', mudDark: '#5c3b20',
  bumper: '#e8eef5', bumperEdge: '#7d8ea3', crate: '#c8924f', crateDark: '#8a5a26',
  portal: { p: '#a35cff', P: '#a35cff', q: '#21c7d9', Q: '#21c7d9' },
  hint: '#ffd23f', tutor: '#ffffff',
};

// Футбольный мяч сверху: усечённый икосаэдр в проекции. Центральный пятиугольник, швы от его
// вершин к пятиугольникам у края (сжаты по радиусу — перспектива сферы), светотень и блик.
// rot — поворот рисунка: при качении мяч «крутится».
export function drawBall(ctx, x, y, r, rot = 0) {
  const ink = '#1c1d21';
  const vert = (k) => rot + (k * Math.PI * 2) / 5 - Math.PI / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const base = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  base.addColorStop(0, '#ffffff'); base.addColorStop(0.7, '#eef0f3'); base.addColorStop(1, '#c9ced6');
  ctx.fillStyle = base;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);

  const p = r * 0.33; // центральный пятиугольник
  const d = r * 0.9; // центры пятиугольников у края
  const pr = r * 0.32;
  const squash = 0.55;
  const outer = (k) => [x + Math.cos(vert(k)) * d, y + Math.sin(vert(k)) * d];
  // Вершина j внешнего пятиугольника k в координатах холста (j = 0 смотрит к центру).
  const outerVertex = (k, j) => {
    const a = Math.PI + (j * Math.PI * 2) / 5;
    const lx = Math.cos(a) * pr * squash, ly = Math.sin(a) * pr;
    const t = vert(k), [cx, cy] = outer(k);
    return [cx + lx * Math.cos(t) - ly * Math.sin(t), cy + lx * Math.sin(t) + ly * Math.cos(t)];
  };
  // Швы шестиугольников: от вершин центра к внутренним вершинам внешних пятиугольников
  // и между соседними внешними пятиугольниками.
  ctx.strokeStyle = 'rgba(40,44,52,0.45)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.lineCap = 'round';
  for (let k = 0; k < 5; k++) {
    const a = vert(k);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * p, y + Math.sin(a) * p);
    ctx.lineTo(x + Math.cos(a) * (d - pr * squash), y + Math.sin(a) * (d - pr * squash));
    ctx.stroke();
    // Внешняя грань шестиугольника k: от вершины пятиугольника k (к соседу k+1)
    // к вершине пятиугольника k+1 (к соседу k), дальше швы уходят за край мяча.
    const a1 = outerVertex(k, 4), a2 = outerVertex(k + 1, 1);
    ctx.beginPath(); ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.stroke();
    for (const [vx, vy] of [a1, a2]) {
      const dx = vx - x, dy = vy - y, len = Math.hypot(dx, dy) || 1;
      ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(x + (dx / len) * r * 1.1, y + (dy / len) * r * 1.1); ctx.stroke();
    }
  }
  ctx.fillStyle = ink;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = vert(k);
    k ? ctx.lineTo(x + Math.cos(a) * p, y + Math.sin(a) * p) : ctx.moveTo(x + Math.cos(a) * p, y + Math.sin(a) * p);
  }
  ctx.closePath(); ctx.fill();
  for (let k = 0; k < 5; k++) {
    const [ox, oy] = outer(k);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(vert(k));
    ctx.scale(squash, 1);
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const a = Math.PI + (j * Math.PI * 2) / 5;
      j ? ctx.lineTo(Math.cos(a) * pr, Math.sin(a) * pr) : ctx.moveTo(Math.cos(a) * pr, Math.sin(a) * pr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Объём: затемнение к краю и блик сверху слева.
  const shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.2, x, y, r * 1.05);
  shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(0.75, 'rgba(0,0,0,0.08)'); shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let geo = { s: 40, ox: 0, oy: 0, w: 1, h: 1, dpr: 1 };

  function layout(c, cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const pad = Math.min(cssW, cssH) * 0.03;
    const s = Math.floor(Math.min((cssW - pad * 2) / c.w, (cssH - pad * 2) / c.h));
    geo = { s, ox: Math.round((cssW - s * c.w) / 2), oy: Math.round((cssH - s * c.h) / 2), w: c.w, h: c.h, dpr, cssW, cssH };
    return geo;
  }

  // Экранная точка → клетка (для щелчка по полю).
  const toCell = (px, py) => [(px - geo.ox) / geo.s - 0.5, (py - geo.oy) / geo.s - 0.5];

  function draw(v) {
    const { c } = v;
    const { s, ox, oy, dpr } = geo;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geo.cssW, geo.cssH);
    // Газон полосами и разметка.
    for (let y = 0; y < c.h; y++) {
      ctx.fillStyle = y % 2 ? COL.grassB : COL.grassA;
      ctx.fillRect(ox, oy + y * s, s * c.w, s);
    }
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = Math.max(2, s * 0.05);
    // bare — без рамки и круга: для иконки и обложек, где поле продолжается до края картинки.
    if (!v.bare) {
      roundRect(ox + 1, oy + 1, s * c.w - 2, s * c.h - 2, s * 0.15);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(ox + (s * c.w) / 2, oy + (s * c.h) / 2, s * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    portalLinks(c, s, ox, oy);
    goalHint(c, s, ox, oy);

    for (let i = 0; i < c.grid.length; i++) {
      const ch = c.grid[i];
      if (ch === '.') continue;
      const x = ox + (i % c.w) * s, y = oy + Math.floor(i / c.w) * s;
      if (ch === '#') cone(x, y, s);
      else if (ch === 'm') mud(x, y, s);
      else if (ch === '/' || ch === '\\') bumper(x, y, s, ch);
      else if (c.portalTwin.has(i)) portal(x, y, s, ch, v.time);
      else if (ch === 'x') { if (!(v.mask & c.fragileBit.get(i))) crate(x, y, s, v.shake?.pos === i ? v.shake.amount : 0); }
      else if (ch === 'G') goal(x, y, s, c, i, v.netWave || 0);
    }

    for (const p of v.particles || []) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(ox + p.x * s - p.r * s, oy + p.y * s - p.r * s, p.r * s * 2, p.r * s * 2);
    }
    ctx.globalAlpha = 1;

    if (v.arrow) arrow(v.ball, v.arrow.dir, v.arrow.color === 'tutor' ? COL.tutor : COL.hint, v.time);
    if (v.ball && v.ballAlpha !== 0) ball(v.ball[0], v.ball[1], v.roll || 0, v.ballAlpha ?? 1, v.ballScale ?? 1);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cone(x, y, s) {
    const cx = x + s / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, y + s * 0.82, s * 0.34, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.coneDark;
    ctx.fillRect(x + s * 0.18, y + s * 0.74, s * 0.64, s * 0.1);
    ctx.fillStyle = COL.cone;
    ctx.beginPath();
    ctx.moveTo(cx, y + s * 0.12);
    ctx.lineTo(x + s * 0.74, y + s * 0.76);
    ctx.lineTo(x + s * 0.26, y + s * 0.76);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.4, y + s * 0.42); ctx.lineTo(x + s * 0.6, y + s * 0.42);
    ctx.lineTo(x + s * 0.65, y + s * 0.53); ctx.lineTo(x + s * 0.35, y + s * 0.53);
    ctx.closePath(); ctx.fill();
  }

  // Грязь — лужа: неровное пятно, мокрый блеск, брызги вокруг.
  function mud(x, y, s) {
    const cx = x + s / 2, cy = y + s / 2;
    ctx.fillStyle = COL.mudDark;
    [[0, 0, 0.42, 0.32, 0.2], [-0.16, 0.1, 0.22, 0.18, 0], [0.18, -0.08, 0.2, 0.17, 0.5]].forEach(([dx, dy, rx, ry, a]) => {
      ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, rx * s, ry * s, a, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = COL.mud;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, s * 0.33, s * 0.23, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.2, s * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.08, cy - s * 0.06, s * 0.16, s * 0.07, 0.2, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.1, cy + s * 0.08, s * 0.1, s * 0.045, 0.2, Math.PI * 0.1, Math.PI * 0.6); ctx.stroke();
    ctx.fillStyle = COL.mudDark;
    [[-0.4, -0.3, 0.035], [0.38, -0.28, 0.03], [0.42, 0.3, 0.04], [-0.36, 0.34, 0.03]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Отбойник — толстая металлическая планка по диагонали и стрелки поворота по обе стороны.
  function bumper(x, y, s, ch) {
    const slash = ch === '/';
    // Стрелки: куда мяч уйдёт, въехав с этой стороны (по правилу движка).
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1.5, s * 0.045);
    const r = s * 0.3;
    const arcs = slash
      ? [[x, y, Math.PI / 2, 0, true, [0, -1]], [x + s, y + s, -Math.PI / 2, Math.PI, true, [0, 1]]]
      : [[x + s, y, Math.PI / 2, Math.PI, false, [0, -1]], [x, y + s, -Math.PI / 2, 0, false, [0, 1]]];
    for (const [ax, ay, from, to, ccw, [hx, hy]] of arcs) {
      ctx.beginPath(); ctx.arc(ax, ay, r, from, to, ccw); ctx.stroke();
      const ex = ax + Math.cos(to) * r, ey = ay + Math.sin(to) * r;
      const k = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(ex + hx * k, ey + hy * k);
      ctx.lineTo(ex - k * 0.8, ey - hy * k * 0.2);
      ctx.lineTo(ex + k * 0.8, ey - hy * k * 0.2);
      ctx.closePath(); ctx.fill();
    }
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate(slash ? -Math.PI / 4 : Math.PI / 4);
    const L = s * 0.62, T = s * 0.13;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-L + s * 0.03, -T + s * 0.05, L * 2, T * 2, T * 0.6); ctx.fill();
    const g = ctx.createLinearGradient(0, -T, 0, T);
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(0.45, '#c6d0dc'); g.addColorStop(1, '#7f8c9c');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#56606d';
    ctx.lineWidth = Math.max(1, s * 0.03);
    roundRect(-L, -T, L * 2, T * 2, T * 0.6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#56606d';
    for (const bx of [-L * 0.7, L * 0.7]) { ctx.beginPath(); ctx.arc(bx, 0, T * 0.32, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // Пунктир между парными порталами — видно, откуда мяч выйдет.
  function portalLinks(c, s, ox, oy) {
    const done = new Set();
    ctx.save();
    ctx.setLineDash([s * 0.12, s * 0.14]);
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const [a, b] of c.portalTwin) {
      if (done.has(a)) continue;
      done.add(a); done.add(b);
      ctx.strokeStyle = (COL.portal[c.grid[a]] || '#fff') + '66';
      ctx.beginPath();
      ctx.moveTo(ox + (a % c.w + 0.5) * s, oy + (Math.floor(a / c.w) + 0.5) * s);
      ctx.lineTo(ox + (b % c.w + 0.5) * s, oy + (Math.floor(b / c.w) + 0.5) * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Стрелка на траве перед створом ворот — «забивать сюда».
  function goalHint(c, s, ox, oy) {
    if (!c.goalDir) return;
    const [dx, dy] = c.goalDir;
    const gx = c.goal % c.w, gy = Math.floor(c.goal / c.w);
    const fx = ox + (gx - dx + 0.5) * s, fy = oy + (gy - dy + 0.5) * s;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const off of [-0.18, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(off * s + s * 0.16, 0);
      ctx.lineTo(off * s - s * 0.06, -s * 0.18);
      ctx.lineTo(off * s, 0);
      ctx.lineTo(off * s - s * 0.06, s * 0.18);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Портал: кольцо цвета пары, воронка и знак пары (у обоих порталов одинаковый).
  function portal(x, y, s, ch, t) {
    const color = COL.portal[ch];
    const cx = x + s / 2, cy = y + s / 2;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(0, 0, s * 0.04, 0, 0, s * 0.4);
    g.addColorStop(0, '#0b0b25'); g.addColorStop(0.7, color + 'aa'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.33, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.rotate(t * 2.2);
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 3; k++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, Math.PI * 0.7); ctx.stroke();
    }
    ctx.restore();
    // Знак пары: звезда у фиолетовой, ромб у бирюзовой.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ch === 'p' || ch === 'P') {
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.045 : s * 0.11;
        k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else {
      ctx.moveTo(0, -s * 0.11); ctx.lineTo(s * 0.08, 0); ctx.lineTo(0, s * 0.11); ctx.lineTo(-s * 0.08, 0);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Хрупкая стенка — ящик из досок с трещиной: видно, что сломается.
  function crate(x, y, s, shake) {
    const dx = shake ? Math.sin(shake * 40) * s * 0.05 : 0;
    const m = s * 0.12, w = s - 2 * m;
    const x0 = x + m + dx, y0 = y + m;
    ctx.fillStyle = COL.crate;
    ctx.fillRect(x0, y0, w, w);
    ctx.strokeStyle = COL.crateDark;
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.strokeRect(x0, y0, w, w);
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (const k of [1, 2]) { ctx.beginPath(); ctx.moveTo(x0, y0 + (w * k) / 3); ctx.lineTo(x0 + w, y0 + (w * k) / 3); ctx.stroke(); }
    // Трещина зигзагом через все доски.
    ctx.strokeStyle = '#3d2410';
    ctx.lineWidth = Math.max(1.5, s * 0.045);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = [[0.55, 0], [0.42, 0.22], [0.6, 0.4], [0.44, 0.6], [0.58, 0.8], [0.47, 1]];
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(x0 + px * w, y0 + py * w) : ctx.moveTo(x0 + px * w, y0 + py * w)));
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 0.6 * w, y0 + 0.4 * w); ctx.lineTo(x0 + 0.78 * w, y0 + 0.46 * w); ctx.stroke();
  }

  // Ворота смотрят внутрь поля: сетка у края, рамка со стороны поля.
  function goal(x, y, s, c, i, wave) {
    // Сторона — из движка (c.goalDir), чтобы рисунок совпадал с правилом гола.
    const [gdx, gdy] = c.goalDir || [0, -1];
    const side = gdy < 0 ? 'top' : gdy > 0 ? 'bottom' : gdx < 0 ? 'left' : 'right';
    ctx.save();
    ctx.translate(x + s / 2, y + s / 2);
    ctx.rotate({ top: 0, right: Math.PI / 2, bottom: Math.PI, left: -Math.PI / 2 }[side]);
    const w = s * 0.9, d = s * 0.55;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-w / 2, -s / 2 + 2, w, d);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    const step = s * 0.11;
    for (let k = -w / 2; k <= w / 2; k += step) {
      ctx.beginPath(); ctx.moveTo(k, -s / 2 + 2); ctx.lineTo(k + Math.sin(wave * 10 + k) * wave * s * 0.05, -s / 2 + 2 + d); ctx.stroke();
    }
    for (let k = -s / 2 + 2; k <= -s / 2 + 2 + d; k += step) {
      ctx.beginPath(); ctx.moveTo(-w / 2, k); ctx.lineTo(w / 2, k); ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(3, s * 0.09);
    ctx.lineCap = 'round';
    // Буква «П» открыта к полю: штанги спереди, сетка сзади, у края.
    const back = -s / 2 + 2, front = back + d;
    ctx.beginPath();
    ctx.moveTo(-w / 2, front); ctx.lineTo(-w / 2, back); ctx.lineTo(w / 2, back); ctx.lineTo(w / 2, front);
    ctx.stroke();
    ctx.restore();
  }

  function ball(cx, cy, roll, alpha, scale) {
    const { s, ox, oy } = geo;
    const x = ox + (cx + 0.5) * s, y = oy + (cy + 0.5) * s;
    const r = s * 0.34 * scale;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + r * 0.15, y + r * 0.85, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    drawBall(ctx, x, y, r, roll);
    ctx.globalAlpha = 1;
  }

  function arrow(ballXY, dir, color, t) {
    const { s, ox, oy } = geo;
    const [dx, dy] = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }[dir];
    const pulse = (Math.sin(t * 6) + 1) / 2;
    const x0 = ox + (ballXY[0] + 0.5 + dx * 0.55) * s, y0 = oy + (ballXY[1] + 0.5 + dy * 0.55) * s;
    const len = s * (0.9 + pulse * 0.3);
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1); ctx.lineTo(len - s * 0.3, -s * 0.1); ctx.lineTo(len - s * 0.3, -s * 0.24);
    ctx.lineTo(len, 0); ctx.lineTo(len - s * 0.3, s * 0.24); ctx.lineTo(len - s * 0.3, s * 0.1); ctx.lineTo(0, s * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  return { layout, draw, toCell, get geo() { return geo; } };
}
