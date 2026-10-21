// «Мяч к воротам»: экраны, управление, анимация, реклама и сохранения.
import { compile, move, hint, stars, DIRS } from './engine.js';
import LEVELS from './levels.js';
import { createRenderer, drawBall } from './render.js';
import { texts } from './i18n.js';
import { initPlatform } from '../platform/ysdk.js';
import { createAudio } from '../platform/audio.js';

const PER_CHAPTER = 25;
const TUTORIAL_LEVELS = 3;        // на них стрелка-подсказка бесплатно и постоянно
const ADS_FROM_LEVEL = 3;         // полноэкранная реклама — после 3-го пройденного уровня
const SPEED = 14;                 // клеток в секунду
const SAVE_KEY = 'myach-v1';
const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};

const $ = (id) => document.getElementById(id);
const audio = createAudio();
let T = texts('ru');
let platform;
let data = { v: 1, stars: {}, skipped: [], unlocked: 1, sound: true, intro: [] };

// ---------- сохранения ----------

function merge(local, cloud) {
  const a = local?.v === 1 ? local : null;
  const b = cloud?.v === 1 ? cloud : null;
  if (!a && !b) return data;
  const out = { ...data, ...(b || {}), ...(a || {}) };
  out.stars = { ...(b?.stars || {}) };
  for (const [k, v] of Object.entries(a?.stars || {})) out.stars[k] = Math.max(v, out.stars[k] || 0);
  out.unlocked = Math.max(a?.unlocked || 1, b?.unlocked || 1);
  out.skipped = [...new Set([...(a?.skipped || []), ...(b?.skipped || [])])].filter((n) => !out.stars[n]);
  out.intro = [...new Set([...(a?.intro || []), ...(b?.intro || [])])];
  return out;
}
const save = () => platform.save(data);
const totalStars = () => Object.values(data.stars).reduce((s, v) => s + v, 0);

// ---------- экраны ----------

let screen = 'menu';
let overlay = null;

function show(name) {
  screen = name;
  for (const s of ['menu', 'levels', 'game']) $(s).hidden = s !== name;
  if (name === 'menu') renderMenu();
  if (name === 'levels') renderLevels();
  if (name === 'game') requestAnimationFrame(relayout);
  updatePlaying();
}

function openOverlay(name) {
  overlay = name;
  $("toast").hidden = true; // сообщение не висит поверх окна
  for (const o of ['ov-intro', 'ov-win', 'ov-pause']) $(o).hidden = o !== `ov-${name}`;
  updatePlaying();
  const first = $(`ov-${name}`)?.querySelector('button');
  first?.focus({ preventScroll: true });
}
function closeOverlay() {
  overlay = null;
  for (const o of ['ov-intro', 'ov-win', 'ov-pause']) $(o).hidden = true;
  updatePlaying();
}

// Геймплей идёт только на экране уровня без открытых окон (требование 1.19.3).
function updatePlaying() {
  platform?.setPlaying(screen === 'game' && !overlay && !game?.won);
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function renderMenu() {
  drawMenuBall();
  $('menu-title').textContent = T.name;
  $('menu-tagline').textContent = T.tagline;
  $('btn-play').textContent = T.play;
  $('btn-levels').textContent = T.levels;
  $('menu-stars').textContent = T.stars(totalStars(), LEVELS.length * 3);
  $('menu-controls').textContent = coarse() ? T.controlsTouch : T.controlsDesk;
  renderSound();
}

function drawMenuBall() {
  const cv = $('menu-ball');
  const size = cv.getBoundingClientRect().width || 120;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = cv.height = Math.round(size * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(size / 2 + size * 0.04, size * 0.9, size * 0.36, size * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  drawBall(ctx, size / 2, size * 0.46, size * 0.42, 0.3);
}

function renderSound() {
  for (const id of ['btn-sound', 'p-sound']) $(id).textContent = data.sound ? T.soundOn : T.soundOff;
}

function renderLevels() {
  $('levels-title').textContent = T.levels;
  const box = $('levels-list');
  box.textContent = '';
  const current = firstUnfinished(); // подсвечен рамкой — «вы здесь»
  for (let ch = 0; ch < LEVELS.length / PER_CHAPTER; ch++) {
    const h = document.createElement('h3');
    h.textContent = `${ch + 1}. ${T.chapters[ch]}`;
    box.append(h);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let k = 0; k < PER_CHAPTER; k++) {
      const n = ch * PER_CHAPTER + k + 1;
      const b = document.createElement('button');
      b.className = 'lvl';
      const st = data.stars[n] || 0;
      const locked = n > data.unlocked;
      if (locked) b.classList.add('locked');
      if (n === current) b.classList.add('current');
      b.disabled = locked;
      b.innerHTML = `<span>${n}</span><small>${locked ? '🔒' : '★'.repeat(st) + '☆'.repeat(3 - st)}</small>`;
      if (!locked) b.addEventListener('click', () => startLevel(n));
      grid.append(b);
    }
    box.append(grid);
  }
  // Сразу к текущей главе.
  const cur = box.querySelectorAll('h3')[Math.floor((Math.min(data.unlocked, LEVELS.length) - 1) / PER_CHAPTER)];
  cur?.scrollIntoView({ block: 'start' });
}

// ---------- уровень ----------

let game = null;
const renderer = createRenderer($('cv'));
let clock = 0;           // игровое время, стоит на паузе
let last = performance.now();

function startLevel(n) {
  const lv = LEVELS[n - 1];
  const c = compile(lv);
  game = { n, lv, c, state: c.start, history: [], won: false, anim: null, queued: null, arrow: null, particles: [], netWave: 0 };
  $('lvl-title').textContent = T.level(n);
  $('lvl-target').textContent = T.target(lv.opt);
  $('btn-hint').hidden = n <= TUTORIAL_LEVELS;
  closeOverlay();
  // «Новинка» открывается до показа уровня, чтобы геймплей не стартовал на долю секунды.
  const firstOfChapter = (n - 1) % PER_CHAPTER === 0 && lv.ch > 1;
  if (firstOfChapter && !data.intro.includes(lv.ch)) showIntro(lv.ch);
  show('game');
  updateHud();
}

function showIntro(ch) {
  const key = ['', 'm', 'd', 'p', 'x', 'all'][ch - 1];
  const [title, body] = T.intro[key];
  $('intro-title').textContent = title;
  $('intro-body').textContent = body;
  $('intro-ok').textContent = T.got;
  drawIntroIcon(key);
  openOverlay('intro');
}

function drawIntroIcon(key) {
  const cv = $('intro-cv');
  const { rows, ball } = {
    m: { rows: ['.m.', '..G'], ball: [0, 0] }, d: { rows: ['./.', '..G'], ball: [0, 0] },
    p: { rows: ['p.P', '..G'], ball: [1, 0] }, x: { rows: ['.x.', '..G'], ball: [0, 0] },
    all: { rows: ['m/x.', 'p.GP'], ball: [1, 1] },
  }[key];
  const c = compile({ rows, ball });
  const r = createRenderer(cv);
  r.layout(c, 180, 120);
  r.draw({ c, mask: 0, time: 0, ball });
}

function updateHud() {
  $('moves').textContent = T.moves(game.history.length);
  $('btn-undo').disabled = !game.history.length || !!game.anim || game.won;
  $('caption').textContent = game.n <= TUTORIAL_LEVELS ? (coarse() ? T.controlsTouch : T.controlsDesk) : '';
  if (game.n <= TUTORIAL_LEVELS && !game.won) game.arrow = { dir: hint(game.c, game.state), color: 'tutor' };
}

const coarse = () => matchMedia('(pointer: coarse)').matches;

function tryMove(dir) {
  if (!game || game.won || overlay || screen !== 'game' || platform.isPausedExternally()) return;
  if (game.anim) { game.queued = dir; return; }
  const r = move(game.c, game.state, dir);
  if (!r.moved) { audio.play('bump'); return; }
  game.history.push(game.state);
  if (game.arrow?.color === 'hint') game.arrow = null;
  if (game.n <= TUTORIAL_LEVELS) game.arrow = null;
  startAnim(r);
  updateHud();
}

function startAnim(r) {
  // Ключевые точки: [x, y, длительность до неё, событие].
  const pts = [];
  const xy = (pos) => [pos % game.c.w, Math.floor(pos / game.c.w)];
  let prev = xy(r.path[0].pos);
  for (let i = 1; i < r.path.length; i++) {
    const p = r.path[i];
    const cur = xy(p.pos);
    if (p.teleport) { pts.push({ at: cur, dur: 0.22, kind: 'teleport', from: prev }); prev = cur; continue; }
    if (p.bump) {
      const mid = [prev[0] + (cur[0] - prev[0]) * 0.35, prev[1] + (cur[1] - prev[1]) * 0.35];
      pts.push({ at: mid, dur: 0.08, kind: 'bump', wall: p.pos }, { at: prev, dur: 0.1, kind: 'back' });
      continue;
    }
    pts.push({ at: cur, dur: 1 / SPEED, kind: 'roll' });
    prev = cur;
  }
  game.anim = { r, pts, i: 0, t: 0, from: xy(r.path[0].pos), roll: game.anim?.roll || 0 };
  audio.play('roll');
}

function stepAnim(dt) {
  const a = game.anim;
  a.t += dt;
  while (a.i < a.pts.length && a.t >= a.pts[a.i].dur) {
    const p = a.pts[a.i];
    a.t -= p.dur;
    if (p.kind === 'teleport') audio.play('portal');
    if (p.kind === 'bump') {
      game.maskVis = a.r.state.mask; // стенка ломается в момент удара, а не после отката мяча
      audio.play('crack');
      burst(p.wall, '#c8924f', 10);
    }
    a.from = p.at;
    a.i++;
  }
  if (a.i >= a.pts.length) return finishAnim();
  const p = a.pts[a.i];
  const k = Math.min(1, a.t / p.dur);
  if (p.kind === 'teleport') {
    game.ballXY = k < 0.5 ? p.from : p.at;
    game.ballScale = Math.abs(1 - k * 2);
  } else {
    game.ballXY = [a.from[0] + (p.at[0] - a.from[0]) * k, a.from[1] + (p.at[1] - a.from[1]) * k];
    game.ballScale = 1;
    if (p.kind === 'roll') a.roll += dt * SPEED * 1.2;
  }
}

function finishAnim() {
  const { r } = game.anim;
  game.roll = game.anim.roll;
  game.anim = null;
  game.maskVis = null;
  game.state = r.state;
  game.ballXY = null;
  game.ballScale = 1;
  const cell = game.c.grid[r.state.pos];
  if (r.won) return win();
  if (cell === 'm') audio.play('mud'); else audio.play('bump');
  updateHud();
  if (game.queued) { const d = game.queued; game.queued = null; tryMove(d); }
}

function burst(pos, color, n) {
  const x = pos % game.c.w + 0.5, y = Math.floor(pos / game.c.w) + 0.5;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 2;
    game.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, r: 0.04 + Math.random() * 0.04, color });
  }
}

function win() {
  game.won = true;
  updatePlaying();
  audio.play('goal');
  game.netWave = 1;
  burst(game.c.goal, '#ffd23f', 24);
  burst(game.c.goal, '#ffffff', 16);
  const moves = game.history.length;
  const st = stars(moves, game.lv.opt);
  data.stars[game.n] = Math.max(st, data.stars[game.n] || 0);
  data.skipped = data.skipped.filter((x) => x !== game.n);
  data.unlocked = Math.max(data.unlocked, Math.min(game.n + 1, LEVELS.length));
  save(); // сразу после победы — требование 1.9
  setTimeout(() => {
    if (!game?.won) return;
    $('win-title').textContent = T.goal;
    $('win-stars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
    $('win-result').textContent = T.result(moves, game.lv.opt);
    $('win-next').textContent = game.n < LEVELS.length ? T.next : T.levels;
    $('win-restart').textContent = T.restart;
    $('win-levels').textContent = T.levels;
    // Панель — на половине экрана, противоположной воротам: мяч в сетке остаётся виден.
    const goalRect = $('cv').getBoundingClientRect();
    const gy = goalRect.top + renderer.geo.oy + (Math.floor(game.c.goal / game.c.w) + 0.5) * renderer.geo.s;
    $('ov-win').style.alignItems = gy > window.innerHeight / 2 ? 'flex-start' : 'flex-end';
    openOverlay('win');
  }, 1100); // сначала мяч влетает в сетку и конфетти, потом панель
}

async function nextLevel() {
  const done = game.n;
  if (done >= ADS_FROM_LEVEL) await platform.showInterstitial(); // логическая пауза после победы (4.4)
  if (done >= LEVELS.length) { toast(T.allDone); show('levels'); return; }
  startLevel(done + 1);
}

function undo() {
  if (!game || game.anim || game.won || !game.history.length) return;
  game.state = game.history.pop();
  game.arrow = null;
  updateHud();
}

function restart() {
  if (!game) return;
  startLevel(game.n);
}

async function rewardedHint() {
  if (!game || game.anim || game.won) return;
  const res = await platform.showRewarded();
  if (!res.rewarded) {
    // Реклама не загрузилась (не по вине игрока) — одна подсказка на уровень бесплатно,
    // чтобы на трудном уровне не остаться без выхода. Закрыл рекламу сам — награды нет.
    if (res.error && !game.freeHintUsed) {
      game.freeHintUsed = true;
      toast(T.adFailFreeHint);
      return showHintArrow();
    }
    return toast(res.error ? T.adFail : T.adNotFinished);
  }
  showHintArrow();
}

function showHintArrow() {
  const dir = hint(game.c, game.state);
  if (!dir) return toast(T.noHint);
  game.arrow = { dir, color: 'hint' };
}

async function rewardedSkip() {
  if (!game || game.n >= LEVELS.length) return;
  const res = await platform.showRewarded();
  if (!res.rewarded) return toast(res.error ? T.adFail : T.adNotFinished);
  if (!data.skipped.includes(game.n)) data.skipped.push(game.n);
  data.unlocked = Math.max(data.unlocked, game.n + 1);
  save();
  toast(T.skipped);
  startLevel(game.n + 1);
}

function openPause() {
  if (screen !== 'game' || overlay) return;
  $('p-title').textContent = T.pause;
  $('p-resume').textContent = T.resume;
  $('p-skip').innerHTML = `▶ ${T.skip} <small>${T.forAd}</small>`;
  $('p-skip').hidden = game.n >= LEVELS.length;
  $('p-levels').textContent = T.levels;
  $('p-menu').textContent = T.menu;
  renderSound();
  openOverlay('pause');
}

// ---------- цикл кадров ----------

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const paused = platform?.isPausedExternally();
  if (!paused) clock += dt;
  if (game && screen === 'game') {
    if (!paused) {
      if (game.anim) stepAnim(dt);
      for (const p of game.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 4 * dt; p.life -= dt * 1.4; }
      game.particles = game.particles.filter((p) => p.life > 0);
      game.netWave = Math.max(0, game.netWave - dt);
    }
    const xy = game.ballXY || [game.state.pos % game.c.w, Math.floor(game.state.pos / game.c.w)];
    const atGoal = game.won && !game.anim;
    renderer.draw({
      c: game.c, mask: game.maskVis ?? game.state.mask, time: clock,
      ball: xy, roll: game.anim?.roll ?? game.roll ?? 0, ballScale: atGoal ? 0.8 : game.ballScale ?? 1,
      arrow: game.anim || game.won ? null : game.arrow,
      particles: game.particles, netWave: game.netWave,
    });
  }
  requestAnimationFrame(frame);
}

function relayout() {
  if (!game) return;
  const box = $('board').getBoundingClientRect();
  renderer.layout(game.c, Math.max(50, box.width), Math.max(50, box.height));
}

// ---------- ввод ----------

function bindInput() {
  document.addEventListener('keydown', (e) => {
    if (KEYS[e.code]) {
      e.preventDefault();
      if (screen === 'game' && !overlay) tryMove(KEYS[e.code]);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (overlay === 'pause') closeOverlay();
      else openPause();
    }
    if (e.code === 'KeyZ' || e.code === 'Backspace') { if (screen === 'game' && !overlay) { e.preventDefault(); undo(); } }
    if (e.code === 'KeyR' && screen === 'game' && !overlay) restart();
  });

  const board = $('board');
  let down = null;
  board.addEventListener('pointerdown', (e) => {
    audio.unlock();
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    board.setPointerCapture?.(e.pointerId);
  });
  board.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (Math.hypot(dx, dy) > 24) return tryMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    // Касание/щелчок: направление от мяча к точке.
    const rect = $('cv').getBoundingClientRect();
    const [cx, cy] = renderer.toCell(e.clientX - rect.left, e.clientY - rect.top);
    const bx = game.state.pos % game.c.w, by = Math.floor(game.state.pos / game.c.w);
    const ddx = cx - bx, ddy = cy - by;
    if (Math.max(Math.abs(ddx), Math.abs(ddy)) < 0.5) return;
    tryMove(Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : (ddy > 0 ? 'down' : 'up'));
  });
  board.addEventListener('pointercancel', () => { down = null; });
  // Долгое нажатие и правый щелчок не открывают меню и не выделяют (1.6.1.8, 1.6.2.7).
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

  const on = (id, fn) => $(id).addEventListener('click', () => { audio.play('click'); fn(); });
  on('btn-play', () => startLevel(Math.min(firstUnfinished(), LEVELS.length)));
  on('btn-levels', () => show('levels'));
  on('levels-back', () => show('menu'));
  on('btn-sound', toggleSound);
  on('p-sound', toggleSound);
  on('btn-pause', openPause);
  on('btn-undo', undo);
  on('btn-restart', restart);
  on('btn-hint', rewardedHint);
  on('p-resume', closeOverlay);
  on('p-skip', rewardedSkip);
  on('p-levels', () => { closeOverlay(); game = null; show('levels'); });
  on('p-menu', () => { closeOverlay(); game = null; show('menu'); });
  on('intro-ok', () => {
    if (!data.intro.includes(game.lv.ch)) data.intro.push(game.lv.ch);
    save();
    closeOverlay();
  });
  on('win-next', () => { closeOverlay(); nextLevel(); });
  on('win-restart', () => { closeOverlay(); restart(); });
  on('win-levels', () => { closeOverlay(); game = null; show('levels'); });
}

function firstUnfinished() {
  for (let n = 1; n <= data.unlocked; n++) if (!data.stars[n] && !data.skipped.includes(n)) return n;
  return data.unlocked;
}

function toggleSound() {
  data.sound = !data.sound;
  audio.setMuted(!data.sound);
  renderSound();
  save();
}

// ---------- запуск ----------

async function boot() {
  platform = await initPlatform({
    storageKey: SAVE_KEY,
    onPause: () => audio.pause(),
    onResume: () => audio.resume(),
  });
  T = texts(platform.lang);
  document.documentElement.lang = platform.lang;
  document.title = T.name;
  data = await platform.load(merge);
  audio.setMuted(!data.sound);
  $('btn-undo').textContent = `↶ ${T.undo}`;
  $('btn-restart').textContent = `⟲ ${T.restart}`;
  $('btn-hint').innerHTML = `▶ ${T.hint} <small>${T.forAd}</small>`;
  $('btn-pause').setAttribute('aria-label', T.pause);
  $('levels-back').setAttribute('aria-label', T.menu);
  bindInput();
  new ResizeObserver(relayout).observe($('board'));
  show('menu');
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  platform.ready(); // меню на экране, можно играть (1.19.2)
  window.__game = { get screen() { return screen; }, get overlay() { return overlay; }, get game() { return game; }, get data() { return data; }, LEVELS, startLevel, tryMove, audio, get geo() { return renderer.geo; }, get platform() { return platform; } };
}

boot();
