// Журнал партий: обезличенные ходы игрока → наш сервер в РФ, чтобы видеть, сколько людей играло,
// где бросили и на каких примерах ошибаются. Сводка — tools/jurnal.mjs.
// Включается, только если в index.html есть <meta name="journal" content="адрес приёма"> — её ставит
// тестовая сборка (build.mjs web). В сборках площадок метки нет, и модуль ничего не шлёт.
// Персональных данных нет: номер игрока — случайный, создаётся в браузере; IP сервер не пишет.

const FLUSH_EVERY = 15000;   // мс: пачка уходит не реже
const FLUSH_SIZE = 40;       // событий в пачке — уходит сразу
const MAX_EVENTS = 3000;     // за один запуск больше не пишем (зависшая вкладка не засыплет сервер)

const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');

export function createJournal({ game }) {
  const url = document.querySelector('meta[name="journal"]')?.content;
  if (!url) return { enabled: false, log() {}, flush() {} };

  let pid;
  try {
    pid = localStorage.getItem('journal-pid');
    if (!/^[a-z0-9]{12}$/.test(pid || '')) localStorage.setItem('journal-pid', (pid = rid(12)));
  } catch { pid = rid(12); } // хранилище запрещено — номер живёт до закрытия вкладки
  const sid = rid(10);
  const build = document.querySelector('meta[name="build"]')?.content || '';
  const t0 = performance.now();
  let buf = [];
  let n = 0;
  let total = 0;

  const send = (body) => {
    try {
      // text/plain — без предварительного запроса CORS; sendBeacon доходит и при закрытии вкладки
      if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
    } catch {}
    fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors', headers: { 'content-type': 'text/plain' } }).catch(() => {});
  };
  const flush = () => {
    if (!buf.length) return;
    send(JSON.stringify({ v: 1, game, build, pid, sid, n: n++, ev: buf }));
    buf = [];
  };
  const log = (e, d) => {
    if (++total > MAX_EVENTS) return;
    buf.push({ t: Math.round(performance.now() - t0), e, ...d });
    if (buf.length >= FLUSH_SIZE) flush();
  };

  setInterval(flush, FLUSH_EVERY);
  // Свернул, переключил вкладку, закрыл — отправить сразу: это и есть «где бросил».
  document.addEventListener('visibilitychange', () => {
    const hidden = document.visibilityState === 'hidden';
    log(hidden ? 'hide' : 'show');
    if (hidden) flush();
  });
  window.addEventListener('pagehide', flush);

  return { enabled: true, log, flush };
}
