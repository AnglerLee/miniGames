// 수리 놀이: 밸브 돌리기.
// 가운데 큰 밸브 바퀴를 손가락으로 원을 그리듯 돌린다. 바퀴 가운데를 두고 손가락이 지난 각도를 쌓아 바퀴 수를 센다.
// 바퀴 뒤로 배관이 지나가서, 밸브가 열릴수록 오른쪽 관으로 물이 흐른다.
// 규격은 index.js 참고.
import { h, ensureStyle } from '../../shared/dom.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const TOP = -Math.PI / 2;
const TURNS = [2, 3, 4];
const DEAD = 0.25; // 가운데 근처는 손가락이 조금만 움직여도 각도가 크게 튀므로 무시한다 (바퀴 반지름 기준)
const MAX_STEP = 1.6; // 한 번에 이보다 크게(라디안) 돌면 손가락이 가운데를 가로질렀다고 보고 버린다
const CELEBRATE_MS = 420;
const GREEN = '#7bed9f';
const AMBER = '#ffb703';

const CSS = `
.tk-valve { --tk-c: #4cc9f0; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 6px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.tk-valve-line { flex: none; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 42px; font-size: 26px; font-weight: 900; line-height: 1.1; color: var(--text); white-space: nowrap; }
.tk-valve-line b { font-size: 34px; line-height: 1; color: var(--tk-c); text-shadow: 0 0 12px var(--tk-c); }
.tk-valve-line.is-flip { color: var(--amber); animation: tk-valve-pop 0.35s ease; }
.tk-valve-line.is-flip b { color: var(--amber); text-shadow: 0 0 12px var(--amber); }
.tk-valve-line.is-done, .tk-valve-line.is-done b { color: var(--green); text-shadow: 0 0 12px var(--green); }
.tk-valve-wrap { position: relative; flex: 1 1 0; min-height: 0; }
.tk-valve-wrap canvas { position: absolute; left: 0; top: 0; touch-action: none; }
@keyframes tk-valve-pop { from { transform: scale(1.4); } }
`;

function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 미리 그려 두는 그림판. 좌표는 CSS px 로 쓰고 픽셀은 dpr 배로 잡는다. */
function sprite(w, hh, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(hh * dpr));
  const o = c.getContext('2d');
  o.scale(dpr, dpr);
  return [c, o];
}

function rivet(o, x, y, r) {
  o.fillStyle = 'rgba(0, 0, 0, 0.35)';
  o.beginPath();
  o.arc(x + 1, y + 1.5, r, 0, TAU);
  o.fill();
  const grad = o.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, '#dbe8ef');
  grad.addColorStop(0.5, '#7d97a7');
  grad.addColorStop(1, '#2b4556');
  o.fillStyle = grad;
  o.beginPath();
  o.arc(x, y, r, 0, TAU);
  o.fill();
}

/** 리벳 박힌 강철 판 */
function plate(o, w, hh) {
  const r = Math.min(16, w * 0.05);
  roundRect(o, 1, 1, w - 2, hh - 2, r);
  const grad = o.createLinearGradient(0, 0, 0, hh);
  grad.addColorStop(0, '#25485e');
  grad.addColorStop(1, '#11293a');
  o.fillStyle = grad;
  o.fill();
  o.lineWidth = 2;
  o.strokeStyle = '#2f6789';
  o.stroke();
  roundRect(o, 6, 6, w - 12, hh - 12, Math.max(2, r - 5));
  o.lineWidth = 1;
  o.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  o.stroke();
  for (const [x, y] of [[13, 13], [w - 13, 13], [13, hh - 13], [w - 13, hh - 13]]) rivet(o, x, y, 4.5);
}

export function mount(root, ctx) {
  ensureStyle('hs-task-valve', CSS);
  const level = Math.max(0, Math.min(2, Math.round(Number(ctx.data && ctx.data.level) || 0)));
  const rng = ctx.rng;
  const color = ctx.color || '#4cc9f0';
  const turns = TURNS[level];
  // 어려움은 절반을 돌면 방향이 바뀐다
  const flipAt = level === 2 ? turns / 2 : Infinity;
  const startDir = rng.bool() ? 1 : -1; // 1 = 시계 방향 (화면 y 가 아래로 커지므로 각도가 커지는 쪽)
  const spokes = 4 + rng.int(3);

  let alive = true;
  let finished = false;
  let complete = false;
  let progress = 0; // 돌린 바퀴 수
  let flipped = false;
  let bestQuarter = 0;
  let wheelAngle = rng.int(360) * DEG;
  let wiggle = 0;
  let flow = 0; // 화면에 보이는 열림 정도. 실제 진행을 부드럽게 따라간다
  let flowOffset = 0;
  let turningAt = -1e9;
  let resistAt = -1e9;
  let flipFxAt = -1e9;
  let doneAt = 0;
  let bubbles = [];
  let drag = null;
  let raf = 0;
  let lastNow = performance.now();
  const timers = new Set();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let bgCv = null;
  let wheelCv = null;

  const arrowEl = h('b', { 'aria-hidden': 'true' });
  const wordEl = h('span');
  const line = h('p', { class: 'tk-valve-line' }, arrowEl, wordEl);
  const cv = h('canvas', { role: 'img', 'aria-label': '밸브 바퀴' });
  const wrap = h('div', { class: 'tk-valve-wrap' }, cv);
  const el = h('div', { class: 'tk-valve', style: { '--tk-c': color } }, line, wrap);
  root.append(el);
  const g = cv.getContext('2d');

  const dir = () => (flipped ? -startDir : startDir);

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

  function sync() {
    arrowEl.textContent = dir() > 0 ? '↻' : '↺';
    if (complete) {
      arrowEl.textContent = '✓';
      wordEl.textContent = '열렸어!';
    } else {
      wordEl.textContent = flipped ? '반대로!' : '돌려!';
    }
    el.dataset.turns = String(turns);
    el.dataset.progress = progress.toFixed(3);
    el.dataset.dir = String(dir());
    el.dataset.flipped = flipped ? '1' : '0';
    el.dataset.complete = complete ? '1' : '0';
  }

  function flip(now) {
    flipped = true;
    flipFxAt = now;
    // 방향이 바뀐 순간이 화살표가 가장 잘 보여야 할 때다
    turningAt = -1e9;
    line.classList.remove('is-flip');
    void line.offsetWidth;
    line.classList.add('is-flip');
    ctx.sfx('beep');
    ctx.buzz([30, 50, 30]);
  }

  function completeNow(now) {
    if (complete) return;
    complete = true;
    doneAt = now;
    drag = null;
    line.classList.remove('is-flip');
    line.classList.add('is-done');
    // 막혀 있던 물이 한꺼번에 밀려 나가는 거품
    bubbles = [];
    for (let i = 0; i < 16; i++) {
      bubbles.push({ x: cx - R * (0.2 + Math.random() * 0.9), y: (Math.random() - 0.5) * 0.7, r: 0.025 + Math.random() * 0.035, v: 1.6 + Math.random() * 1.8 });
    }
    ctx.sfx('water');
    ctx.buzz([20, 30, 60]);
    later(140, () => ctx.sfx('fixed'));
    later(CELEBRATE_MS, finish);
  }

  /** 손가락이 돈 각도(라디안, 시계 방향이 +)를 바퀴에 준다 */
  function turnBy(delta) {
    if (complete) return;
    const now = performance.now();
    const d = dir();
    const want = (delta / TAU) * d;
    const lo = flipped ? flipAt : 0;
    const hi = flipped ? turns : Math.min(turns, flipAt);
    let next = Math.max(lo, Math.min(hi, progress + want));
    // 각도를 더하다 생긴 아주 작은 오차로 끝을 코앞에 두고 멈추지 않게 붙인다
    if (hi - next < 1e-6) next = hi;
    const used = next - progress;
    progress = next;
    // 바퀴는 실제로 돌아간 만큼만 돈다. 끝(막힌 쪽)에서는 꿈쩍 않고 떨기만 한다
    wheelAngle += used * TAU * d;
    if (want > 0 && used > 0) turningAt = now;
    if (want < 0 && used > want + 1e-9) {
      // 막힌 쪽으로 돌리고 있다: 화살표를 다시 또렷하게 보여 준다
      turningAt = -1e9;
      if (now - resistAt > 250) {
        resistAt = now;
        wiggle = 0.05;
      }
    }
    const q = Math.floor(progress * 4 + 1e-6);
    const crossed = q > bestQuarter;
    if (crossed) bestQuarter = q;
    if (!flipped && progress >= flipAt) {
      progress = flipAt;
      flip(now);
    } else if (progress >= turns) {
      progress = turns;
      completeNow(now);
    } else if (crossed) {
      ctx.sfx('turn');
      ctx.buzz(12);
    }
    sync();
  }

  // ---- 크기 ----

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
    cx = W / 2;
    cy = H / 2;
    R = Math.max(30, Math.min(W * 0.41, H * 0.41, 190));
    cv.dataset.cx = cx.toFixed(1);
    cv.dataset.cy = cy.toFixed(1);
    cv.dataset.r = R.toFixed(1);
    bgCv = renderBg();
    wheelCv = renderWheel();
  }

  function renderBg() {
    const [c, o] = sprite(W, H, dpr);
    plate(o, W, H);
    // 바퀴 뒤로 지나가는 굵은 배관
    const pt = R * 0.42;
    const y0 = cy - pt / 2;
    o.fillStyle = '#061520';
    o.fillRect(0, y0 - 3, W, pt + 6);
    const grad = o.createLinearGradient(0, y0, 0, y0 + pt);
    grad.addColorStop(0, '#b3c8d3');
    grad.addColorStop(0.4, '#6f8999');
    grad.addColorStop(1, '#273f4e');
    o.fillStyle = grad;
    o.fillRect(0, y0, W, pt);
    // 안이 보이는 유리 띠 (물이 여기로 흐른다)
    const ct = R * 0.22;
    o.fillStyle = '#03101a';
    o.fillRect(0, cy - ct / 2 - 2, W, ct + 4);
    // 이음새 (자리가 있을 때만)
    for (const fx of [cx - R * 1.3, cx + R * 1.3]) {
      if (fx < 14 || fx > W - 14) continue;
      const fw = R * 0.13;
      const fh = pt * 1.4;
      o.fillStyle = '#061520';
      roundRect(o, fx - fw / 2 - 2, cy - fh / 2 - 2, fw + 4, fh + 4, 4);
      o.fill();
      const fg = o.createLinearGradient(fx - fw / 2, 0, fx + fw / 2, 0);
      fg.addColorStop(0, '#9db4c1');
      fg.addColorStop(1, '#3d5666');
      o.fillStyle = fg;
      roundRect(o, fx - fw / 2, cy - fh / 2, fw, fh, 3);
      o.fill();
      rivet(o, fx, cy - fh * 0.36, Math.max(2.5, R * 0.03));
      rivet(o, fx, cy + fh * 0.36, Math.max(2.5, R * 0.03));
    }
    return c;
  }

  /** 밸브 바퀴 (테, 살, 가운데 너트, 구역 색 손잡이). 돌릴 때는 이 그림을 통째로 돌린다. */
  function renderWheel() {
    const ext = R * 1.12;
    const [c, o] = sprite(ext * 2, ext * 2, dpr);
    o.translate(ext, ext);
    const sw = R * 0.13;
    for (let i = 0; i < spokes; i++) {
      o.save();
      o.rotate((i / spokes) * TAU + TOP);
      o.fillStyle = '#071722';
      o.fillRect(R * 0.1, -sw / 2 - 2, R * 0.78, sw + 4);
      const sg = o.createLinearGradient(0, -sw / 2, 0, sw / 2);
      sg.addColorStop(0, '#c3d4dd');
      sg.addColorStop(0.5, '#7d97a7');
      sg.addColorStop(1, '#344d5d');
      o.fillStyle = sg;
      o.fillRect(R * 0.1, -sw / 2, R * 0.78, sw);
      o.restore();
    }
    // 테
    const rr = R * 0.9;
    const rw = R * 0.18;
    o.lineWidth = rw + 5;
    o.strokeStyle = '#071722';
    o.beginPath();
    o.arc(0, 0, rr, 0, TAU);
    o.stroke();
    const rg = o.createLinearGradient(-R, -R, R, R);
    rg.addColorStop(0, '#d5e3ea');
    rg.addColorStop(0.5, '#7690a0');
    rg.addColorStop(1, '#2c4453');
    o.lineWidth = rw;
    o.strokeStyle = rg;
    o.beginPath();
    o.arc(0, 0, rr, 0, TAU);
    o.stroke();
    // 손으로 쥐는 홈. 돌 때 바퀴가 움직이는 게 잘 보인다
    o.strokeStyle = 'rgba(6, 20, 30, 0.5)';
    o.lineWidth = Math.max(1.5, R * 0.022);
    o.beginPath();
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      o.moveTo(Math.cos(a) * (rr - rw * 0.42), Math.sin(a) * (rr - rw * 0.42));
      o.lineTo(Math.cos(a) * (rr + rw * 0.42), Math.sin(a) * (rr + rw * 0.42));
    }
    o.stroke();
    // 손잡이 (구역 색)
    const kr = R * 0.14;
    o.fillStyle = '#071722';
    o.beginPath();
    o.arc(0, -rr, kr + 3, 0, TAU);
    o.fill();
    const kg = o.createRadialGradient(-kr * 0.35, -rr - kr * 0.35, kr * 0.1, 0, -rr, kr);
    kg.addColorStop(0, '#ffffff');
    kg.addColorStop(0.35, color);
    kg.addColorStop(1, shade(color, 0.45));
    o.fillStyle = kg;
    o.beginPath();
    o.arc(0, -rr, kr, 0, TAU);
    o.fill();
    // 가운데 너트
    const hr = R * 0.27;
    o.fillStyle = '#071722';
    o.beginPath();
    o.arc(0, 0, hr + 3, 0, TAU);
    o.fill();
    const hg = o.createLinearGradient(-hr, -hr, hr, hr);
    hg.addColorStop(0, '#c9d8e0');
    hg.addColorStop(1, '#3a5464');
    o.fillStyle = hg;
    o.beginPath();
    o.arc(0, 0, hr, 0, TAU);
    o.fill();
    const nr = R * 0.15;
    o.fillStyle = '#2e4858';
    o.strokeStyle = '#0b1f2b';
    o.lineWidth = 2;
    o.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      o.lineTo(Math.cos(a) * nr, Math.sin(a) * nr);
    }
    o.closePath();
    o.fill();
    o.stroke();
    o.fillStyle = '#9fb5c2';
    o.beginPath();
    o.arc(0, 0, R * 0.05, 0, TAU);
    o.fill();
    return c;
  }

  // ---- 그리기 ----

  function drawWater(dt) {
    const ct = R * 0.22;
    const y0 = cy - ct / 2;
    g.fillStyle = color;
    // 밸브 앞쪽(왼쪽)은 늘 물이 차서 밀고 있다. 뒤쪽(오른쪽)은 열린 만큼 찬다
    g.globalAlpha = 0.8;
    g.fillRect(0, y0, cx, ct);
    g.globalAlpha = 0.06 + 0.84 * flow;
    g.fillRect(cx, y0, W - cx, ct);
    // 흐르는 물결. 잠겨 있으면 멈춰 있고 열릴수록 빨라진다
    const gap = Math.max(22, R * 0.34);
    const len = gap * 0.45;
    const off = flowOffset % gap;
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, ct * 0.2);
    g.strokeStyle = '#ffffff';
    for (let x = -gap + off; x < W + gap; x += gap) {
      g.globalAlpha = x + len < cx ? 0.35 : 0.6 * flow;
      g.beginPath();
      g.moveTo(x, y0 + ct * 0.32);
      g.lineTo(x + len, y0 + ct * 0.32);
      g.stroke();
    }
    g.globalAlpha = 1;
    if (bubbles.length) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      g.lineWidth = 1.5;
      for (const b of bubbles) {
        b.x += b.v * R * dt;
        g.beginPath();
        g.arc(b.x, cy + b.y * ct, Math.max(1.5, b.r * R), 0, TAU);
        g.stroke();
      }
      bubbles = bubbles.filter((b) => b.x < W + 10);
    }
  }

  /** 둘레의 진행 고리. 돌리는 방향으로 맨 위에서부터 차오른다. */
  function drawRing(now) {
    const rr = R * 1.13;
    const rw = Math.max(7, R * 0.1);
    g.lineCap = 'butt';
    g.lineWidth = rw + 5;
    g.strokeStyle = '#061520';
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.stroke();
    g.lineWidth = rw;
    g.strokeStyle = '#1b3a4d';
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.stroke();
    const fill = complete ? GREEN : color;
    g.save();
    g.strokeStyle = fill;
    g.shadowColor = fill;
    g.shadowBlur = complete ? 18 : 10;
    g.lineWidth = rw;
    // 고리 전체가 필요한 바퀴 수만큼이다. 방향이 바뀌는 판은 반대쪽 반원을 반대 방향으로 채운다
    const segs = flipped || flipAt < Infinity ? [[startDir, Math.min(progress, flipAt)], [-startDir, Math.max(0, progress - flipAt)]] : [[startDir, progress]];
    for (const [d, amount] of segs) {
      if (amount <= 0) continue;
      const span = (amount / turns) * TAU;
      g.beginPath();
      g.arc(cx, cy, rr, TOP, TOP + d * span, d < 0);
      g.stroke();
    }
    g.restore();
    // 바퀴 하나마다 눈금
    g.strokeStyle = '#061520';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = 0; k < turns; k++) {
      const a = TOP + (k / turns) * TAU;
      g.moveTo(cx + Math.cos(a) * (rr - rw * 0.6), cy + Math.sin(a) * (rr - rw * 0.6));
      g.lineTo(cx + Math.cos(a) * (rr + rw * 0.6), cy + Math.sin(a) * (rr + rw * 0.6));
    }
    g.stroke();
    if (complete) {
      const p = (now - doneAt) / 520;
      if (p < 1) {
        g.strokeStyle = GREEN;
        g.globalAlpha = 1 - p;
        g.lineWidth = rw * (1 - p) + 2;
        g.beginPath();
        g.arc(cx, cy, rr * (1 + 0.16 * p), 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  function drawWheel(now) {
    const ext = R * 1.12;
    // 그림자
    g.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    g.lineWidth = R * 0.2;
    g.beginPath();
    g.arc(cx + R * 0.03, cy + R * 0.07, R * 0.9, 0, TAU);
    g.stroke();
    const shakeA = wiggle * Math.sin(now / 22);
    g.save();
    g.translate(cx, cy);
    g.rotate(wheelAngle + shakeA);
    g.drawImage(wheelCv, -ext, -ext, ext * 2, ext * 2);
    g.restore();
    // 빛은 돌지 않는다 (왼쪽 위에서 비친다)
    g.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    g.lineWidth = R * 0.05;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, R * 0.93, 200 * DEG, 260 * DEG);
    g.stroke();
    if (complete) {
      const p = Math.min(1, (now - doneAt) / 300);
      g.fillStyle = GREEN;
      g.globalAlpha = 0.6 * (1 - p) + 0.25;
      g.beginPath();
      g.arc(cx, cy, R * 0.15, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  /** 돌릴 방향을 보여 주는 굽은 화살표 두 개. 화면에 고정되어 있고, 꼬리에서 머리로 빛이 지나간다. */
  function drawArrows(now) {
    let alpha = 0.95;
    if (complete) alpha = Math.max(0, 0.95 - (now - doneAt) / 180);
    else if (now - turningAt < 450) alpha = 0.32; // 잘 돌리는 동안에는 바퀴가 잘 보이게 흐리게
    if (alpha <= 0.01) return;
    const d = dir();
    const pop = 1 + 0.3 * Math.max(0, 1 - (now - flipFxAt) / 380) + 0.1 * Math.max(0, 1 - (now - resistAt) / 300);
    const tint = flipped ? AMBER : '#ffffff';
    const ra = R * 0.6;
    const tw = Math.max(9, R * 0.14);
    const span = 92 * DEG;
    const hl = (tw * 1.7) / ra;
    g.save();
    g.translate(cx, cy);
    g.scale(pop, pop);
    g.globalAlpha = alpha;
    g.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const mid = TOP + 45 * DEG + k * Math.PI;
      const a0 = mid - (d * span) / 2;
      const a1 = mid + (d * span) / 2;
      const body = a1 - d * hl * 0.5;
      const tip = a1 + d * hl * 0.5;
      const head = () => {
        g.beginPath();
        g.moveTo(Math.cos(tip) * ra, Math.sin(tip) * ra);
        g.lineTo(Math.cos(body) * (ra + tw * 1.1), Math.sin(body) * (ra + tw * 1.1));
        g.lineTo(Math.cos(body) * (ra - tw * 1.1), Math.sin(body) * (ra - tw * 1.1));
        g.closePath();
      };
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(4, 18, 29, 0.75)';
      g.lineWidth = tw + 7;
      g.beginPath();
      g.arc(0, 0, ra, a0, body + d * 0.02, d < 0);
      g.stroke();
      head();
      g.lineWidth = 7;
      g.stroke();
      g.strokeStyle = tint;
      g.fillStyle = tint;
      g.lineWidth = tw;
      g.beginPath();
      g.arc(0, 0, ra, a0, body + d * 0.02, d < 0);
      g.stroke();
      head();
      g.fill();
      // 꼬리에서 머리로 흐르는 빛
      const t = (now % 900) / 900;
      const s0 = a0 + d * span * Math.max(0, t - 0.18);
      const s1 = a0 + d * span * Math.min(0.92, t);
      if (d * (s1 - s0) > 0.01) {
        g.strokeStyle = flipped ? '#fff3c4' : color;
        g.lineWidth = tw * 0.45;
        g.beginPath();
        g.arc(0, 0, ra, s0, s1, d < 0);
        g.stroke();
      }
    }
    g.restore();
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    const open = complete ? 1 : progress / turns;
    flow += (open - flow) * (1 - Math.exp(-dt * 8));
    flowOffset += dt * (complete ? R * 4 : R * 2.4 * flow);
    wiggle *= Math.exp(-dt * 9);
    if (W && wheelCv) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.drawImage(bgCv, 0, 0, W, H);
      drawWater(dt);
      drawRing(now);
      drawWheel(now);
      drawArrows(now);
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function polar(e) {
    const b = cv.getBoundingClientRect();
    const x = e.clientX - b.left - cx;
    const y = e.clientY - b.top - cy;
    return { a: Math.atan2(y, x), r: Math.hypot(x, y) / R };
  }

  function onDown(e) {
    if (!alive || complete || drag || !R) return;
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 이미 끝난 포인터 */
    }
    const p = polar(e);
    drag = { id: e.pointerId, last: p.r < DEAD ? null : p.a };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = polar(e);
    if (p.r < DEAD) {
      drag.last = null;
      return;
    }
    if (drag.last === null) {
      drag.last = p.a;
      return;
    }
    let d = p.a - drag.last;
    if (d > Math.PI) d -= TAU;
    else if (d < -Math.PI) d += TAU;
    drag.last = p.a;
    if (Math.abs(d) > MAX_STEP) return;
    turnBy(d);
  }

  function onUp(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(() => {
    if (alive) layout();
  });
  ro.observe(wrap);
  sync();
  layout();
  raf = requestAnimationFrame(frame);

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
      if (!complete) {
        const now = performance.now();
        if (flipAt < Infinity) flipped = true;
        wheelAngle += (turns - progress) * TAU * startDir;
        progress = turns;
        completeNow(now);
        sync();
      }
      finish();
    },
  };
}

/** #rrggbb 를 k 배 어둡게 */
function shade(hex, k) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const r = Math.round(((n >> 16) & 255) * k);
  const gg = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${gg}, ${b})`;
}
