// «Счётный зоопарк»: экраны, ввод ответа, призы, реклама и сохранения.
import { TOPICS, SERIES_LEN, createSession, maxDigits, emptySave, mergeSaves, addToMeadow } from './engine.js';
import { SPECIES, BY_TIER, ALL_IDS, drawAnimal } from './animals.js';
import { createMeadow, createFx, fit } from './render.js';
import { texts } from './i18n.js';
import { initPlatform } from '../platform/ysdk.js';
import { createAudio } from '../platform/audio.js';
import { createJournal } from '../platform/journal.js';

const SAVE_KEY = 'zoo-v1';
const ADS_FROM_SERIES = 2;        // межсерийная реклама — начиная со 2-й законченной серии
const NEXT_DELAY = 750;           // пауза после верного ответа, чтобы увидеть зверя
const REVEAL_DELAY = 2200;        // после второй ошибки — показать ответ и идти дальше
const AUTO_CHECK = 250;           // набраны все цифры ответа — проверка сама, без кнопки ✓ (просьба тестера 22.10)
const WRONG_LOCK = 400;           // после ошибки нажатия чуть придерживаем, чтобы лишняя цифра не ушла в новый ответ

const $ = (id) => document.getElementById(id);
const audio = createAudio();
const J = createJournal({ game: 'zoo' }); // обезличенный журнал ходов; пишет только в тестовой сборке
let T = texts('ru');
let platform;
let data = emptySave();
let screen = 'menu';
let overlay = null;
let session = null;
let topic = null;
let typed = '';
let busy = false;           // ответ проверяется / идёт пауза перед следующим примером
let rareTaken = false;      // редкий зверь за рекламу — один раз на конец серии
let seriesStats = { ok: 0, bad: 0 };
let endAnimal = null;        // кого показывать в окне конца серии

const meadowPlay = createMeadow($('meadow'));
let heroHappy = 0;           // лев-ведущий в меню подпрыгивает от нажатия
const fx = createFx($('fx'));

// ---------- звук ----------
const SND = {
  ok: () => audio.play('goal'),
  bad: () => audio.play('bump'),
  key: () => audio.play('click'),
  pop: () => audio.play('portal'),
};

// ---------- экраны ----------
function show(name) {
  screen = name;
  J.log('scr', { s: name });
  $('toast').hidden = true; // сообщение с прошлого экрана не переезжает на новый
  if (name !== 'play') fx.clear();
  for (const s of ['menu', 'topics', 'zoo', 'play']) $(s).hidden = s !== name;
  if (name === 'menu') renderMenu();
  if (name === 'topics') renderTopics();
  if (name === 'zoo') renderZoo();
  updatePlaying();
}
function openOverlay(name) {
  overlay = name;
  J.log('ov', { s: name });
  $('toast').hidden = true;
  for (const o of ['ov-pause', 'ov-end', 'ov-gate']) $(o).hidden = o !== `ov-${name}`;
  document.body.classList.add('ov-open');
  updatePlaying();
  $(`ov-${name}`)?.querySelector('button')?.focus({ preventScroll: true });
}
function closeOverlay() {
  if (overlay) J.log('ov', { s: '' });
  overlay = null;
  for (const o of ['ov-pause', 'ov-end', 'ov-gate']) $(o).hidden = true;
  document.body.classList.remove('ov-open');
  updatePlaying();
}
// Геймплей идёт только при решении примеров без открытых окон (разметка геймплея площадки).
function updatePlaying() { platform?.setPlaying(screen === 'play' && !overlay); }

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}
let bannerTimer;
function banner(msg, gold = false) {
  const el = $('banner');
  el.textContent = msg;
  el.classList.toggle('gold', gold);
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), 1300);
}
function clearCelebration() {
  clearTimeout(bannerTimer);
  $('banner').classList.remove('show');
  fx.clear();
}

function renderSound() { for (const id of ['btn-sound', 'p-sound']) $(id).textContent = data.sound ? T.soundOn : T.soundOff; }
function toggleSound() { data.sound = !data.sound; audio.setMuted(!data.sound); renderSound(); save(); }

function renderMenu() {
  $('menu-title').textContent = T.name;
  $('menu-tagline').textContent = T.tagline;
  // Тестовая копия с журналом партий — тестер видит, что ходы записываются
  if (J.enabled) { $('menu-note').textContent = T.journalNote; $('menu-note').hidden = false; }
  $('btn-play').textContent = T.play;
  const tp = data.lastTopic || 'add10';
  $('menu-topic').textContent = `${T.topicNames[tp]} · ${T.topicSample[tp]}`;
  $('btn-topics').textContent = T.topics;
  $('btn-zoo-text').textContent = T.zoo;
  $('menu-bubble').textContent = `${T.topicSample[tp]} = `;
  $('menu-bubble').append(Object.assign(document.createElement('i'), { textContent: '?' }));
  renderSound();
  // У «Мой зоопарк» — тень зверька, которого ещё нет: кто придёт следующим
  const owned = new Set(data.owned);
  const next = ALL_IDS.find((id) => !owned.has(id));
  $('menu-next').hidden = !next;
  if (next) { const { ctx, w, h } = fit($('menu-next')); ctx.clearRect(0, 0, w, h); drawAnimal(ctx, next, w / 2, h - 2, h - 4, { t: 0.4, silhouette: true }); }
}
// Ведущий — последний пришедший на поляну зверь, у нового игрока — лев.
function drawMenuHero(dt) {
  const { ctx, w, h } = fit($('menu-hero'));
  ctx.clearRect(0, 0, w, h);
  heroHappy = Math.max(0, heroHappy - dt);
  const id = data.meadow.at(-1) || 'lion';
  drawAnimal(ctx, id, w / 2, h * 0.95, Math.min(h * 0.78, w * 0.72, 380), { t: clock, happy: heroHappy });
}

function renderTopics() {
  $('topics-title').textContent = T.topics;
  const box = $('topic-list');
  box.textContent = '';
  for (const id of TOPICS) {
    const b = document.createElement('button');
    b.className = 'topic';
    b.dataset.topic = id;
    const lvl = data.levels[id] ?? 0;
    const st = data.stats[id];
    b.innerHTML = `<b></b><span class="sample"></span><span class="lvl"></span>`;
    b.querySelector('b').textContent = T.topicNames[id];
    b.querySelector('.sample').textContent = T.topicSample[id];
    b.querySelector('.lvl').textContent = `${'★'.repeat(lvl + 1)}${'☆'.repeat(2 - lvl)}${st ? ` · ✓ ${st.ok}` : ''}`;
    b.addEventListener('click', () => startSeries(id));
    box.append(b);
  }
}

function renderZoo() {
  const owned = new Set(data.owned);
  $('zoo-title').textContent = T.zooTitle(owned.size, ALL_IDS.length);
  $('zoo-hint').textContent = T.zooHint;
  const box = $('zoo-list');
  box.textContent = '';
  for (const tier of ['small', 'mid', 'big', 'rare']) {
    const h = document.createElement('h3');
    h.textContent = T.tiers[tier];
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const id of BY_TIER[tier]) {
      const have = owned.has(id);
      const tile = document.createElement('div');
      tile.className = 'tile' + (have ? '' : ' locked');
      tile.dataset.animal = id;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 180;
      tile.append(cv, document.createTextNode(have ? T.animals[id] : '?'));
      grid.append(tile);
      drawAnimal(cv.getContext('2d'), id, 90, 165, 140, { t: 0.4, silhouette: !have });
    }
    box.append(h);
    if (tier === 'rare') box.append(Object.assign(document.createElement('p'), { className: 'zoo-note', textContent: T.zooRareNote }));
    box.append(grid);
  }
  $('zoo-play').textContent = T.play;
}

// ---------- серия ----------
function startSeries(id) {
  topic = id;
  data.lastTopic = id;
  rareTaken = false;
  seriesStats = { ok: 0, bad: 0 };
  const params = { topic: id, level: data.levels[id] ?? 0, seed: (Math.random() * 2 ** 31) >>> 0, owned: [...data.owned] };
  session = createSession({ ...params, species: BY_TIER });
  J.log('ser', params); // по зерну, уровню и открытым зверям серия проигрывается движком заново
  closeOverlay();
  show('play');
  meadowPlay.setAnimals(data.meadow);
  $('play-topic').textContent = T.topicNames[id];
  renderDots();
  nextProblem();
}

function renderDots() {
  const box = $('dots');
  if (box.children.length !== SERIES_LEN) {
    box.textContent = '';
    for (let i = 0; i < SERIES_LEN; i++) box.append(document.createElement('i'));
    box.lastChild.classList.add('last');
  }
  const n = session?.state.n || 0;
  [...box.children].forEach((d, i) => d.classList.toggle('on', i < n));
  $('dots').title = T.progress(n, SERIES_LEN);
}

function nextProblem() {
  typed = '';
  busy = false;
  session.next();
  $('play-level').textContent = `${'★'.repeat(session.state.level + 1)}${'☆'.repeat(2 - session.state.level)}`;
  $('problem').className = '';
  setHint('');
  shownAt = performance.now();
  const p = session.state.problem;
  J.log('pb', { k: p.key, ans: p.answer });
  renderProblem();
}
let shownAt = 0;

function setHint(text, bad = false) { const h = $('hint'); h.textContent = text; h.classList.toggle('bad', bad); }

// Знаки разного цвета: плюс и минус легко перепутать, когда тема меняет действие (отзыв тестера 22.10).
const OP_CLASS = { '+': 'sg-plus', '-': 'sg-minus', '×': 'sg-mul', '÷': 'sg-div' };

// Пример строкой: «7 + ▢ = 12», или столбиком — ответ пишется справа налево, с единиц.
function renderProblem(shown = null) {
  const p = session.state.problem;
  const box = $('problem');
  box.textContent = '';
  const value = shown ?? typed;
  if (p.layout === 'column') {
    const width = Math.max(String(p.a).length, String(p.b).length, String(p.answer).length);
    const col = document.createElement('div');
    col.className = 'col';
    const row = (str, cls = '') => {
      const r = document.createElement('div');
      r.className = 'r ' + cls;
      for (const ch of str.padStart(width, ' ')) { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; r.append(s); }
      return r;
    };
    const top = row(String(p.a));
    const mid = row(String(p.b));
    const op = document.createElement('span'); op.className = `op ${OP_CLASS[p.op]}`; op.textContent = p.op === '-' ? '−' : p.op;
    mid.prepend(op);
    const line = document.createElement('div'); line.className = 'line';
    const ans = document.createElement('div');
    ans.className = 'r ans';
    for (let i = 0; i < width; i++) {
      const s = document.createElement('span');
      const fromRight = width - 1 - i;          // разряд: 0 — единицы
      const ch = value[value.length - 1 - fromRight];
      s.textContent = ch ?? ' ';
      if (ch !== undefined) s.classList.add('full');
      if (shown === null && fromRight === value.length && value.length < String(p.answer).length + 0) s.classList.add('cur');
      ans.append(s);
    }
    col.append(top, mid, line, ans);
    box.append(col);
    if (!value && shown === null) setHint(T.columnHint(p.op));
    return;
  }
  const part = (k, v) => {
    const s = document.createElement('span');
    if (p.missing === k) { s.className = 'box' + (value ? ' filled' : ''); s.textContent = value || '?'; } else s.textContent = v;
    return s;
  };
  if (shown === null && isFirstTime() && !value) setHint(T.firstHint);
  const sign = { '+': '+', '-': '−', '×': '×', '÷': '÷' }[p.op];
  const eq = document.createElement('span'); eq.textContent = '=';
  const opEl = document.createElement('span'); opEl.textContent = sign; opEl.className = OP_CLASS[p.op];
  box.append(part('a', p.a), opEl, part('b', p.b), eq, part('r', p.r));
}

function press(key) {
  if (screen !== 'play' || overlay || busy || !session || session.state.done) return;
  const p = session.state.problem;
  if (key === 'del') { typed = p.layout === 'column' ? typed.slice(1) : typed.slice(0, -1); J.log('k', { k: 'del' }); SND.key(); renderProblem(); return; }
  if (key === 'ok') { if (typed) submit(); return; } // Enter на клавиатуре ПК — проверить раньше
  if (!/^\d$/.test(key)) return;
  if (typed.length >= maxDigits(p)) return;
  // столбиком цифры встают справа налево: сначала единицы
  typed = p.layout === 'column' ? key + typed : (typed === '0' ? key : typed + key);
  J.log('k', { k: key });
  SND.key();
  renderProblem();
  // Цифр столько же, сколько в ответе, — проверяем сами; небольшая пауза, чтобы ребёнок увидел набранное.
  if (typed.length >= String(p.answer).length) { busy = true; setTimeout(submit, AUTO_CHECK); }
}

function buildKeypad() {
  const box = $('keypad');
  box.textContent = '';
  // Кнопки ✓ нет: ответ проверяется сам, когда набраны все цифры. Ноль — широкий, «стереть» — справа.
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'del']) {
    const b = document.createElement('button');
    b.dataset.key = k;
    if (k === 'del') { b.className = 'del'; b.textContent = '⌫'; b.setAttribute('aria-label', T.keyDel); }
    else if (k === '0') { b.className = 'zero'; b.textContent = k; }
    else b.textContent = k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(k); });
    box.append(b);
  }
}

function problemCenter() {
  const r = $('problem').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Самый первый пример у игрока: подсказать, как отвечать.
const isFirstTime = () => data.series === 0 && !Object.values(data.stats).some((s) => s.ok > 0);

// Маленькие числа — подсказка точками: ребёнок может пересчитать.
const dots = (n) => '●'.repeat(n);
function hintFor(p) {
  if ((p.op === '+' || p.op === '-') && p.missing === 'r' && p.a <= 10 && p.b <= 10) return `${T.tryAgain}
${dots(p.a)} ${p.op === '+' ? '+' : '−'} ${dots(p.b)}`;
  if (p.op === '×') return T.hintMul(p.a, p.b);
  if (p.op === '÷') return T.hintDiv(p.a, p.b);
  if (p.layout === 'column') return p.op === '+' ? T.hintCarry : T.hintBorrow;
  return T.tryAgain;
}

function submit() {
  busy = true;
  const res = session.answer(typed);
  if (!res) { busy = false; return; }
  J.log('ans', { v: typed, ok: res.ok ? 1 : 0, ms: Math.round(performance.now() - shownAt), ...(res.levelChange ? { lc: res.levelChange } : {}) });
  const st = (data.stats[topic] ||= { ok: 0, bad: 0 });
  if (res.ok) {
    st.ok++; seriesStats.ok++;
    SND.ok();
    $('problem').className = 'ok';
    const r = res.reward;
    const pos = meadowPlay.add(r.id, clock);
    addToMeadow(data, r.id);
    if (!data.owned.includes(r.id)) data.owned.push(r.id);
    const power = { small: 0.7, mid: 0.9, big: 1.1, rare: 1.3 }[r.tier];
    const count = { small: 40, mid: 70, big: 110, rare: 180 }[r.tier];
    const c = problemCenter();
    fx.confetti(c.x, c.y, count, power);
    const mb = $('meadow').getBoundingClientRect();
    fx.confetti(mb.left + pos.x, mb.top + pos.y - pos.s, Math.round(count / 3), 0.6);
    if (r.tier === 'big' || r.tier === 'rare') meadowPlay.cheer();
    if (r.tier === 'rare') fx.fireworks(window.innerWidth, window.innerHeight, 5);
    setTimeout(SND.pop, 150);
    if (r.isNew) banner(r.tier === 'rare' ? T.rareAnimal(T.animals[r.id]) : T.newAnimal(T.animals[r.id]), true);
    else if (r.banner) banner(T.banners[r.n]);
    if (res.levelChange > 0) toast(T.levelUp);
    data.levels[topic] = session.state.level;
    renderDots();
    save();
    if (res.seriesDone) setTimeout(endSeries, 1300);
    else setTimeout(nextProblem, NEXT_DELAY);
    return;
  }
  st.bad++; seriesStats.bad++;
  SND.bad();
  clearCelebration();
  const box = $('problem');
  box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  if (res.levelChange < 0) toast(T.levelDown);
  data.levels[topic] = session.state.level;
  save();
  if (res.reveal) {
    box.classList.add('reveal');
    renderProblem(String(res.problem.answer));
    setHint(T.answerWas(res.problem.answer), true);
    setTimeout(nextProblem, REVEAL_DELAY);
    return;
  }
  typed = '';
  renderProblem();
  setHint(hintFor(res.problem), true);
  setTimeout(() => { busy = false; }, WRONG_LOCK);
}

function endSeries() {
  data.series++;
  J.log('end', { ok: seriesStats.ok, bad: seriesStats.bad, n: data.series });
  save();
  const last = data.meadow[data.meadow.length - 1];
  $('end-title').textContent = T.seriesDone;
  $('end-result').textContent = T.seriesResult(seriesStats.ok, seriesStats.bad);
  $('end-came').textContent = T.seriesCame(SERIES_LEN);
  $('end-more').textContent = T.moreSeries;
  $('end-topics').textContent = T.changeTopic;
  $('end-rare').innerHTML = '';
  $('end-rare').append(T.callRare, Object.assign(document.createElement('small'), { textContent: T.callRareSub }));
  $('end-rare').hidden = rareTaken || data.series < ADS_FROM_SERIES; // реклама — не раньше 2-й серии
  endAnimal = last;
  openOverlay('end');
}

function drawEndAnimal(id) {
  const cv = $('end-animal');
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (id) drawAnimal(ctx, id, 150, 280, 240, { t: clock });
}

// Межсерийная реклама: не во время решения, только между сериями и не на первых сериях.
async function betweenSeries(then) {
  if (data.series >= ADS_FROM_SERIES) { J.log('ad', { w: 'inter' }); await platform.showInterstitial(); }
  then();
}

async function callRare() {
  const btn = $('end-rare');
  btn.disabled = true;
  J.log('ad', { w: 'rewarded' });
  const res = await platform.showRewarded();
  J.log('ad', { w: res.rewarded ? 'got' : res.error ? 'err' : 'skip' });
  btn.disabled = false;
  if (!res.rewarded) { toast(res.error ? T.adFail : T.adNoReward); return; }
  rareTaken = true;
  btn.hidden = true;
  const fresh = BY_TIER.rare.filter((id) => !data.owned.includes(id));
  const pool = fresh.length ? fresh : BY_TIER.rare;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const isNew = !data.owned.includes(id);
  if (isNew) data.owned.push(id);
  addToMeadow(data, id);
  meadowPlay.add(id, clock);
  meadowPlay.cheer();
  save();
  endAnimal = id;
  fx.fireworks(window.innerWidth, window.innerHeight, 4);
  toast(isNew ? T.rareAnimal(T.animals[id]) : T.animals[id]);
}

// ---------- сохранения ----------
function save() { platform?.save(data); }

// ---------- главный цикл ----------
let clock = 0;
let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  if (!platform?.isPausedExternally()) {
    clock += dt;
    if (screen === 'play') meadowPlay.frame(clock, dt, T.meadowEmpty);
    if (screen === 'menu') drawMenuHero(dt);
    fx.frame(dt);
    if (overlay === 'end') drawEndAnimal(endAnimal);
  }
  requestAnimationFrame(loop);
}

// ---------- кнопки и клавиатура ----------
function bind() {
  $('btn-play').onclick = () => startSeries(data.lastTopic || 'add10');
  $('menu-hero').onclick = () => { if (heroHappy < 0.3) { heroHappy = 1.4; SND.pop(); } };
  $('zoo-play').onclick = () => startSeries(data.lastTopic || 'add10');
  $('btn-topics').onclick = () => show('topics');
  $('btn-zoo').onclick = () => show('zoo');
  $('btn-sound').onclick = toggleSound;
  $('topics-back').onclick = () => show('menu');
  $('zoo-back').onclick = () => show('menu');
  $('btn-pause').onclick = () => { $('p-title').textContent = T.pause; $('p-resume').textContent = T.resume; $('p-topics').textContent = T.topics; $('p-menu').textContent = T.menu; renderSound(); openOverlay('pause'); };
  $('p-resume').onclick = closeOverlay;
  $('p-sound').onclick = toggleSound;
  $('p-topics').onclick = () => { closeOverlay(); show('topics'); };
  $('p-menu').onclick = () => { closeOverlay(); show('menu'); };
  $('end-more').onclick = () => betweenSeries(() => startSeries(topic));
  $('end-topics').onclick = () => betweenSeries(() => { closeOverlay(); show('topics'); });
  // реклама за редкого зверя — через экран «попроси взрослого»
  $('end-rare').onclick = () => {
    $('gate-title').textContent = T.adGateTitle; $('gate-body').textContent = T.adGateBody;
    $('gate-yes').textContent = T.adGateYes; $('gate-no').textContent = T.adGateNo;
    clearCelebration(); // салют не мешает читать взрослому
    J.log('ad', { w: 'gate' });
    $('ov-gate').hidden = false; $('gate-no').focus({ preventScroll: true });
  };
  $('gate-no').onclick = () => { $('ov-gate').hidden = true; J.log('ad', { w: 'no' }); };
  $('gate-yes').onclick = () => { $('ov-gate').hidden = true; callRare(); };
  document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  document.addEventListener('keydown', (e) => {
    audio.unlock();
    if (screen === 'play' && !overlay) {
      if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === 'Backspace') { press('del'); e.preventDefault(); }
      else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
      else if (e.key === 'Escape') $('btn-pause').click();
    } else if (e.key === 'Escape') {
      if (overlay === 'pause') closeOverlay();
      else if (screen === 'topics' || screen === 'zoo') show('menu');
    }
  });
}

async function start() {
  platform = await initPlatform({
    storageKey: SAVE_KEY,
    onPause: () => audio.pause(),
    onResume: () => audio.resume(),
  });
  T = texts(platform.lang);
  document.documentElement.lang = platform.lang;
  document.title = T.name;
  data = await platform.load(mergeSaves);
  J.log('open', { lang: platform.lang, w: innerWidth, h: innerHeight, touch: navigator.maxTouchPoints > 0 ? 1 : 0, series: data.series, owned: data.owned.length });
  data.owned = data.owned.filter((id) => SPECIES[id]);
  data.meadow = data.meadow.filter((id) => SPECIES[id]);
  audio.setMuted(!data.sound);
  buildKeypad();
  bind();
  $('loading').hidden = true;
  show('menu');
  platform.ready();
  requestAnimationFrame(loop);
  // для автотестов и агента-игрока: состояние без доступа к модулям
  window.__zoo = { get state() { return { screen, overlay, typed, busy, problem: session?.state.problem, n: session?.state.n, level: session?.state.level, data }; } };
}

start();
