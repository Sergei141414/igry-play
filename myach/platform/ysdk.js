// Площадка «Яндекс Игры». Правила, под которые написано (yandex.ru/dev/games/doc/ru, сверено 15.10.2026):
//   1.19.2 LoadingAPI.ready() — когда игрок уже может играть;
//   1.19.3 GameplayAPI.start/stop — строго по разметке геймплея (меню, пауза, реклама, вкладка);
//   1.19.4 game_api_pause/resume — останавливаем игру и звук, в том числе на стартовой рекламе;
//   4.7    на полноэкранной рекламе и rewarded — пауза игры и звука;
//   4.5    награда за rewarded — только в onRewarded;
//   1.9    прогресс сохраняется сразу; 2.14 язык — из SDK.
// Без SDK (локальный файл, нет сети) игра работает на заглушке: реклама «не показалась»,
// сохранения — только в localStorage.
import { createPauses, pickLang, localStore } from './common.js';

export async function initPlatform({ onPause, onResume, storageKey }) {
  let ysdk = null;
  try {
    if (typeof YaGames !== 'undefined') ysdk = await YaGames.init();
  } catch (e) {
    console.warn('SDK не инициализирован, играем без него:', e?.message || e);
  }

  let player = null;
  let safe = null;
  if (ysdk) {
    try { player = await ysdk.getPlayer(); } catch { player = null; }
    try { safe = ysdk.getStorage ? await ysdk.getStorage() : null; } catch { safe = null; }
  }
  const local = safe ? localStore(safe) : localStore();

  const p = createPauses({
    onPause, onResume,
    onGameplay: (on) => (on ? ysdk?.features?.GameplayAPI?.start() : ysdk?.features?.GameplayAPI?.stop()),
  });
  if (ysdk) {
    ysdk.on?.('game_api_pause', () => p.setExternal('platform', true));
    ysdk.on?.('game_api_resume', () => p.setExternal('platform', false));
  }

  return {
    name: 'yandex',
    hasSdk: !!ysdk,
    lang: pickLang(ysdk?.environment?.i18n?.lang || navigator.language || 'ru'),
    // Игрок может начать играть: один раз, после того как всё загружено и меню на экране.
    ready() {
      p.ready();
      try { ysdk?.features?.LoadingAPI?.ready(); } catch {}
    },
    setPlaying: p.setPlaying,
    isPausedExternally: p.isPausedExternally,
    pauseReasons: p.pauseReasons,
    // Полноэкранная реклама в логической паузе. Возвращает, была ли показана.
    showInterstitial() {
      if (!ysdk) return Promise.resolve(false);
      return p.withAd(() => new Promise((resolve) => {
        try {
          ysdk.adv.showFullscreenAdv({ callbacks: {
            onClose: (wasShown) => resolve(!!wasShown),
            onError: () => resolve(false),
          } });
        } catch { resolve(false); }
      }));
    },
    // Rewarded: true — досмотрел, награду выдавать; false — закрыл раньше или ошибка.
    showRewarded() {
      if (!ysdk) return Promise.resolve({ rewarded: false, error: true });
      return p.withAd(() => new Promise((resolve) => {
        let rewarded = false;
        try {
          ysdk.adv.showRewardedVideo({ callbacks: {
            onRewarded: () => { rewarded = true; },
            onClose: () => resolve({ rewarded, error: false }),
            onError: () => resolve({ rewarded: false, error: true }),
          } });
        } catch { resolve({ rewarded: false, error: true }); }
      }));
    },
    // Сохранения: localStorage (или safeStorage SDK) + облако игрока; merge сводит две копии.
    async load(merge) {
      let cloud = null;
      try { cloud = player ? (await player.getData([storageKey]))?.[storageKey] || null : null; } catch {}
      return merge(local.get(storageKey), cloud);
    },
    async save(data) {
      local.set(storageKey, data);
      try { await player?.setData({ [storageKey]: data }, true); } catch {}
    },
  };
}
