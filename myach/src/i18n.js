// Тексты игры. Язык выбирает SDK (требование 2.14); всё, что влияет на игру, переведено (8.2.3).
// Название одинаково в игре и на промоматериалах (5.1.3) — меняется только здесь и в тексте черновика.

const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
};

const T = {
  ru: {
    name: 'Мяч к воротам',
    tagline: 'Мяч катится, пока не упрётся. Доведите его до ворот!',
    play: 'Играть',
    levels: 'Уровни',
    level: (n) => `Уровень ${n}`,
    chapters: ['Конусы', 'Грязь', 'Отбойники', 'Порталы', 'Хрупкие стенки', 'Всё вместе'],
    moves: (m) => `Ходы: ${m}`,
    target: (o) => `★★★ за ${o} ${plural(o, 'ход', 'хода', 'ходов')}`,
    undo: 'Отменить',
    restart: 'Заново',
    hint: 'Подсказка',
    forAd: 'за рекламу',
    skip: 'Пропустить уровень',
    pause: 'Пауза',
    resume: 'Продолжить',
    soundOn: 'Звук: вкл',
    soundOff: 'Звук: выкл',
    menu: 'Меню',
    goal: 'Гол!',
    next: 'Далее',
    result: (m, o) => `Ходов: ${m} · минимум: ${o}`,
    controlsDesk: 'Стрелки, WASD или щелчок по полю в нужную сторону',
    controlsTouch: 'Проведите пальцем или коснитесь поля в нужную сторону',
    intro: {
      m: ['Новинка: грязь', 'Заехав в грязь, мяч застревает. Следующим ходом из неё можно выкатиться.'],
      d: ['Новинка: отбойник', 'Отбойник поворачивает мяч на 90° — смотрите, куда скошена планка.'],
      p: ['Новинка: портал', 'Мяч ныряет в портал и выкатывается из портала того же цвета, не меняя направления.'],
      x: ['Новинка: хрупкая стенка', 'Стенка выдерживает один удар: останавливает мяч и ломается.'],
      all: ['Финальная глава', 'Все элементы вместе. Ищите самый короткий путь!'],
    },
    got: 'Понятно',
    adFail: 'Реклама сейчас недоступна. Попробуйте чуть позже.',
    adFailFreeHint: 'Реклама сейчас недоступна — держите подсказку бесплатно.',
    adNotFinished: 'Награда — после просмотра рекламы до конца.',
    noHint: 'Отсюда до ворот не добраться. Отмените ход или начните заново.',
    skipped: 'Уровень пропущен',
    allDone: 'Все уровни пройдены! Соберите три звезды везде.',
    stars: (s, t) => `Звёзды: ${s} из ${t}`,
  },
  en: {
    name: 'Ball to Goal',
    tagline: 'The ball rolls until it hits something. Get it into the goal!',
    play: 'Play',
    levels: 'Levels',
    level: (n) => `Level ${n}`,
    chapters: ['Cones', 'Mud', 'Bumpers', 'Portals', 'Fragile walls', 'All together'],
    moves: (m) => `Moves: ${m}`,
    target: (o) => `★★★ in ${o} ${o === 1 ? 'move' : 'moves'}`,
    undo: 'Undo',
    restart: 'Restart',
    hint: 'Hint',
    forAd: 'watch ad',
    skip: 'Skip level',
    pause: 'Pause',
    resume: 'Resume',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    menu: 'Menu',
    goal: 'Goal!',
    next: 'Next',
    result: (m, o) => `Moves: ${m} · best: ${o}`,
    controlsDesk: 'Arrow keys, WASD or click the field in the direction',
    controlsTouch: 'Swipe or tap the field in the direction',
    intro: {
      m: ['New: mud', 'The ball gets stuck in mud. Roll it out with the next move.'],
      d: ['New: bumper', 'A bumper turns the ball by 90° — look at the slant.'],
      p: ['New: portal', 'The ball enters a portal and rolls out of the portal of the same color, keeping its direction.'],
      x: ['New: fragile wall', 'It takes one hit: stops the ball and breaks.'],
      all: ['Final chapter', 'Everything together. Find the shortest path!'],
    },
    got: 'Got it',
    adFail: 'Ads are unavailable right now. Please try again later.',
    adFailFreeHint: 'Ads are unavailable right now — here is a free hint.',
    adNotFinished: 'The reward comes after watching the ad to the end.',
    noHint: 'The goal is unreachable from here. Undo or restart.',
    skipped: 'Level skipped',
    allDone: 'All levels complete! Try to get three stars everywhere.',
    stars: (s, t) => `Stars: ${s} of ${t}`,
  },
};

export const texts = (lang) => T[lang] || T.ru;
