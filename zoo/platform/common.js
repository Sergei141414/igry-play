// Общее для всех площадок: учёт пауз игры и звука, язык, обёртка рекламы.
// Модули площадок подключают сюда только свои вызовы SDK.

const RU_LANGS = new Set(['ru', 'be', 'kk', 'uk', 'uz']);
export const pickLang = (raw) => (RU_LANGS.has(String(raw || '').slice(0, 2)) ? 'ru' : 'en');

// onGameplay(on) — сообщить площадке, идёт ли игровой процесс (разметка геймплея, если она есть).
export function createPauses({ onPause, onResume, onGameplay }) {
  // Остановок геймплея бывает несколько сразу (меню + реклама + свёрнутая вкладка):
  // считаем причины, «идёт» — только когда их не осталось.
  const holds = new Set(['loading']);
  let gameplayOn = false;
  const sync = () => {
    const want = holds.size === 0;
    if (want === gameplayOn) return;
    gameplayOn = want;
    try { onGameplay?.(want); } catch {}
  };
  // Две разные паузы:
  //   external — игра стоит целиком (реклама, событие площадки, скрытая вкладка);
  //   mute — только звук: всё из external плюс потеря фокуса окна.
  // Фокус не останавливает игру: если браузер пришлёт blur без focus, игра не должна застыть.
  const external = new Set();
  const mute = new Set();
  const setMute = (why, on) => {
    const before = mute.size > 0;
    on ? mute.add(why) : mute.delete(why);
    const after = mute.size > 0;
    if (after && !before) onPause?.();
    if (!after && before) onResume?.();
  };
  const setExternal = (why, on) => {
    on ? external.add(why) : external.delete(why);
    setMute(why, on);
  };
  const hold = (why, on) => { on ? holds.add(why) : holds.delete(why); sync(); };

  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    setExternal('tab', hidden);
    hold('tab', hidden);
  });
  window.addEventListener('blur', () => setMute('focus', true));
  window.addEventListener('focus', () => setMute('focus', false));
  // Игрок нажал внутри игры — значит, фокус у нас, даже если событие focus потерялось.
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => setMute('focus', false), { capture: true });

  return {
    setExternal,
    hold,
    ready: () => hold('loading', false),
    setPlaying: (on) => hold('ui', !on),
    isPausedExternally: () => external.size > 0,
    pauseReasons: () => ({ external: [...external], mute: [...mute] }),
    // Реклама: на время показа игра и звук стоят, геймплей «не идёт».
    async withAd(show) {
      hold('ad', true);
      setExternal('ad', true);
      try { return await show(); } finally {
        setExternal('ad', false);
        hold('ad', false);
      }
    },
  };
}

// Локальное хранилище с защитой от запрета (приватный режим, встроенные браузеры).
export function localStore(storage = (() => { try { return window.localStorage; } catch { return null; } })()) {
  return {
    get(key) { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } },
    set(key, data) { try { storage?.setItem(key, JSON.stringify(data)); } catch {} },
  };
}
