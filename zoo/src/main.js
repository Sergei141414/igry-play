// «Счётный зоопарк»: экраны, ввод ответа, призы, реклама и сохранения.
import { TOPICS, SERIES_LEN, createSession, maxDigits, emptySave, mergeSaves, addToMeadow } from './engine.js';
import { SPECIES, BY_TIER, ALL_IDS, drawAnimal } from './animals.js';
import { createMeadow, createFx } from './render.js';
import { texts } from './i18n.js';
import { initPlatform } from '../platform/ysdk.js';
import { createAudio } from '../platform/audio.js';

const SAVE_KEY = 'zoo-v1';
const ADS_FROM_SERIES = 2;        // межсерийная реклама — начиная со 2-й законченной серии
const NEXT_DELAY = 750;           // пауза после верного ответа, чтобы увидеть зверя
const REVEAL_DELAY = 2200;        // после второй ошибки — показать ответ и идти дальше

const $ = (id) => document.getElementById(id);
const audio = createAudio();
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
const meadowMenu = createMeadow($('menu-meadow'));
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
  $('toast').hidden = true;
  for (const o of ['ov-pause', 'ov-end', 'ov-gate']) $(o).hidden = o !== `ov-${name}`;
  updatePlaying();
  $(`ov-${name}`)?.querySelector('button')?.focus({ preventScroll: true });
}
function closeOverlay() {
  overlay = null;
  for (const o of ['ov-pause', 'ov-end', 'ov-gate']) $(o).hidden = true;
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
  $('btn-play').textContent = T.play;
  const tp = data.lastTopic || 'add10';
  $('menu-topic').textContent = `${T.topicNames[tp]} · ${T.topicSample[tp]}`;
  $('btn-topics').textContent = T.topics;
  $('btn-zoo').textContent = T.zoo;
  renderSound();
  meadowMenu.setAnimals(data.meadow);
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
  session = createSession({
    topic: id, level: data.levels[id] ?? 0, seed: (Math.random() * 2 ** 31) >>> 0,
    species: BY_TIER, owned: data.owned,
  });
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
  renderProblem();
}

function setHint(text, bad = false) { const h = $('hint'); h.textContent = text; h.classList.toggle('bad', bad); }

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
    const op = document.createElement('span'); op.className = 'op'; op.textContent = p.op === '-' ? '−' : p.op;
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
    if (!value && shown === null) setHint(T.columnHint);
    return;
  }
  const part = (k, v) => {
    const s = document.createElement('span');
    if (p.missing === k) { s.className = 'box' + (value ? ' filled' : ''); s.textContent = value || '?'; } else s.textContent = v;
    return s;
  };
  const first = shown === null && isFirstTime();
  if (first && !value) setHint(T.firstHint);
  $('keypad').querySelector('[data-key="ok"]')?.classList.toggle('pulse', first && !!value);
  const sign = { '+': '+', '-': '−', '×': '×', '÷': '÷' }[p.op];
  const eq = document.createElement('span'); eq.textContent = '=';
  const opEl = document.createElement('span'); opEl.textContent = sign;
  box.append(part('a', p.a), opEl, part('b', p.b), eq, part('r', p.r));
}

function press(key) {
  if (screen !== 'play' || overlay || busy || !session || session.state.done) return;
  const p = session.state.problem;
  if (key === 'del') { typed = p.layout === 'column' ? typed.slice(1) : typed.slice(0, -1); SND.key(); renderProblem(); return; }
  if (key === 'ok') { if (typed) submit(); return; }
  if (!/^\d$/.test(key)) return;
  if (typed.length >= maxDigits(p)) return;
  // столбиком цифры встают справа налево: сначала единицы
  typed = p.layout === 'column' ? key + typed : (typed === '0' ? key : typed + key);
  SND.key();
  renderProblem();
}

function buildKeypad() {
  const box = $('keypad');
  box.textContent = '';
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']) {
    const b = document.createElement('button');
    b.dataset.key = k;
    if (k === 'del') { b.className = 'del'; b.textContent = '⌫'; b.setAttribute('aria-label', T.keyDel); }
    else if (k === 'ok') { b.className = 'ok'; b.textContent = '✓'; b.setAttribute('aria-label', T.keyOk); }
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
  busy = false;
}

function endSeries() {
  data.series++;
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
  if (data.series >= ADS_FROM_SERIES) await platform.showInterstitial();
  then();
}

async function callRare() {
  const btn = $('end-rare');
  btn.disabled = true;
  const res = await platform.showRewarded();
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
    if (screen === 'menu') meadowMenu.frame(clock, dt, '');
    fx.frame(dt);
    if (overlay === 'end') drawEndAnimal(endAnimal);
  }
  requestAnimationFrame(loop);
}

// ---------- кнопки и клавиатура ----------
function bind() {
  $('btn-play').onclick = () => startSeries(data.lastTopic || 'add10');
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
    $('ov-gate').hidden = false; $('gate-no').focus({ preventScroll: true });
  };
  $('gate-no').onclick = () => { $('ov-gate').hidden = true; };
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
