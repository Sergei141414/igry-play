// Зверюшки рисуются кодом (своя графика, без файлов): круглое тело, крупная голова, большие глаза.
// Вид задаётся набором черт: уши, мордочка, узор, хвост, особые детали. Размер — по редкости.

const SP = [
  // малыши
  ['chick', 'small', { body: '#ffd84a', ears: 'none', snout: 'beak', tail: 'none', tuft: true }],
  ['bunny', 'small', { body: '#f3eee8', inner: '#ffb3c1', ears: 'long', snout: 'nose', tail: 'puff' }],
  ['mouse', 'small', { body: '#b9b4c4', inner: '#ffb3c1', ears: 'round', earSize: 1.25, snout: 'nose', tail: 'thin' }],
  ['kitten', 'small', { body: '#ffb066', inner: '#ffcfa3', ears: 'pointy', snout: 'cat', tail: 'long', stripesHead: true }],
  ['puppy', 'small', { body: '#e2b07a', inner: '#9a6a3f', ears: 'floppy', snout: 'muzzle', belly: '#f7e3c8', tail: 'short' }],
  ['duckling', 'small', { body: '#fff07a', ears: 'none', snout: 'duck', tail: 'none' }],
  ['hedgehog', 'small', { body: '#e8c9a0', ears: 'round', earSize: 0.7, snout: 'nose', spikes: '#8a6a4f', tail: 'none' }],
  ['frog', 'small', { body: '#7fd36b', belly: '#d9f5b8', ears: 'none', snout: 'none', bigEyes: true, tail: 'none' }],
  // средние
  ['fox', 'mid', { body: '#ff8a3d', inner: '#fff', ears: 'pointy', snout: 'cat', belly: '#fff4e8', tail: 'bushy', tailTip: '#fff' }],
  ['panda', 'mid', { body: '#fafafa', inner: '#333', ears: 'round', earColor: '#333', snout: 'muzzle', patches: '#333', tail: 'none', limbs: '#333' }],
  ['raccoon', 'mid', { body: '#a3a3ad', inner: '#555', ears: 'pointy', snout: 'cat', mask: '#4a4a52', tail: 'ringed' }],
  ['penguin', 'mid', { body: '#3a4660', belly: '#fff', ears: 'none', snout: 'beak', face: '#fff', tail: 'none' }],
  ['koala', 'mid', { body: '#a9adb8', inner: '#f2f2f2', ears: 'round', earSize: 1.45, snout: 'bignose', tail: 'none' }],
  ['owl', 'mid', { body: '#a77b56', belly: '#f0dcc0', ears: 'tufts', snout: 'beak', face: '#f0dcc0', tail: 'none' }],
  ['piglet', 'mid', { body: '#ffb7c5', inner: '#ff8fa6', ears: 'pointy', snout: 'pig', tail: 'curl' }],
  ['lamb', 'mid', { body: '#ffffff', ears: 'floppy', inner: '#f3c6a8', fleece: true, face: '#f6dcc8', snout: 'nose', tail: 'none' }],
  // крупные
  ['lion', 'big', { body: '#f2b84b', inner: '#d98a2b', ears: 'round', snout: 'muzzle', mane: '#c96a1e', tail: 'tuft' }],
  ['tiger', 'big', { body: '#ff9b2f', inner: '#fff', ears: 'round', snout: 'muzzle', belly: '#fff6e6', stripes: '#3a2a20', tail: 'long' }],
  ['elephant', 'big', { body: '#a6b4c8', inner: '#f2b9c4', ears: 'big', snout: 'trunk', tail: 'thin' }],
  ['giraffe', 'big', { body: '#ffd27a', ears: 'pointy', snout: 'muzzle', spots: '#c47a2c', horns: 'ossicones', tail: 'tuft' }],
  ['zebra', 'big', { body: '#ffffff', inner: '#333', ears: 'pointy', snout: 'muzzle', stripes: '#2b2b2b', mohawk: '#2b2b2b', tail: 'tuft' }],
  ['bear', 'big', { body: '#9a6a46', inner: '#d9b08c', ears: 'round', snout: 'muzzle', belly: '#c99a72', tail: 'none' }],
  // редкие
  ['unicorn', 'rare', { body: '#ffffff', inner: '#ffc0e0', ears: 'pointy', snout: 'nose', horns: 'unicorn', maneTop: 'rainbow', tail: 'rainbow' }],
  ['dragon', 'rare', { body: '#6fd39a', belly: '#e4ffd0', ears: 'none', snout: 'nose', horns: 'nubs', wings: '#4fae7c', spikesBack: '#ffcc4d', tail: 'long' }],
  ['rainbowcat', 'rare', { body: '#ffffff', inner: '#ffc0e0', ears: 'pointy', snout: 'cat', stripes: 'rainbow', tail: 'rainbow' }],
  ['goldfox', 'rare', { body: '#ffcc33', inner: '#fff8d0', ears: 'pointy', snout: 'cat', belly: '#fff8d0', tail: 'bushy', tailTip: '#fff8d0', shine: true }],
];

export const SPECIES = Object.fromEntries(SP.map(([id, tier, look]) => [id, { id, tier, look }]));
export const BY_TIER = { small: [], mid: [], big: [], rare: [] };
for (const [id, tier] of SP) BY_TIER[tier].push(id);
export const ALL_IDS = SP.map(([id]) => id);
export const TIER_SCALE = { small: 0.72, mid: 0.86, big: 1.04, rare: 1.08 };

const RAINBOW = ['#ff5b5b', '#ffa53b', '#ffe14d', '#5fd36b', '#4fb3ff', '#9b6bff'];

function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
const outline = (ctx, w) => { ctx.lineWidth = w; ctx.strokeStyle = 'rgba(40,30,40,0.55)'; ctx.stroke(); };

// Рисует зверя: (x, y) — точка между лапами на земле, s — высота зверя в пикселях.
// t — время в секундах (дыхание, моргание), look — смотрит влево (-1) или вправо (1), happy — прыжок радости.
export function drawAnimal(ctx, id, x, y, s, { t = 0, dir = 1, happy = 0, silhouette = false } = {}) {
  const sp = SPECIES[id];
  if (!sp) return;
  const L = sp.look;
  const u = s / 100;                           // 100 условных единиц на высоту зверя
  const breathe = Math.sin(t * 2.2 + x * 0.01) * 1.2;
  const hop = happy ? Math.abs(Math.sin(happy * Math.PI)) * 14 : 0;
  ctx.save();
  ctx.translate(x, y - hop * u);
  ctx.scale(dir * u, u);
  if (silhouette) { ctx.globalAlpha = 0.22; ctx.filter = 'brightness(0)'; }
  const lw = 2.2;
  const bodyY = -30, headY = -64 + breathe * 0.3, headR = 27;

  // тень
  if (!silhouette) ellipse(ctx, 0, 0, 30, 6, 'rgba(0,0,0,0.18)');

  // хвост (позади, слева при dir=1)
  drawTail(ctx, L, bodyY);
  // крылья
  if (L.wings) for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * 18, bodyY - 10); ctx.rotate(side * (0.5 + Math.sin(t * 6) * 0.15));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * 26, -30, side * 34, -6); ctx.quadraticCurveTo(side * 20, -4, 0, 6); ctx.closePath();
    ctx.fillStyle = L.wings; ctx.fill(); outline(ctx, lw); ctx.restore();
  }
  // гребень на спине
  if (L.spikesBack) for (let i = 0; i < 3; i++) {
    ctx.beginPath(); const bx = -20 + i * 7, by = bodyY - 18 + i * 2;
    ctx.moveTo(bx - 4, by + 4); ctx.lineTo(bx - 8, by - 6); ctx.lineTo(bx + 3, by + 1); ctx.closePath(); ctx.fillStyle = L.spikesBack; ctx.fill();
  }
  // иголки ёжика — вокруг тела и затылка
  if (L.spikes) {
    ctx.fillStyle = L.spikes;
    for (let i = 0; i < 13; i++) {
      const a = Math.PI * (0.85 + i * 0.1);
      const cx = Math.cos(a), cy = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx * 22, bodyY - 12 + cy * 26); ctx.lineTo(cx * 40, bodyY - 12 + cy * 44); ctx.lineTo(cx * 26 + cy * 8, bodyY - 12 + cy * 26 - cx * 8);
      ctx.closePath(); ctx.fill();
    }
  }

  // тело
  ctx.beginPath(); ctx.ellipse(0, bodyY, 24, 26, 0, 0, Math.PI * 2); ctx.fillStyle = L.fleece ? '#ffffff' : L.body; ctx.fill(); outline(ctx, lw);
  if (L.fleece) for (let i = 0; i < 9; i++) circle(ctx, Math.cos(i * 0.7) * 18, bodyY + Math.sin(i * 1.3) * 18, 8, '#ffffff');
  if (L.belly) ellipse(ctx, 0, bodyY + 6, 15, 17, L.belly);
  if (L.stripes) bodyStripes(ctx, L.stripes, bodyY, t);
  if (L.spots) for (const [sx, sy, sr] of [[-10, -36, 5], [8, -26, 6], [-4, -18, 4], [12, -40, 4]]) circle(ctx, sx, sy, sr, L.spots);
  // лапки
  const limb = L.limbs || shade(L.body, -0.12);
  for (const fx of [-11, 11]) { ellipse(ctx, fx, -5, 8, 6, limb); ctx.beginPath(); ctx.ellipse(fx, -5, 8, 6, 0, 0, Math.PI * 2); outline(ctx, 1.5); }
  if (L.limbs) for (const side of [-1, 1]) ellipse(ctx, side * 20, bodyY - 4, 6, 11, L.limbs, side * 0.4);

  // грива льва — за головой
  if (L.mane) for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; circle(ctx, Math.cos(a) * 28, headY + Math.sin(a) * 28, 10, L.mane); }
  // уши за головой
  drawEars(ctx, L, headY, headR, lw);
  // голова
  ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.fillStyle = L.body; ctx.fill(); outline(ctx, lw);
  if (L.face) ellipse(ctx, 0, headY + 6, 19, 17, L.face);
  if (L.fleece) for (let i = 0; i < 5; i++) circle(ctx, -12 + i * 6, headY - headR + 4 + Math.abs(i - 2) * 2, 7, '#ffffff');
  if (L.mohawk) for (let i = 0; i < 5; i++) ellipse(ctx, 0, headY - headR - 2 + i * 5, 4, 6, L.mohawk);
  if (L.ears === 'floppy') for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * headR * 0.85, headY - 8); ctx.rotate(side * 0.3);
    ctx.beginPath(); ctx.ellipse(0, 8, 8, 15, 0, 0, Math.PI * 2); ctx.fillStyle = L.inner || shade(L.body, -0.2); ctx.fill(); outline(ctx, lw); ctx.restore();
  }
  if (L.patches) for (const ex of [-10, 10]) ellipse(ctx, ex, headY + 1, 7, 9, L.patches, ex > 0 ? 0.5 : -0.5);
  if (L.mask) { ctx.beginPath(); ctx.ellipse(0, headY + 1, 22, 8, 0, 0, Math.PI * 2); ctx.fillStyle = L.mask; ctx.fill(); }
  if (L.stripes && L.stripes !== 'rainbow' || L.stripesHead) headStripes(ctx, L.stripesHead ? shade(L.body, -0.2) : L.stripes, headY, headR);
  if (L.stripes === 'rainbow') for (let i = 0; i < 3; i++) { ctx.fillStyle = RAINBOW[i * 2]; ctx.fillRect(-3 + (i - 1) * 8, headY - headR + 1, 4, 9); }
  if (L.spots) circle(ctx, 12, headY - 14, 4, L.spots);
  if (L.tuft) { ctx.beginPath(); ctx.moveTo(-3, headY - headR + 2); ctx.quadraticCurveTo(0, headY - headR - 12, 6, headY - headR - 6); ctx.strokeStyle = shade(L.body, -0.2); ctx.lineWidth = 3; ctx.stroke(); }
  if (L.maneTop) for (let i = 0; i < 5; i++) {
    const c = L.maneTop === 'rainbow' ? RAINBOW[i] : L.maneTop;
    ellipse(ctx, -14 + i * 3, headY - headR + 4 + i * 4, 6, 9, c, -0.6);
  }
  drawHorns(ctx, L, headY, headR, lw, t);

  // глаза (моргают раз в ~4 с)
  const blink = ((t + x * 0.003) % 4) > 3.86;
  const eyeR = L.bigEyes ? 8 : 5.5;
  const eyeY = L.bigEyes ? headY - 14 : headY - 2;
  for (const ex of [-10, 10]) {
    if (L.bigEyes) { circle(ctx, ex, eyeY, eyeR + 3, L.body); ctx.beginPath(); ctx.arc(ex, eyeY, eyeR + 3, 0, Math.PI * 2); outline(ctx, 1.5); }
    if (blink) { ctx.beginPath(); ctx.moveTo(ex - eyeR, eyeY); ctx.quadraticCurveTo(ex, eyeY + 3, ex + eyeR, eyeY); ctx.strokeStyle = '#2b2230'; ctx.lineWidth = 2; ctx.stroke(); continue; }
    circle(ctx, ex, eyeY, eyeR, L.patches || L.mask ? '#fff' : '#2b2230');
    circle(ctx, ex, eyeY, eyeR * (L.patches || L.mask ? 0.7 : 1), '#2b2230');
    circle(ctx, ex + eyeR * 0.35, eyeY - eyeR * 0.35, eyeR * 0.38, '#ffffff');
  }
  // румянец
  for (const ex of [-17, 17]) ellipse(ctx, ex, headY + 8, 5, 3, 'rgba(255,120,140,0.45)');
  drawSnout(ctx, L, headY, lw);

  if (L.shine && !silhouette) sparkles(ctx, t, headY);
  ctx.restore();
}

function drawTail(ctx, L, bodyY) {
  const c = L.body;
  ctx.save(); ctx.translate(-22, bodyY + 6);
  switch (L.tail) {
    case 'puff': circle(ctx, -2, 0, 8, '#ffffff'); break;
    case 'thin': ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-22, 4, -26, -16); ctx.strokeStyle = shade(c, -0.15); ctx.lineWidth = 3; ctx.stroke(); break;
    case 'short': ellipse(ctx, -4, -6, 5, 9, c, -0.7); break;
    case 'long': ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-26, 2, -24, -26); ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); break;
    case 'bushy': ellipse(ctx, -14, -12, 11, 20, c, -0.7); if (L.tailTip) ellipse(ctx, -24, -26, 6, 8, L.tailTip, -0.7); break;
    case 'ringed': for (let i = 0; i < 4; i++) ellipse(ctx, -6 - i * 5, -4 - i * 6, 7, 6, i % 2 ? '#4a4a52' : c, -0.7); break;
    case 'curl': ctx.beginPath(); ctx.arc(-6, -4, 5, 0, Math.PI * 1.6); ctx.strokeStyle = shade(c, -0.15); ctx.lineWidth = 3; ctx.stroke(); break;
    case 'tuft': ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-18, 0, -20, -14); ctx.strokeStyle = shade(c, -0.1); ctx.lineWidth = 3; ctx.stroke(); circle(ctx, -20, -16, 5, L.mane || L.maneTop || '#5a3a20'); break;
    case 'rainbow': RAINBOW.forEach((col, i) => ellipse(ctx, -8 - i * 3, -4 - i * 5, 6, 5, col, -0.6)); break;
    default: break;
  }
  ctx.restore();
}

function drawEars(ctx, L, headY, headR, lw) {
  const c = L.earColor || L.body;
  const inner = L.inner || shade(L.body, 0.25);
  const k = L.earSize || 1;
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * headR * 0.62, headY - headR * 0.72);
    switch (L.ears) {
      case 'round': circle(ctx, 0, 0, 9 * k, c); ctx.beginPath(); ctx.arc(0, 0, 9 * k, 0, Math.PI * 2); outline(ctx, lw); circle(ctx, 0, 1, 5 * k, inner); break;
      case 'pointy': ctx.rotate(side * 0.25); ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(0, -16); ctx.lineTo(9, 6); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); outline(ctx, lw);
        ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(0, -9); ctx.lineTo(5, 4); ctx.closePath(); ctx.fillStyle = inner; ctx.fill(); break;
      case 'long': ctx.rotate(side * 0.15); ellipse(ctx, 0, -16, 7, 20, c); ctx.beginPath(); ctx.ellipse(0, -16, 7, 20, 0, 0, Math.PI * 2); outline(ctx, lw); ellipse(ctx, 0, -15, 3.5, 14, inner); break;
      case 'big': ctx.translate(side * 10, 18); ellipse(ctx, 0, 0, 18, 22, c); ctx.beginPath(); ctx.ellipse(0, 0, 18, 22, 0, 0, Math.PI * 2); outline(ctx, lw); ellipse(ctx, side * 2, 1, 11, 15, inner); break;
      case 'tufts': ctx.rotate(side * 0.5); ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(0, -12); ctx.lineTo(6, 6); ctx.closePath(); ctx.fillStyle = shade(L.body, -0.15); ctx.fill(); break;
      default: break;
    }
    ctx.restore();
  }
}

function drawHorns(ctx, L, headY, headR, lw, t) {
  if (L.horns === 'unicorn') {
    ctx.beginPath(); ctx.moveTo(-5, headY - headR + 3); ctx.lineTo(0, headY - headR - 24); ctx.lineTo(5, headY - headR + 3); ctx.closePath();
    const g = ctx.createLinearGradient(0, headY - headR - 24, 0, headY - headR);
    g.addColorStop(0, '#fff7a8'); g.addColorStop(1, '#ffc65c'); ctx.fillStyle = g; ctx.fill(); outline(ctx, 1.5);
  }
  if (L.horns === 'ossicones') for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(side * 6, headY - headR + 4); ctx.lineTo(side * 7, headY - headR - 10); ctx.strokeStyle = shade(L.body, -0.25); ctx.lineWidth = 4; ctx.stroke();
    circle(ctx, side * 7, headY - headR - 11, 4, '#8a5a2b');
  }
  if (L.horns === 'nubs') for (const side of [-1, 1]) circle(ctx, side * 9, headY - headR + 2, 5, '#ffe29a');
}

function drawSnout(ctx, L, headY, lw) {
  const y = headY + 8;
  const mouth = (yy) => { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.quadraticCurveTo(-2, yy + 3, 0, yy); ctx.quadraticCurveTo(2, yy + 3, 4, yy); ctx.strokeStyle = '#3a2a30'; ctx.lineWidth = 1.6; ctx.stroke(); };
  switch (L.snout) {
    case 'beak': ctx.beginPath(); ctx.moveTo(-5, y - 2); ctx.lineTo(0, y + 6); ctx.lineTo(5, y - 2); ctx.closePath(); ctx.fillStyle = '#ff9f1c'; ctx.fill(); break;
    case 'duck': ellipse(ctx, 0, y + 1, 9, 4.5, '#ff9f1c'); break;
    case 'nose': ellipse(ctx, 0, y - 1, 3, 2.2, '#ff7b9c'); mouth(y + 2); break;
    case 'cat': ctx.beginPath(); ctx.moveTo(-3, y - 2); ctx.lineTo(3, y - 2); ctx.lineTo(0, y + 1); ctx.closePath(); ctx.fillStyle = '#ff7b9c'; ctx.fill(); mouth(y + 2);
      ctx.strokeStyle = 'rgba(60,40,40,0.5)'; ctx.lineWidth = 1; for (const s of [-1, 1]) for (const dy of [-1, 2]) { ctx.beginPath(); ctx.moveTo(s * 7, y + dy); ctx.lineTo(s * 17, y + dy * 2 - 1); ctx.stroke(); } break;
    case 'muzzle': ellipse(ctx, 0, y + 1, 10, 7, L.inner && L.ears !== 'floppy' && L.inner !== '#fff' && L.inner !== '#333' ? L.inner : shade(L.body, 0.3)); ellipse(ctx, 0, y - 2, 4, 3, '#3a2a30'); mouth(y + 2); break;
    case 'pig': ellipse(ctx, 0, y, 8, 6, L.inner); circle(ctx, -3, y, 1.6, '#c0566e'); circle(ctx, 3, y, 1.6, '#c0566e'); break;
    case 'bignose': ellipse(ctx, 0, y - 1, 6, 8, '#3f3f46'); break;
    case 'trunk': ctx.beginPath(); ctx.moveTo(-6, y - 4); ctx.quadraticCurveTo(-8, y + 16, 4, y + 20); ctx.quadraticCurveTo(8, y + 18, 6, y + 14); ctx.quadraticCurveTo(2, y + 10, 6, y - 4); ctx.closePath();
      ctx.fillStyle = L.body; ctx.fill(); outline(ctx, lw); break;
    default: mouth(y + 2);
  }
}

function bodyStripes(ctx, color, bodyY, t) {
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); const yy = bodyY - 18 + i * 10;
    ctx.moveTo(-22, yy); ctx.quadraticCurveTo(-14, yy + 3, -10, yy - 1);
    ctx.moveTo(22, yy); ctx.quadraticCurveTo(14, yy + 3, 10, yy - 1);
    ctx.strokeStyle = color === 'rainbow' ? RAINBOW[(i + Math.floor(t * 2)) % RAINBOW.length] : color; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  }
}
function headStripes(ctx, color, headY, headR) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(dx, headY - headR + 2); ctx.lineTo(dx * 0.8, headY - headR + 10); ctx.stroke(); }
}
function sparkles(ctx, t, headY) {
  for (let i = 0; i < 4; i++) {
    const a = t * 1.5 + i * 1.6;
    const x = Math.cos(a) * 34, y = headY + 10 + Math.sin(a * 1.3) * 34;
    const r = 3 + 2 * Math.abs(Math.sin(t * 3 + i));
    ctx.fillStyle = '#fff6a0';
    ctx.beginPath(); ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.5, y + r * 0.5);
    ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.5, y - r * 0.5); ctx.closePath(); ctx.fill();
  }
}

// Цвет светлее (k > 0) или темнее (k < 0).
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
