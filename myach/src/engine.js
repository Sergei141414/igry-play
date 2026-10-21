// Движок «Мяч к воротам»: поле, ход, решатель. Чистая логика без DOM — одна и та же
// в браузере, в генераторе уровней и в тестах.
//
// Уровень: { rows: ['....', ...], ball: [x, y] }, по символу на клетку:
//   .  трава              #  конус — мяч останавливается перед ним
//   G  ворота у края поля — гол, только если мяч катится в створ (наружу поля);
//      сбоку и сзади ворота — как стенка: штанги и сетка мяч не пропускают
//   m  грязь — мяч, заехав в неё, застревает
//   /  \  отбойники — поворачивают мяч на 90° при въезде
//   p P, q Q  пары порталов — мяч выходит из парного и катится дальше в ту же сторону
//   x  хрупкая стенка — один раз останавливает мяч, как конус, и ломается

export const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export const DIR_NAMES = Object.keys(DIRS);
const PORTAL_PAIRS = { p: 'P', P: 'p', q: 'Q', Q: 'q' };
export const MAX_FRAGILE = 6; // маска сломанных стенок помещается в 6 бит

export function compile(level) {
  const h = level.rows.length;
  const w = level.rows[0].length;
  const grid = level.rows.join('').split('');
  if (grid.length !== w * h) throw new Error('строки уровня разной длины');
  const fragileBit = new Map();
  const portalTwin = new Map();
  let goal = -1;
  grid.forEach((ch, i) => {
    if (ch === 'x') fragileBit.set(i, 1 << fragileBit.size);
    if (ch === 'G') goal = i;
    if (PORTAL_PAIRS[ch]) {
      const j = grid.indexOf(PORTAL_PAIRS[ch]);
      if (j < 0) throw new Error(`портал ${ch} без пары`);
      portalTwin.set(i, j);
    }
  });
  if (goal < 0) throw new Error('нет ворот');
  if (fragileBit.size > MAX_FRAGILE) throw new Error('слишком много хрупких стенок');
  const [bx, by] = level.ball;
  return { w, h, grid, goal, goalDir: goalSide(goal, w, h), fragileBit, portalTwin, start: { pos: by * w + bx, mask: 0 } };
}

// Куда смотрят ворота: наружу от того края, у которого стоят. Порядок — как в отрисовке
// (верх и низ раньше боков). Ворота не у края принимают мяч с любой стороны.
export function goalSide(i, w, h) {
  const x = i % w, y = Math.floor(i / w);
  if (y === 0) return DIRS.up;
  if (y === h - 1) return DIRS.down;
  if (x === 0) return DIRS.left;
  if (x === w - 1) return DIRS.right;
  return null;
}

export const stateKey = (s) => s.pos * 64 + s.mask;

// Один ход. Возвращает новое состояние, путь мяча по клеткам (для анимации),
// какие элементы он задел и чем ход кончился.
//   moved — мяч сдвинулся или сломал стенку (иначе ход не считается);
//   won — мяч в воротах; loop — мяч закрутился по кругу (генератор такие уровни отбрасывает).
export function move(c, state, dir) {
  let [dx, dy] = DIRS[dir];
  let pos = state.pos;
  let mask = state.mask;
  const path = [{ pos, teleport: false }];
  const touched = new Set();
  const seen = new Set();
  for (;;) {
    const key = `${pos},${dx},${dy}`;
    if (seen.has(key)) return { state, path: [path[0]], touched, moved: false, won: false, loop: true };
    seen.add(key);
    const x = (pos % c.w) + dx;
    const y = Math.floor(pos / c.w) + dy;
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) break;
    const next = y * c.w + x;
    const ch = c.grid[next];
    if (ch === '#') break;
    // Ворота с другой стороны, чем створ: мяч упирается в штангу или сетку.
    if (ch === 'G' && c.goalDir && (c.goalDir[0] !== dx || c.goalDir[1] !== dy)) break;
    if (ch === 'x' && !(mask & c.fragileBit.get(next))) {
      mask |= c.fragileBit.get(next);
      touched.add('x');
      path.push({ pos: next, bump: true }); // удар в стенку — для анимации, мяч остаётся на месте
      break;
    }
    pos = next;
    path.push({ pos, teleport: false });
    if (ch === 'G') return finish(state, pos, mask, path, touched, true);
    if (ch === 'm') { touched.add('m'); break; }
    if (ch === '/') { touched.add('d'); [dx, dy] = [-dy, -dx]; }
    else if (ch === '\\') { touched.add('d'); [dx, dy] = [dy, dx]; }
    else if (c.portalTwin.has(pos)) {
      touched.add('p');
      pos = c.portalTwin.get(pos);
      path.push({ pos, teleport: true });
    }
  }
  return finish(state, pos, mask, path, touched, false);
}

function finish(state, pos, mask, path, touched, won) {
  const moved = pos !== state.pos || mask !== state.mask;
  return { state: { pos, mask }, path, touched, moved, won, loop: false };
}

// Поиск в ширину по всем состояниям «где мяч + какие стенки сломаны».
// opt — минимум ходов до ворот (null, если не пройти), solution — эти ходы,
// reachable — сколько разных состояний вообще достижимо, deadEnds — из скольких
// из них ворота уже недостижимы (ловушки: тогда помогает «Отменить» или «Заново»).
export function solve(c, from = c.start) {
  const startKey = stateKey(from);
  const prev = new Map([[startKey, null]]);
  const edges = new Map();
  const queue = [from];
  let goalKey = null;
  let loops = 0;
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    const k = stateKey(s);
    const out = [];
    for (const dir of DIR_NAMES) {
      const r = move(c, s, dir);
      if (r.loop) { loops++; continue; }
      if (!r.moved) continue;
      if (r.won) {
        out.push('win');
        if (goalKey === null) goalKey = { from: k, dir };
        continue;
      }
      const nk = stateKey(r.state);
      out.push(nk);
      if (!prev.has(nk)) { prev.set(nk, { from: k, dir }); queue.push(r.state); }
    }
    edges.set(k, out);
  }
  let solution = null;
  if (goalKey) {
    solution = [goalKey.dir];
    for (let k = goalKey.from; prev.get(k); k = prev.get(k).from) solution.unshift(prev.get(k).dir);
  }
  // Из каких состояний ворота достижимы: обратная волна от выигрышных рёбер.
  const canWin = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [k, out] of edges) {
      if (!canWin.has(k) && out.some((t) => t === 'win' || canWin.has(t))) { canWin.add(k); changed = true; }
    }
  }
  return {
    opt: solution ? solution.length : null,
    solution,
    reachable: edges.size,
    deadEnds: edges.size - canWin.size,
    loops,
  };
}

// Подсказка: следующий лучший ход из текущего положения; null — отсюда ворота
// недостижимы, игроку нужна «Отмена» или «Заново».
export function hint(c, state) {
  const r = solve(c, state);
  return r.solution ? r.solution[0] : null;
}

export function stars(moves, opt) {
  if (moves <= opt) return 3;
  if (moves <= opt + 2) return 2;
  return 1;
}

// Какие элементы задевает решение — генератор проверяет, что новинка главы
// действительно нужна для прохождения, а не стоит для красоты.
export function touchedBySolution(c, solution) {
  const all = new Set();
  let s = c.start;
  for (const dir of solution) {
    const r = move(c, s, dir);
    r.touched.forEach((t) => all.add(t));
    s = r.state;
  }
  return all;
}
