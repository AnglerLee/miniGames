// 증거 장면: 지문 대조.
// 간식 통 뚜껑에 거의 안 보이는 지문이 있다. 붓으로 문지르면 가루가 묻어 지문이 점점 진해진다.
// 충분히 진해지면 기준 지문 카드를 하나 골라 옆에 나란히 놓고 비교한 뒤 "이 모양이다"로 확정한다.
// 대조할 때는 뚜껑의 지문을 손가락으로 돌려 카드와 같은 방향으로 맞춰 볼 수 있다. 규격은 index.js 참고.
import { h, ensureStyle } from '../../shared/dom.js';
import { drawFingerprint, traitCanvas } from '../../shared/draw.js';
import { PRINT_TYPES } from '../../shared/content.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
// 가루 밀도 격자. 지문 높이 P 를 1로 보고 가운데에서 ±SPAN/2 를 G×G 칸으로 나눈다
const G = 40;
const SPAN = 1.1;
const BASE = 0.045; // 붓질 전에도 아주 희미하게 보인다. 어디를 문지를지 알려 주는 정도
const NEED = 0.6; // 지문 안쪽 평균 진하기가 이만큼 되면 대조 단계로
const BRUSH = 0.15; // 붓 반지름 (P 기준)
const DAB = 0.12; // 붓이 한 번 지나갈 때 묻는 가루
const OVAL = { rx: 0.36, ry: 0.5 }; // drawFingerprint 의 타원 (P 기준)
// 모양을 가르는 가운데. 얼룩이 여기를 덮으면 세 모양을 구별할 수 없으므로 비워 둔다
const CORE = { u: 0, v: -0.04, r: 0.17 };
const COVER = 0.35; // 얼룩이 지문을 가리는 비율 (규격 30~40%)
const INK = '#25252d';
const TWEEN_MS = 450;
const CELEBRATE_MS = 700;

const CSS = `
.sc-fingerprint { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 10px; color: var(--ink); user-select: none; -webkit-user-select: none; }
.sc-fingerprint-line { flex: none; text-align: center; font-size: 17px; font-weight: 800; line-height: 1.35; }
.sc-fingerprint-line.is-hint { color: var(--red-deep); }
.sc-fingerprint-wrap { position: relative; flex: 1 1 0; min-height: 140px; }
.sc-fingerprint-wrap canvas { position: absolute; left: 0; top: 0; touch-action: none; }
.sc-fingerprint-rot { position: absolute; left: 4px; bottom: 2px; padding: 2px 8px; border-radius: 999px; background: rgba(43, 33, 24, 0.75); color: #fff; font-size: 12px; font-weight: 700; pointer-events: none; animation: sc-fingerprint-in 0.3s ease both; }
.sc-fingerprint-rot[hidden], .sc-fingerprint-stamp[hidden] { display: none; }
.sc-fingerprint-ctl { flex: none; display: flex; flex-direction: column; gap: 8px; }
.sc-fingerprint-meter { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 4px; font-size: 15px; font-weight: 800; white-space: nowrap; }
.sc-fingerprint-bar { flex: 1; height: 16px; border-radius: 999px; background: rgba(0, 0, 0, 0.1); box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.22); overflow: hidden; }
.sc-fingerprint-fill { width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #8d8a96, #4b4856); transition: width 0.15s ease; }
.sc-fingerprint-cards { display: flex; gap: 8px; animation: sc-fingerprint-in 0.3s ease both; }
.sc-fingerprint-card { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 2px 4px; border-radius: 12px; background: #fffdf7; border: 2px solid var(--paper-line); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18); color: var(--ink); font-size: 13px; font-weight: 800; white-space: nowrap; transition: transform 0.12s ease, border-color 0.12s ease; }
.sc-fingerprint-card canvas { max-width: 100%; height: auto !important; }
.sc-fingerprint-card.is-on { border-color: var(--gold); background: #fff2cc; transform: translateY(-4px); box-shadow: 0 6px 0 rgba(0, 0, 0, 0.18); }
.sc-fingerprint-card.is-wrong > * { opacity: 0.4; }
.sc-fingerprint-card.is-wrong::after { content: '✕'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--red); font-size: 44px; font-weight: 900; }
.sc-fingerprint-card.is-right { border-color: var(--green); background: #e1f3e8; pointer-events: none; }
.sc-fingerprint-stamp { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-6deg); padding: 6px 14px; border: 3px solid var(--green); border-radius: 10px; background: rgba(246, 236, 214, 0.95); color: var(--green); font-size: 21px; font-weight: 900; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); animation: sc-fingerprint-pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
@keyframes sc-fingerprint-in { from { opacity: 0; transform: translateY(10px); } }
@keyframes sc-fingerprint-pop { from { opacity: 0; transform: translate(-50%, -50%) rotate(-6deg) scale(1.7); } }
`;

const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;

function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * 초코 얼룩: 지문 가장자리 쪽에 덩어리 3개. 가운데(CORE)는 비우고,
 * 원 반지름 배율을 이분 탐색해 지문 타원의 COVER 만큼을 가리게 맞춘다.
 */
function makeSmudges(rng) {
  const circles = [];
  const start = rng.int(360) * DEG;
  for (let b = 0; b < 3; b++) {
    const a = start + b * 120 * DEG + (rng.int(41) - 20) * DEG;
    const f = 0.7 + rng.int(25) / 100;
    const bu = Math.cos(a) * OVAL.rx * f;
    const bv = Math.sin(a) * OVAL.ry * f;
    const n = 3 + rng.int(2);
    for (let c = 0; c < n; c++) {
      circles.push({ u: bu + (rng.int(17) - 8) / 100, v: bv + (rng.int(17) - 8) / 100, r0: 0.07 + rng.int(6) / 100, r: 0 });
    }
  }
  const samples = [];
  const N = 48;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = (-1 + (2 * i + 1) / N) * OVAL.rx;
      const v = (-1 + (2 * j + 1) / N) * OVAL.ry;
      if ((u / OVAL.rx) ** 2 + (v / OVAL.ry) ** 2 <= 1) samples.push([u, v]);
    }
  }
  const apply = (k) => {
    for (const c of circles) c.r = Math.max(0, Math.min(c.r0 * k, Math.hypot(c.u - CORE.u, c.v - CORE.v) - CORE.r));
  };
  const cover = () => {
    let n = 0;
    for (const [u, v] of samples) if (circles.some((c) => (u - c.u) ** 2 + (v - c.v) ** 2 <= c.r * c.r)) n++;
    return n / samples.length;
  };
  let lo = 0.3;
  let hi = 4;
  for (let it = 0; it < 18; it++) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (cover() < COVER) lo = mid;
    else hi = mid;
  }
  apply(hi);
  return { circles: circles.filter((c) => c.r > 0.01), cover: cover() };
}

export function mount(root, ctx) {
  ensureStyle('hd-scene-fingerprint', CSS);
  const data = ctx.data;
  const rng = ctx.rng;
  const type = data.printType;
  const baseRot = (data.rotate || 0) * DEG;
  const smudge = makeSmudges(rng);

  // 가루 밀도 (지문 기준 좌표라서 지문을 돌리거나 화면이 바뀌어도 그대로 남는다)
  const dens = new Float32Array(G * G);
  const ovalCells = [];
  const cs = SPAN / G;
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const u = -SPAN / 2 + (i + 0.5) * cs;
      const v = -SPAN / 2 + (j + 0.5) * cs;
      if ((u / OVAL.rx) ** 2 + (v / OVAL.ry) ** 2 <= 1) ovalCells.push(j * G + i);
    }
  }
  let densFrom = null;

  let alive = true;
  let finished = false;
  let stage = 'brush';
  const timers = new Set();
  let raf = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let drag = null;
  let brushAt = null;
  let brushTilt = 30 * DEG;
  let userRot = 0;
  let tweenAt = 0;
  let selected = null;
  let selAt = 0;
  let celebAt = 0;
  let lastNow = 0;
  let lastRub = 0;
  let maskDirty = true;
  let printKey = '';
  const puffs = [];

  const line = h('p', { class: 'sc-fingerprint-line', text: '붓으로 문질러 지문을 살려 봐' });
  const cv = h('canvas', { role: 'img', 'aria-label': '간식 통 뚜껑의 지문' });
  const rotBadge = h('div', { class: 'sc-fingerprint-rot', hidden: true, text: '↻ 지문을 돌려 볼 수 있어' });
  const stamp = h('div', { class: 'sc-fingerprint-stamp', hidden: true });
  const wrap = h('div', { class: 'sc-fingerprint-wrap' }, cv, rotBadge, stamp);
  const fillBar = h('div', { class: 'sc-fingerprint-fill' });
  const meter = h(
    'div',
    { class: 'sc-fingerprint-meter' },
    h('span', { text: '🖌️ 지문' }),
    h('div', { class: 'sc-fingerprint-bar' }, fillBar)
  );
  const ctl = h('div', { class: 'sc-fingerprint-ctl' }, meter);
  const cards = data.options.map((n, i) =>
    h(
      'button',
      { class: 'sc-fingerprint-card', type: 'button', 'aria-label': PRINT_TYPES[n], onClick: () => choose(i) },
      traitCanvas('print', n, 72),
      h('span', { text: PRINT_TYPES[n] })
    )
  );
  const confirmBtn = h('button', { class: 'btn primary block', type: 'button', disabled: true, text: '이 모양이다', onClick: confirm });
  const el = h(
    'div',
    { class: 'sc-fingerprint', 'data-stage': stage, 'data-progress': '0', 'data-cover': smudge.cover.toFixed(2) },
    line,
    wrap,
    ctl
  );
  root.append(el);
  const g = cv.getContext('2d');

  // 지문 그림과 가루 가면. 가면은 G×G 작은 캔버스를 늘려 그려서 부드럽게 번진다
  const visCv = document.createElement('canvas');
  const hazeCv = document.createElement('canvas');
  visCv.width = visCv.height = hazeCv.width = hazeCv.height = G;
  const visImg = new ImageData(G, G);
  const hazeImg = new ImageData(G, G);
  const printCv = document.createElement('canvas');
  const pg = printCv.getContext('2d');

  function setStage(s) {
    stage = s;
    el.dataset.stage = s;
  }

  function later(ms, fn) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
  }

  function finish() {
    if (finished || !alive) return;
    finished = true;
    ctx.done();
  }

  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
    later(400, () => node.classList.remove('shake'));
  }

  function progress() {
    let sum = 0;
    for (const k of ovalCells) sum += Math.min(1, dens[k]);
    return sum / ovalCells.length;
  }

  // ---- 단계 ----

  function toCompare() {
    setStage('compare');
    tweenAt = performance.now();
    densFrom = dens.slice();
    line.textContent = '카드를 골라 나란히 비교해 봐';
    ctl.replaceChildren(h('div', { class: 'sc-fingerprint-cards' }, cards), confirmBtn);
    rotBadge.hidden = false;
    ctx.sfx('reveal');
    wake();
  }

  function choose(i) {
    if (!alive || stage !== 'compare' || cards[i].disabled) return;
    selected = i;
    selAt = performance.now();
    cards.forEach((c, j) => c.classList.toggle('is-on', j === i));
    confirmBtn.disabled = false;
    ctx.sfx('snap');
    wake();
  }

  function confirm() {
    if (!alive || stage !== 'compare' || selected === null) return;
    const card = cards[selected];
    if (selected === data.answer) {
      setStage('done');
      card.classList.remove('is-on');
      card.classList.add('is-right');
      cards.forEach((c, j) => {
        if (j !== selected) c.disabled = true;
      });
      confirmBtn.disabled = true;
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 범인의 지문 모양이야';
      rotBadge.hidden = true;
      stamp.textContent = '같은 지문이야!';
      stamp.hidden = false;
      ctx.sfx('good');
      ctx.buzz(30);
      celebAt = performance.now();
      wake();
      later(CELEBRATE_MS, finish);
    } else {
      card.classList.remove('is-on');
      card.classList.add('is-wrong');
      card.disabled = true;
      selected = null;
      confirmBtn.disabled = true;
      ctx.miss();
      ctx.sfx('bad');
      ctx.buzz([40, 40, 40]);
      shake(wrap);
      line.textContent = '달라. 다른 카드와 비교해 봐';
      line.classList.add('is-hint');
      wake();
    }
  }

  // ---- 가루 ----

  function dab(u, v, amount) {
    const r2 = BRUSH * BRUSH;
    const i0 = Math.max(0, Math.floor((u - BRUSH + SPAN / 2) / cs));
    const i1 = Math.min(G - 1, Math.floor((u + BRUSH + SPAN / 2) / cs));
    const j0 = Math.max(0, Math.floor((v - BRUSH + SPAN / 2) / cs));
    const j1 = Math.min(G - 1, Math.floor((v + BRUSH + SPAN / 2) / cs));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const du = -SPAN / 2 + (i + 0.5) * cs - u;
        const dv = -SPAN / 2 + (j + 0.5) * cs - v;
        const d2 = du * du + dv * dv;
        if (d2 >= r2) continue;
        const k = j * G + i;
        dens[k] = Math.min(1.2, dens[k] + amount * (1 - d2 / r2));
      }
    }
    maskDirty = true;
  }

  function uploadMask() {
    for (let k = 0; k < G * G; k++) {
      const d = Math.min(1, dens[k]);
      visImg.data[k * 4 + 3] = Math.round(255 * (BASE + (1 - BASE) * d));
      hazeImg.data[k * 4] = 128;
      hazeImg.data[k * 4 + 1] = 126;
      hazeImg.data[k * 4 + 2] = 134;
      hazeImg.data[k * 4 + 3] = Math.round(255 * 0.3 * d);
    }
    visCv.getContext('2d').putImageData(visImg, 0, 0);
    hazeCv.getContext('2d').putImageData(hazeImg, 0, 0);
    maskDirty = false;
    printKey = '';
  }

  /** 가루가 묻은 만큼만 보이는 지문 그림 (기기 픽셀 단위) */
  function ensurePrint(P) {
    const px = Math.max(8, Math.round(SPAN * P * dpr));
    const key = px + '';
    if (key === printKey) return;
    printKey = key;
    printCv.width = px;
    printCv.height = px;
    pg.clearRect(0, 0, px, px);
    pg.globalCompositeOperation = 'source-over';
    drawFingerprint(pg, type, px / 2, px / 2, P * dpr, { color: INK });
    pg.globalCompositeOperation = 'destination-in';
    pg.imageSmoothingEnabled = true;
    pg.drawImage(visCv, 0, 0, px, px);
    pg.globalCompositeOperation = 'source-over';
  }

  // ---- 자리 잡기 ----

  /** t=0 붓질 (뚜껑이 가운데 크게), t=1 대조 (왼쪽 뚜껑, 오른쪽 카드 자리) */
  function layoutAt(t) {
    const e = ease(t);
    const L1 = Math.min(W * 0.96, H * 0.98) / 2;
    const L2 = Math.min(W * 0.46, H * 0.96) / 2;
    const L = lerp(L1, L2, e);
    return { x: lerp(W / 2, W * 0.25, e), y: H / 2, L, P: L * 1.55, refX: W * 0.75, L2, show: e };
  }

  function tweenT(now) {
    if (stage === 'brush') return 0;
    return Math.min(1, (now - tweenAt) / TWEEN_MS);
  }

  function layout() {
    const w = Math.floor(wrap.clientWidth);
    const hh = Math.floor(wrap.clientHeight);
    if (w < 40 || hh < 40 || (w === W && hh === H)) return;
    W = w;
    H = hh;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    puffs.length = 0;
    printKey = '';
    draw(performance.now());
  }

  // ---- 그리기 ----

  function drawLid(x, y, L) {
    g.fillStyle = 'rgba(0, 0, 0, 0.16)';
    g.beginPath();
    g.arc(x + L * 0.03, y + L * 0.05, L, 0, TAU);
    g.fill();
    let grad = g.createRadialGradient(x - L * 0.3, y - L * 0.3, L * 0.2, x, y, L);
    grad.addColorStop(0, '#e2604c');
    grad.addColorStop(1, '#a3301f');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, L, 0, TAU);
    g.fill();
    grad = g.createLinearGradient(x - L, y - L, x + L, y + L);
    grad.addColorStop(0, '#f6f8f9');
    grad.addColorStop(1, '#c9d1d7');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, L * 0.88, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(x, y, L * 0.88, 0, TAU);
    g.clip();
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    g.beginPath();
    g.ellipse(x - L * 0.42, y - L * 0.5, L * 0.5, L * 0.12, -38 * DEG, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawSmudges(P) {
    g.save();
    g.shadowColor = 'rgba(40, 20, 5, 0.35)';
    g.shadowBlur = P * 0.03;
    g.fillStyle = '#6b4024';
    g.beginPath();
    for (const c of smudge.circles) {
      g.moveTo(c.u * P + c.r * P, c.v * P);
      g.arc(c.u * P, c.v * P, c.r * P, 0, TAU);
    }
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#7d4b2b';
    g.beginPath();
    for (const c of smudge.circles) {
      g.moveTo(c.u * P + c.r * P * 0.7, c.v * P);
      g.arc(c.u * P, c.v * P, c.r * P * 0.7, 0, TAU);
    }
    g.fill();
    // 초콜릿 윤기
    g.fillStyle = 'rgba(255, 236, 214, 0.28)';
    g.beginPath();
    for (const c of smudge.circles) {
      const x = (c.u - c.r * 0.3) * P;
      const y = (c.v - c.r * 0.38) * P;
      g.moveTo(x + c.r * P * 0.32, y);
      g.ellipse(x, y, c.r * P * 0.32, c.r * P * 0.15, -0.5, 0, TAU);
    }
    g.fill();
    g.restore();
  }

  function drawRef(lay, now) {
    const w = lay.L2 * 2 * 0.96;
    const hh = Math.min(H * 0.98, lay.L2 * 2 * 1.02);
    const x = lay.refX - w / 2;
    const y = H / 2 - hh / 2;
    g.save();
    g.globalAlpha = lay.show;
    if (selected === null) {
      g.setLineDash([7, 6]);
      g.strokeStyle = 'rgba(106, 90, 69, 0.7)';
      g.lineWidth = 2;
      roundRect(g, x + 1, y + 1, w - 2, hh - 2, 12);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(106, 90, 69, 0.75)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `900 ${Math.round(hh * 0.28)}px ${FONT}`;
      g.fillText('?', lay.refX, H / 2 - hh * 0.08);
      g.font = `800 13px ${FONT}`;
      g.fillText('카드를 골라 봐', lay.refX, y + hh - 16);
    } else {
      // 고른 카드가 아래에서 쑥 올라와 놓인다
      const pop = ease((now - selAt) / 220);
      g.translate(0, (1 - pop) * 26);
      g.globalAlpha = lay.show * pop;
      g.shadowColor = 'rgba(0, 0, 0, 0.22)';
      g.shadowBlur = 10;
      g.shadowOffsetY = 3;
      g.fillStyle = '#fffdf7';
      roundRect(g, x, y, w, hh, 12);
      g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = stage === 'done' ? '#3f9d6b' : '#e3b341';
      g.lineWidth = 3;
      g.stroke();
      const labelH = 22;
      const P = Math.min(lay.P, hh - labelH - 10);
      drawFingerprint(g, data.options[selected], lay.refX, y + (hh - labelH) / 2 + 2, P, { color: INK });
      g.fillStyle = '#2b2118';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `800 13px ${FONT}`;
      g.fillText(PRINT_TYPES[data.options[selected]], lay.refX, y + hh - labelH / 2 - 3);
    }
    g.restore();
  }

  function drawBrush(x, y) {
    g.save();
    g.translate(x, y);
    g.rotate(brushTilt);
    // 털 끝이 손가락 자리, 손잡이는 오른쪽 위로 뻗어 손가락에 가리지 않는다
    g.fillStyle = '#3b2e24';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-8, -6, -7, -22);
    g.lineTo(7, -22);
    g.quadraticCurveTo(8, -6, 0, 0);
    g.fill();
    g.fillStyle = '#c3c8ce';
    g.fillRect(-7.5, -32, 15, 11);
    g.fillStyle = '#b8532f';
    roundRect(g, -5, -78, 10, 47, 5);
    g.fill();
    g.restore();
  }

  function draw(now) {
    if (!W) return;
    if (maskDirty) uploadMask();
    const lay = layoutAt(tweenT(now));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawLid(lay.x, lay.y, lay.L);
    g.save();
    g.translate(lay.x, lay.y);
    g.beginPath();
    g.arc(0, 0, lay.L * 0.88, 0, TAU);
    g.clip();
    g.rotate(baseRot + userRot);
    const sz = SPAN * lay.P;
    g.imageSmoothingEnabled = true;
    g.drawImage(hazeCv, -sz / 2, -sz / 2, sz, sz);
    ensurePrint(lay.P);
    g.drawImage(printCv, -sz / 2, -sz / 2, sz, sz);
    drawSmudges(lay.P);
    g.restore();
    if (lay.show > 0) drawRef(lay, now);
    for (const p of puffs) {
      g.globalAlpha = Math.max(0, 1 - p.life / p.max);
      g.fillStyle = '#5d5a66';
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    if (brushAt && stage === 'brush') drawBrush(brushAt.x, brushAt.y);
    const cp = celebAt ? (now - celebAt) / CELEBRATE_MS : 2;
    if (cp < 1.5) {
      const glow = Math.max(0, Math.sin(cp * Math.PI * 2.5)) * Math.max(0, 1 - cp / 1.5);
      g.save();
      g.strokeStyle = `rgba(63, 157, 107, ${0.3 + 0.7 * glow})`;
      g.shadowColor = '#9be3b8';
      g.shadowBlur = 14;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(lay.x, lay.y, lay.L + 3, 0, TAU);
      g.stroke();
      g.restore();
    }
  }

  function step(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life >= p.max) {
        puffs.splice(i, 1);
        continue;
      }
      p.vy += 220 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (stage !== 'brush' && densFrom) {
      // 대조 단계로 넘어가면 남은 곳에도 가루가 내려앉아 지문이 또렷해진다
      const t = ease(tweenT(now));
      for (const k of ovalCells) dens[k] = Math.max(dens[k], lerp(densFrom[k], 1, t));
      maskDirty = true;
      if (t >= 1) densFrom = null;
    }
  }

  function busy(now) {
    return (
      puffs.length > 0 ||
      !!brushAt ||
      !!densFrom ||
      (stage !== 'brush' && tweenT(now) < 1) ||
      (selected !== null && now - selAt < 260) ||
      (celebAt && now - celebAt < CELEBRATE_MS * 1.5)
    );
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    step(now);
    draw(now);
    if (busy(now)) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !alive) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function screenPt(e) {
    const b = cv.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  function toLocal(p, lay) {
    const a = baseRot + userRot;
    const dx = p.x - lay.x;
    const dy = p.y - lay.y;
    return { u: (dx * Math.cos(a) + dy * Math.sin(a)) / lay.P, v: (-dx * Math.sin(a) + dy * Math.cos(a)) / lay.P };
  }

  function brushLine(a, b) {
    const lay = layoutAt(0);
    const la = toLocal(a, lay);
    const lb = toLocal(b, lay);
    const len = Math.hypot(lb.u - la.u, lb.v - la.v);
    const n = Math.max(1, Math.ceil(len / 0.03));
    for (let i = 1; i <= n; i++) dab(lerp(la.u, lb.u, i / n), lerp(la.v, lb.v, i / n), DAB);
    const now = performance.now();
    if (now - lastRub > 200) {
      lastRub = now;
      ctx.sfx('rub');
    }
    for (let i = 0; i < 2 && puffs.length < 60; i++) {
      puffs.push({
        x: b.x + (Math.random() - 0.5) * 14,
        y: b.y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        life: 0,
        max: 0.4 + Math.random() * 0.3,
        size: 0.8 + Math.random() * 1.6,
      });
    }
    const pr = progress();
    el.dataset.progress = pr.toFixed(2);
    fillBar.style.width = Math.min(100, (pr / NEED) * 100).toFixed(1) + '%';
    if (pr >= NEED) toCompare();
  }

  function onDown(e) {
    if (!alive || drag || !W || stage === 'done') return;
    const p = screenPt(e);
    if (stage === 'compare') {
      // 대조 단계에서는 왼쪽 뚜껑을 돌린다
      const lay = layoutAt(tweenT(performance.now()));
      if (Math.hypot(p.x - lay.x, p.y - lay.y) > lay.L * 1.15) return;
      drag = { id: e.pointerId, mode: 'turn', a: Math.atan2(p.y - lay.y, p.x - lay.x) };
    } else {
      drag = { id: e.pointerId, mode: 'brush', p };
      brushAt = p;
    }
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 이미 끝난 포인터 */
    }
    if (drag.mode === 'brush') {
      // 톡 찍기만 해도 가루가 조금 묻는다
      brushLine(p, p);
    }
    wake();
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = screenPt(e);
    if (drag.mode === 'turn') {
      if (stage !== 'compare') return;
      const lay = layoutAt(1);
      if (Math.hypot(p.x - lay.x, p.y - lay.y) < lay.L * 0.12) return;
      const a = Math.atan2(p.y - lay.y, p.x - lay.x);
      let d = a - drag.a;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      userRot += d;
      drag.a = a;
      if (Math.abs(d) > 0.001) rotBadge.hidden = true;
      wake();
      return;
    }
    if (stage !== 'brush') return;
    if (Math.hypot(p.x - drag.p.x, p.y - drag.p.y) < 2) return;
    // 붓이 움직이는 쪽으로 살짝 기운다
    brushTilt = 30 * DEG + Math.max(-12, Math.min(12, (p.x - drag.p.x) * 0.8)) * DEG;
    brushLine(drag.p, p);
    drag.p = p;
    brushAt = p;
    wake();
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    brushAt = null;
    wake();
  }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(() => {
    if (!alive) return;
    layout();
    wake();
  });
  ro.observe(wrap);
  layout();

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      dens.fill(1);
      densFrom = null;
      maskDirty = true;
      if (stage === 'brush') toCompare();
      densFrom = null;
      tweenAt = -1e9;
      selected = data.answer;
      selAt = -1e9;
      setStage('done');
      cards.forEach((c, j) => {
        c.classList.remove('is-on');
        c.disabled = j !== data.answer;
        if (j === data.answer) c.classList.add('is-right');
      });
      confirmBtn.disabled = true;
      rotBadge.hidden = true;
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 범인의 지문 모양이야';
      stamp.textContent = '같은 지문이야!';
      stamp.hidden = false;
      el.dataset.progress = '1.00';
      draw(performance.now());
      finish();
    },
  };
}
