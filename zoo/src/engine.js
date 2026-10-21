// «Счётный зоопарк»: примеры, подстройка сложности, серии и призы. Без DOM — проверяется тестами.
// Все случайности — от зерна (mulberry32): партию можно воспроизвести по журналу.

export const SERIES_LEN = 10;      // верных ответов в серии; ошибка не сокращает серию, пример вернётся
export const LEVELS = 3;           // уровни сложности внутри темы: 0, 1, 2
export const UP_AFTER = 3;         // верных подряд — уровень выше
export const DOWN_AFTER = 2;       // ошибок подряд — уровень ниже
export const RETRY_GAP = 3;        // ошибочный пример возвращается через столько примеров
export const NO_REPEAT = 8;        // один и тот же пример не чаще, чем раз в столько

export const TOPICS = ['add10', 'sub10', 'pm20', 'pm100', 'column', 'mul'];

export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  return { next, int, pick: (arr) => arr[Math.floor(next() * arr.length)], get state() { return a; } };
}

// Пример: a op b = r; missing — какое из трёх чисел спрятано; answer — что вводит игрок.
function make(a, op, b, { missing = 'r', layout = 'row' } = {}) {
  const r = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
  const answer = missing === 'a' ? a : missing === 'b' ? b : r;
  const key = `${a}${op}${b}${missing === 'r' ? '' : ':' + missing}${layout === 'column' ? ':c' : ''}`;
  return { a, op, b, r, missing, answer, layout, key };
}

// Сложение с переходом через десяток в разряде единиц (или сотен для столбика).
const carries = (a, b) => {
  for (let x = a, y = b; x || y; x = Math.floor(x / 10), y = Math.floor(y / 10)) if ((x % 10) + (y % 10) >= 10) return true;
  return false;
};
const borrows = (a, b) => {
  for (let x = a, y = b; y; x = Math.floor(x / 10), y = Math.floor(y / 10)) if ((x % 10) < (y % 10)) return true;
  return false;
};

// Генераторы по темам и уровням. Каждый возвращает пример, подходящий по условию уровня.
const GEN = {
  add10: [
    (R) => { const a = R.int(1, 4); return make(a, '+', R.int(1, 5 - a)); },
    (R) => { const a = R.int(2, 8); return make(a, '+', R.int(1, 10 - a)); },
    (R) => { const a = R.int(1, 8); const b = R.int(1, 10 - a); return make(a, '+', b, { missing: 'b' }); },
  ],
  sub10: [
    (R) => { const a = R.int(2, 5); return make(a, '-', R.int(1, a - 1)); },
    (R) => { const a = R.int(5, 10); return make(a, '-', R.int(1, a - 1)); },
    (R) => { const a = R.int(4, 10); return make(a, '-', R.int(1, a - 1), { missing: 'b' }); },
  ],
  pm20: [
    // без перехода через десяток: 12 + 5, 17 − 4
    (R) => { if (R.next() < 0.5) { const u = R.int(0, 7); return make(10 + u, '+', R.int(1, 9 - u)); }
      const u = R.int(2, 9); return make(10 + u, '-', R.int(1, u)); },
    // с переходом: 8 + 7, 15 − 8
    (R) => { if (R.next() < 0.5) { const a = R.int(2, 9); return make(a, '+', R.int(11 - a, 9)); }
      const a = R.int(11, 18); return make(a, '-', R.int(a - 9, 9)); },
    // то же с пропущенным числом
    (R) => { const p = GEN.pm20[1](R); return make(p.a, p.op, p.b, { missing: R.next() < 0.5 ? 'b' : 'a' }); },
  ],
  pm100: [
    // круглые десятки
    (R) => { if (R.next() < 0.5) { const a = R.int(1, 8); return make(a * 10, '+', R.int(1, 9 - a) * 10); }
      const a = R.int(2, 9); return make(a * 10, '-', R.int(1, a - 1) * 10); },
    // двузначное ± однозначное с переходом
    (R) => { if (R.next() < 0.5) { const a = R.int(1, 8) * 10 + R.int(2, 9); return make(a, '+', R.int(11 - (a % 10), 9)); }
      const a = R.int(2, 9) * 10 + R.int(0, 7); return make(a, '-', R.int((a % 10) + 1, 9)); },
    // двузначное ± двузначное
    (R) => { if (R.next() < 0.5) { const a = R.int(11, 79); return make(a, '+', R.int(11, 99 - a)); }
      const a = R.int(31, 99); return make(a, '-', R.int(11, a - 11)); },
  ],
  column: [
    // двузначные без перехода
    (R) => { for (;;) { const a = R.int(11, 88); const b = R.int(11, 99 - a); if (b >= 10 && !carries(a, b)) return make(a, '+', b, { layout: 'column' }); } },
    // трёхзначные сложение с переходом
    (R) => { for (;;) { const a = R.int(105, 789); const b = R.int(105, 999 - a); if (b >= 100 && carries(a, b)) return make(a, '+', b, { layout: 'column' }); } },
    // трёхзначные вычитание с занятием
    (R) => { for (;;) { const a = R.int(300, 999); const b = R.int(101, a - 100); if (borrows(a, b)) return make(a, '-', b, { layout: 'column' }); } },
  ],
  mul: [
    (R) => make(R.pick([2, 3, 5, 10]), '×', R.int(1, 10)),
    (R) => { const a = R.pick([4, 6]); return R.next() < 0.5 ? make(a, '×', R.int(2, 10)) : make(R.int(2, 10), '×', a); },
    (R) => { const a = R.pick([7, 8, 9]); const b = R.int(2, 9);
      return R.next() < 0.7 ? make(a, '×', b) : make(a * b, '÷', a); },
  ],
};

export function generate(topic, level, R) {
  const g = GEN[topic]?.[level];
  if (!g) throw new Error(`нет генератора: ${topic}/${level}`);
  return g(R);
}

export function check(problem, value) {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) && n === problem.answer;
}

// Сколько цифр может быть в ответе — клавиатура не даёт набрать больше.
export const maxDigits = (problem) => String(problem.answer).length + 1;

// Призы. n — номер верного ответа в серии (1..SERIES_LEN), clean — серия пока без ошибок.
// Награда за каждый ответ; зрелищность нарастает: 1–3 малыши, 4–6 средние, 7–9 крупные,
// 10-й — большой приз (редкий зверь, если серия без ошибок).
export function rewardTier(n, clean) {
  if (n >= SERIES_LEN) return clean ? 'rare' : 'big';
  if (n >= 7) return 'big';
  if (n >= 4) return 'mid';
  return 'small';
}
export const bannerAt = (n) => n === 3 || n === 6 || n === 9;

// Состояние серии. species — словарь {tier: [id...]} из animals.js (передаётся, чтобы движок не знал о графике).
export function createSession({ topic, level = 0, seed = 1, species, owned = [] }) {
  const R = rng(seed);
  const s = {
    topic, level, seed,
    n: 0,                 // верных в серии
    clean: true,
    streakOk: 0, streakBad: 0,
    recent: [],           // ключи последних примеров
    retry: [],            // [{problem, at}] — вернуть ошибочный
    shown: 0,             // всего показано примеров
    problem: null,
    attempts: 0,          // ошибок на текущем примере
    owned: new Set(owned),
    done: false,
    log: [],              // журнал: [shown, key, ответ, верно]
  };

  function nextProblem() {
    s.shown++;
    s.attempts = 0;
    const due = s.retry.findIndex((x) => x.at <= s.shown);
    if (due >= 0) { s.problem = s.retry.splice(due, 1)[0].problem; return s.problem; }
    let p;
    for (let i = 0; i < 30; i++) {
      p = generate(s.topic, s.level, R);
      if (!s.recent.includes(p.key)) break;
    }
    s.recent.push(p.key);
    if (s.recent.length > NO_REPEAT) s.recent.shift();
    s.problem = p;
    return p;
  }

  function pickAnimal(tier) {
    const pool = species[tier] || [];
    const fresh = pool.filter((id) => !s.owned.has(id));
    const id = R.pick(fresh.length ? fresh : pool);
    const isNew = !s.owned.has(id);
    s.owned.add(id);
    return { id, isNew };
  }

  // Ответ игрока. Возвращает, что показать: верно/нет, приз, конец серии, смена уровня.
  function answer(value) {
    if (s.done || !s.problem) return null;
    const ok = check(s.problem, value);
    s.log.push([s.shown, s.problem.key, String(value), ok ? 1 : 0]);
    const out = { ok, problem: s.problem, levelChange: 0 };
    if (ok) {
      s.n++;
      s.streakOk++; s.streakBad = 0;
      const tier = rewardTier(s.n, s.clean);
      out.reward = { tier, banner: bannerAt(s.n), n: s.n, ...pickAnimal(tier) };
      if (s.streakOk >= UP_AFTER && s.level < LEVELS - 1) { s.level++; s.streakOk = 0; out.levelChange = 1; }
      if (s.n >= SERIES_LEN) { s.done = true; out.seriesDone = true; }
    } else {
      s.clean = false;
      s.attempts++;
      s.streakBad++; s.streakOk = 0;
      // пример вернётся позже — один раз
      if (s.attempts === 1) s.retry.push({ problem: s.problem, at: s.shown + RETRY_GAP });
      if (s.streakBad >= DOWN_AFTER && s.level > 0) { s.level--; s.streakBad = 0; out.levelChange = -1; }
      // вторая ошибка на том же примере — показываем ответ и идём дальше, без зацикливания
      out.reveal = s.attempts >= 2;
    }
    return out;
  }

  return { state: s, next: nextProblem, answer };
}

// Сохранение: v — версия формата. meadow — зверюшки на поляне (id вида), owned — открытые виды,
// levels — уровень по каждой теме, stats — решено/ошибок по темам.
export const MEADOW_MAX = 60;
export function emptySave() {
  return { v: 1, owned: [], meadow: [], levels: {}, stats: {}, series: 0, sound: true };
}
export function addToMeadow(save, id) {
  save.meadow.push(id);
  if (save.meadow.length > MEADOW_MAX) save.meadow.splice(0, save.meadow.length - MEADOW_MAX);
}
// Две копии (локальная и облако) сводятся без потерь: виды — объединением, счётчики — максимумом.
export function mergeSaves(a, b) {
  const x = a?.v === 1 ? a : null;
  const y = b?.v === 1 ? b : null;
  if (!x && !y) return emptySave();
  if (!x || !y) return { ...emptySave(), ...(x || y) };
  const out = { ...emptySave(), ...y, ...x };
  out.owned = [...new Set([...y.owned, ...x.owned])];
  out.meadow = (x.series >= y.series ? x : y).meadow.slice();
  out.series = Math.max(x.series, y.series);
  out.levels = { ...y.levels };
  for (const [k, v] of Object.entries(x.levels || {})) out.levels[k] = Math.max(v, out.levels[k] ?? 0);
  out.stats = { ...y.stats };
  for (const [k, v] of Object.entries(x.stats || {})) {
    const w = out.stats[k] || { ok: 0, bad: 0 };
    out.stats[k] = { ok: Math.max(v.ok, w.ok), bad: Math.max(v.bad, w.bad) };
  }
  return out;
}
