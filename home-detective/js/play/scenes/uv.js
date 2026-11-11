// 증거 장면: 특수 조명 (uv)
// 불 꺼진 서랍장 앞면을 손가락으로 비추면 보랏빛 조명 원이 따라다니고,
// 그 안에서만 형광으로 빛나는 초코 손자국이 보인다. 손자국 위에 조명을 잠깐 머물면 "찾음".
// 손 모양이 아닌 빛나는 얼룩(가짜)이 섞여 있어서 눈으로 손 모양을 골라야 한다.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

// 그림은 늘 이 논리 좌표로 그린다. 화면 크기가 바뀌어도 자국 자리가 그대로다.
const LW = 300;
const LH = 380;
const LIGHT_R = 56; // 조명 반지름 (논리)
const FIND_R = 18; // 조명 중심이 자국 중심에서 이만큼 안이면 머문 것으로 본다
const DWELL = 0.4; // 초
// 손가락이 조명을 가리지 않게, 터치일 때는 조명을 손끝보다 조금 위에 띄운다 (CSS px)
const TOUCH_LIFT = 34;
const GLOW = 'rgba(214, 255, 110, 1)';
const GLOW_SHADOW = 'rgba(170, 255, 60, 0.95)';

const CSS = `
.sc-uv { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.sc-uv-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: none; }
.sc-uv-tip { font-weight: 800; font-size: clamp(13px, 4.1vw, 16px); line-height: 1.3; color: var(--ink); }
.sc-uv-count { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px;
  background: #2a1c40; color: #e9ffb0; font-weight: 900; font-size: 14px; white-space: nowrap;
  box-shadow: inset 0 0 0 2px #5b3d8c; }
.sc-uv-count b { font-size: 16px; }
.sc-uv-count.pop { animation: sc-uv-pop 0.35s ease; }
.sc-uv-count.all { background: #3b6b1f; box-shadow: inset 0 0 0 2px #a8e05a; color: #fff; }
.sc-uv-wrap { flex: none; position: relative; align-self: center; }
.sc-uv-canvas { display: block; border-radius: 12px; touch-action: none; background: #120f17;
  box-shadow: 0 4px 0 rgba(0,0,0,.25), 0 0 0 3px #3a2a2a inset; }
.sc-uv-hint { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 6px; color: #e6dcff; font-weight: 800; font-size: 15px;
  text-shadow: 0 2px 6px #000; transition: opacity .3s ease; white-space: nowrap; }
.sc-uv-hint i { font-style: normal; font-size: 38px; line-height: 1; display: block; animation: sc-uv-wave 1.6s ease-in-out infinite; }
.sc-uv-hint.gone { opacity: 0; }
@keyframes sc-uv-pop { 40% { transform: scale(1.18); } }
@keyframes sc-uv-wave { 0%,100% { transform: translate(-22px, 6px); } 50% { transform: translate(22px, -6px); } }
`;

export function mount(root, ctx) {
  ensureStyle('hd-scene-uv', CSS);
  const total = Math.max(1, Math.min(8, Math.round(Number(ctx.data && ctx.data.marks) || 3)));
  const lay = makeLayout(ctx.rng, total);

  const tip = h('p', { class: 'sc-uv-tip', text: '불빛으로 손자국을 찾아봐' });
  const count = h('span', { class: 'sc-uv-count', role: 'status' });
  const canvas = h('canvas', { class: 'sc-uv-canvas', role: 'img', 'aria-label': '불 꺼진 서랍장. 손가락을 대고 움직이면 보라색 불빛이 비춰.' });
  const hint = h('div', { class: 'sc-uv-hint' }, h('i', { text: '👆' }), h('span', { text: '대고 움직여 봐' }));
  const wrap = h('div', { class: 'sc-uv-wrap' }, canvas, hint);
  const head = h('div', { class: 'sc-uv-head' }, tip, count);
  const box = h('div', { class: 'sc-uv' }, head, wrap);
  root.append(box);

  const g = canvas.getContext('2d');
  const ac = new AbortController();
  const on = (el, type, fn, opt = {}) => el.addEventListener(type, fn, { ...opt, signal: ac.signal });
  const timers = new Set();
  const later = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      if (!dead) fn();
    }, ms);
    timers.add(id);
  };

  let dead = false;
  let finished = false; // done 을 이미 불렀다
  let allFound = false;
  let foundN = 0;
  const found = lay.marks.map(() => false);
  const foundAt = lay.marks.map(() => 0);
  const dwell = lay.marks.map(() => 0);
  const light = { on: false, x: 0, y: 0 };
  let activeId = null;
  let lift = 0;
  let flashAt = -1;

  // 크기에 맞춰 다시 만드는 그림들
  let cssW = 0;
  let cssH = 0;
  let scale = 1; // CSS px / 논리
  let pr = 1; // 장치 px / 논리
  let base = null; // 불 꺼진 모습
  let lit = null; // 조명 아래 모습 (자국이 다 보인다)
  let spot = null; // 조명 원 하나를 오려 내는 작업판
  let sprites = []; // 진짜 자국마다 빛나는 그림 (찾은 뒤 늘 보여 준다)

  function updateCount(pop) {
    count.replaceChildren('손자국 ', h('b', { text: String(foundN) }), ` / ${total}`);
    count.classList.toggle('all', foundN >= total);
    if (pop) {
      count.classList.remove('pop');
      void count.offsetWidth;
      count.classList.add('pop');
    }
  }
  updateCount(false);

  function resize() {
    // 머리줄을 뺀 나머지 높이에 맞춘다. 높이가 정해지지 않은 상자면 폭에 맞춘다.
    // 그림을 잠깐 빼고 잰다: 그림 크기가 상자 높이를 밀어 올려 잘못 재는 일을 막는다
    wrap.style.display = 'none';
    const boxH = box.clientHeight;
    wrap.style.display = '';
    const aw = box.clientWidth;
    let ah = boxH - head.offsetHeight - 10;
    if (ah < 120) ah = Math.round(aw * (LH / LW));
    const w = Math.max(120, Math.floor(Math.min(aw, ah * (LW / LH))));
    const hh = Math.round(w * (LH / LW));
    if (w === cssW && hh === cssH && base) return;
    cssW = w;
    cssH = hh;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = w / LW;
    pr = scale * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = hh + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    build();
  }

  function layer() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(pr, 0, 0, pr, 0, 0);
    return [c, x];
  }

  function build() {
    let x;
    [base, x] = layer();
    paintSurface(x, lay, false);
    [lit, x] = layer();
    paintSurface(x, lay, true);
    sprites = lay.marks.map((mk) => markSprite(mk, pr));
    const fakeSprites = lay.fakes.map((fk) => markSprite(fk, pr));
    x.setTransform(1, 0, 0, 1, 0, 0);
    [...sprites, ...fakeSprites].forEach((s) => x.drawImage(s.c, s.x, s.y));
    [spot] = layer();
  }

  // ---------------------------------------------------------- 손가락
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    light.x = (e.clientX - r.left) / scale;
    light.y = (e.clientY - r.top - lift) / scale;
  }

  function hideHint() {
    hint.classList.add('gone');
  }

  on(canvas, 'pointerdown', (e) => {
    if (finished || allFound) return;
    e.preventDefault();
    activeId = e.pointerId;
    lift = e.pointerType === 'touch' ? TOUCH_LIFT : 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 캡처를 못 해도 움직임은 받는다 */
    }
    toLogical(e);
    light.on = true;
    hideHint();
  });
  on(canvas, 'pointermove', (e) => {
    if (activeId === null) {
      // 마우스는 누르지 않아도 따라다니게 한다 (부모가 컴퓨터로 볼 때)
      if (e.pointerType !== 'mouse' || finished) return;
      lift = 0;
      toLogical(e);
      light.on = true;
      hideHint();
      return;
    }
    if (e.pointerId !== activeId) return;
    toLogical(e);
  });
  const release = (e) => {
    if (activeId !== null && e.pointerId !== activeId) return;
    activeId = null;
    light.on = false;
  };
  on(canvas, 'pointerup', release);
  on(canvas, 'pointercancel', release);
  on(canvas, 'pointerleave', (e) => {
    if (e.pointerType === 'mouse' && activeId === null) light.on = false;
  });
  on(canvas, 'contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------- 찾기
  function discover(i, t) {
    found[i] = true;
    foundAt[i] = t;
    foundN++;
    updateCount(true);
    ctx.sfx('reveal');
    ctx.buzz(30);
    if (foundN >= total) {
      allFound = true;
      flashAt = t;
      later(350, () => ctx.sfx('good'));
      later(1100, finish);
    }
  }

  function finish() {
    if (finished || dead) return;
    finished = true;
    ctx.done();
  }

  // ---------------------------------------------------------- 그리기
  let raf = 0;
  let lastT = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const t = ms / 1000;
    const dt = lastT ? Math.min(0.1, t - lastT) : 0;
    lastT = t;
    if (!base) return;

    if (light.on && !allFound) {
      lay.marks.forEach((mk, i) => {
        if (found[i]) return;
        if (Math.hypot(light.x - mk.x, light.y - mk.y) < FIND_R) {
          dwell[i] += dt;
          if (dwell[i] >= DWELL) discover(i, t);
        } else dwell[i] = Math.max(0, dwell[i] - dt * 2);
      });
    } else if (!light.on) dwell.fill(0);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(base, 0, 0);

    // 찾은 자국은 조명이 없어도 계속 빛난다
    sprites.forEach((s, i) => {
      if (!found[i]) return;
      g.globalAlpha = 0.82 + 0.18 * Math.sin((t - foundAt[i]) * 4);
      g.drawImage(s.c, s.x, s.y);
    });
    g.globalAlpha = 1;

    if (light.on) drawLight(t);

    g.setTransform(pr, 0, 0, pr, 0, 0);
    // 찾은 순간 퍼지는 고리
    lay.marks.forEach((mk, i) => {
      if (!found[i]) return;
      const k = (t - foundAt[i]) / 0.6;
      if (k > 1) return;
      g.strokeStyle = `rgba(230, 255, 150, ${1 - k})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(mk.x, mk.y, 22 + 26 * k, 0, Math.PI * 2);
      g.stroke();
    });
    // 진짜 자국 위에 머무는 동안 차오르는 고리 ("여기 가만히 있어" 하는 신호)
    lay.marks.forEach((mk, i) => {
      if (found[i] || dwell[i] <= 0) return;
      g.strokeStyle = 'rgba(240, 255, 170, 0.95)';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(mk.x, mk.y, 31, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * dwell[i]) / DWELL);
      g.stroke();
    });

    if (flashAt >= 0) {
      // 다 찾으면 서랍 전체가 한 번 환하게 빛난다
      const k = (t - flashAt) / 1.0;
      if (k < 1) {
        const a = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = Math.max(0, a);
        g.drawImage(lit, 0, 0);
        g.globalAlpha = Math.max(0, a) * 0.35;
        g.fillStyle = '#f4ecff';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.globalAlpha = 1;
      } else {
        // 빛이 지나간 뒤에도 서랍이 은은하게 보이게 남긴다
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 0.35;
        g.drawImage(lit, 0, 0);
        g.globalAlpha = 1;
      }
    }
  }

  function drawLight(t) {
    const R = LIGHT_R + Math.sin(t * 9) * 0.8; // 손전등처럼 아주 살짝 떨린다
    const px = light.x * pr;
    const py = light.y * pr;
    const pr2 = R * pr;
    const x0 = Math.max(0, Math.floor(px - pr2));
    const y0 = Math.max(0, Math.floor(py - pr2));
    const x1 = Math.min(canvas.width, Math.ceil(px + pr2));
    const y1 = Math.min(canvas.height, Math.ceil(py + pr2));
    if (x1 <= x0 || y1 <= y0) return;
    const w = x1 - x0;
    const hh = y1 - y0;
    const s = spot.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(x0, y0, w, hh);
    s.drawImage(lit, x0, y0, w, hh, x0, y0, w, hh);
    // 가장자리를 부드럽게: 원 모양 그러데이션으로 오려 낸다
    s.globalCompositeOperation = 'destination-in';
    const grad = s.createRadialGradient(px, py, 0, px, py, pr2);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.72, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = grad;
    s.fillRect(x0, y0, w, hh);
    s.globalCompositeOperation = 'source-over';
    g.drawImage(spot, x0, y0, w, hh, x0, y0, w, hh);
    // 보랏빛 테두리
    g.globalCompositeOperation = 'lighter';
    const ring = g.createRadialGradient(px, py, pr2 * 0.6, px, py, pr2 * 1.05);
    ring.addColorStop(0, 'rgba(120, 60, 255, 0)');
    ring.addColorStop(0.8, 'rgba(150, 90, 255, 0.28)');
    ring.addColorStop(1, 'rgba(120, 60, 255, 0)');
    g.fillStyle = ring;
    g.fillRect(x0, y0, w, hh);
    g.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------- 크기 감시
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => !dead && resize());
    ro.observe(box);
  } else on(window, 'resize', resize);
  resize();
  raf = requestAnimationFrame(frame);

  if (DEBUG) {
    // 검증용: 자국 자리를 화면 좌표로 알려 준다
    window.__hdUv = {
      lift: TOUCH_LIFT,
      targets: () => lay.marks.map((mk) => toClient(mk)),
      fakes: () => lay.fakes.map((fk) => toClient(fk)),
      found: () => found.slice(),
    };
  }
  function toClient(p) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + p.x * scale, y: r.top + p.y * scale };
  }

  return {
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      timers.clear();
      ac.abort();
      if (ro) ro.disconnect();
      box.remove();
      if (DEBUG && window.__hdUv) delete window.__hdUv;
    },
    solve() {
      if (dead || finished) return;
      lay.marks.forEach((_, i) => {
        if (!found[i]) {
          found[i] = true;
          foundAt[i] = performance.now() / 1000;
        }
      });
      foundN = total;
      allFound = true;
      if (flashAt < 0) flashAt = performance.now() / 1000;
      updateCount(false);
      hideHint();
      finish();
    },
  };
}

// ------------------------------------------------------------ 배치 (씨앗 난수로 한 번만)

function makeLayout(rng, total) {
  const fakeN = total >= 4 ? 3 : 2;
  // 3×4 칸에 하나씩 넣고 칸 안에서만 흔든다: 서로 겹치지 않고 가장자리에서 떨어진다
  const cols = 3;
  const rows = 4;
  const x0 = 50;
  const x1 = LW - 50;
  const y0 = 54;
  const y1 = LH - 50;
  const cw = (x1 - x0) / cols;
  const ch = (y1 - y0) / rows;
  const n = Math.min(cols * rows, total + fakeN);
  const cells = rng.shuffle([...Array(cols * rows).keys()]).slice(0, n);
  const spots = cells.map((c) => ({
    x: x0 + ((c % cols) + 0.5) * cw + (rng.int(13) - 6),
    y: y0 + (Math.floor(c / cols) + 0.5) * ch + (rng.int(13) - 6),
  }));
  const holes = () =>
    Array.from({ length: 30 }, () => ({ x: rng.int(53) - 26, y: rng.int(61) - 30, r: 0.5 + rng.int(12) / 10 }));
  const marks = spots.slice(0, total).map((p) => ({
    ...p,
    kind: 'hand',
    rot: ((rng.int(71) - 35) * Math.PI) / 180,
    flip: rng.bool() ? -1 : 1,
    size: 1 + rng.int(9) / 100,
    holes: holes(),
  }));
  const kinds = rng.shuffle(['blob', 'smear', 'drops']);
  const fakes = spots.slice(total).map((p, i) => ({
    ...p,
    kind: kinds[i % 3],
    rot: (rng.int(360) * Math.PI) / 180,
    flip: 1,
    size: 1,
    radii: Array.from({ length: 11 }, () => 0.7 + rng.int(60) / 100),
    drops: Array.from({ length: 5 }, () => ({ x: rng.int(37) - 18, y: rng.int(37) - 18, r: 3 + rng.int(6) })),
    holes: holes(),
  }));
  const grain = Array.from({ length: 30 }, () => ({
    y: rng.int(1000) / 1000,
    amp: 1 + rng.int(30) / 10,
    freq: 0.01 + rng.int(30) / 1000,
    ph: rng.int(628) / 100,
    a: 0.5 + rng.int(50) / 100,
  }));
  const specks = Array.from({ length: 70 }, () => ({ x: rng.int(LW), y: rng.int(LH), r: 0.4 + rng.int(10) / 10 }));
  return { marks, fakes, grain, specks };
}

// ------------------------------------------------------------ 그림

/** 서랍장 앞면. litUp 이면 보랏빛 조명 아래 모습 */
function paintSurface(x, lay, litUp) {
  const P = litUp
    ? { frame: '#2e1a52', frameHi: '#3d2468', drawer: '#3b2169', panel: '#6a45ad', grain: 'rgba(205,170,255,0.16)', handle: '#7a5fb8', handleHi: '#b9a0ee', screw: '#9c84d8' }
    : { frame: '#18141d', frameHi: '#211b28', drawer: '#221c2a', panel: '#352c40', grain: 'rgba(255,255,255,0.035)', handle: '#3a3345', handleHi: '#4c4459', screw: '#3a3345' };

  x.fillStyle = P.frame;
  x.fillRect(0, 0, LW, LH);
  // 위 가로대
  x.fillStyle = P.frameHi;
  x.fillRect(0, 0, LW, 26);
  x.fillRect(0, 26, LW, 2);

  const drawers = [
    { x: 14, y: 38, w: LW - 28, h: 160 },
    { x: 14, y: 208, w: LW - 28, h: 160 },
  ];
  drawers.forEach((d, di) => {
    x.fillStyle = P.drawer;
    rrect(x, d.x, d.y, d.w, d.h, 6);
    x.fill();
    // 나뭇결
    x.save();
    rrect(x, d.x, d.y, d.w, d.h, 6);
    x.clip();
    x.strokeStyle = P.grain;
    lay.grain.forEach((gr, i) => {
      if (i % 2 !== di) return;
      x.globalAlpha = gr.a;
      x.lineWidth = 1;
      x.beginPath();
      const yy = d.y + 6 + gr.y * (d.h - 12);
      for (let xx = d.x; xx <= d.x + d.w; xx += 6) {
        const yv = yy + Math.sin(xx * gr.freq + gr.ph) * gr.amp;
        if (xx === d.x) x.moveTo(xx, yv);
        else x.lineTo(xx, yv);
      }
      x.stroke();
    });
    x.restore();
    x.globalAlpha = 1;
    // 안쪽 판 테두리
    x.strokeStyle = P.panel;
    x.lineWidth = 2;
    rrect(x, d.x + 14, d.y + 14, d.w - 28, d.h - 28, 4);
    x.stroke();
    // 손잡이
    const hx = d.x + d.w / 2;
    const hy = d.y + 34;
    x.fillStyle = P.handle;
    rrect(x, hx - 38, hy - 7, 76, 14, 7);
    x.fill();
    x.fillStyle = P.handleHi;
    rrect(x, hx - 34, hy - 5, 68, 3, 1.5);
    x.fill();
    x.fillStyle = P.screw;
    [-46, 46].forEach((dx) => {
      x.beginPath();
      x.arc(hx + dx, hy, 3, 0, Math.PI * 2);
      x.fill();
    });
  });

  if (litUp) {
    // 조명 아래서만 빛나는 먼지 알갱이: 같은 색 자국 사이에서 진짜를 고르는 재미
    x.fillStyle = 'rgba(225, 210, 255, 0.55)';
    lay.specks.forEach((s) => {
      x.beginPath();
      x.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      x.fill();
    });
  }

  // 가장자리를 어둡게
  const v = x.createRadialGradient(LW / 2, LH / 2, LH * 0.3, LW / 2, LH / 2, LH * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, litUp ? 'rgba(10,0,30,0.45)' : 'rgba(0,0,0,0.55)');
  x.fillStyle = v;
  x.fillRect(0, 0, LW, LH);
}

/** 자국 하나(진짜 손바닥 또는 가짜 얼룩)를 빛나는 작은 그림으로 만든다 */
function markSprite(mk, pr) {
  const S = 84; // 논리
  const px = Math.ceil(S * pr);
  const shape = document.createElement('canvas');
  shape.width = px;
  shape.height = px;
  const x = shape.getContext('2d');
  x.setTransform(pr, 0, 0, pr, 0, 0);
  x.translate(S / 2, S / 2);
  x.rotate(mk.rot);
  x.scale(mk.flip * mk.size, mk.size);
  x.fillStyle = GLOW;
  if (mk.kind === 'hand') handPath(x);
  else if (mk.kind === 'blob') blobPath(x, mk.radii, 16);
  else if (mk.kind === 'smear') smearPath(x, mk.radii);
  else dropsPath(x, mk.drops);
  // 찍힌 자국처럼 군데군데 비게
  x.globalCompositeOperation = 'destination-out';
  mk.holes.forEach((hl) => {
    x.beginPath();
    x.arc(hl.x, hl.y, hl.r, 0, Math.PI * 2);
    x.fill();
  });
  if (mk.kind === 'hand') {
    // 손금
    x.strokeStyle = '#000';
    x.lineWidth = 1.2;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-9, 3);
    x.quadraticCurveTo(0, 7, 10, 1);
    x.moveTo(-10, 9);
    x.quadraticCurveTo(-1, 12, 7, 10);
    x.moveTo(-5, 18);
    x.quadraticCurveTo(-6, 10, -2, 4);
    x.stroke();
  }
  x.globalCompositeOperation = 'source-over';

  const out = document.createElement('canvas');
  out.width = px;
  out.height = px;
  const o = out.getContext('2d');
  o.shadowColor = GLOW_SHADOW;
  o.shadowBlur = 9 * pr;
  o.drawImage(shape, 0, 0);
  o.shadowBlur = 0;
  o.globalAlpha = 0.9;
  o.drawImage(shape, 0, 0);
  return { c: out, x: Math.round((mk.x - S / 2) * pr), y: Math.round((mk.y - S / 2) * pr) };
}

/** 손바닥 + 손가락 넷 + 엄지. 원점이 손바닥 가운데쯤, 손가락이 위로 */
function handPath(x) {
  x.beginPath();
  x.ellipse(0, 8, 13.5, 14.5, 0, 0, Math.PI * 2);
  x.fill();
  const fingers = [
    { x: -9.6, len: 15, ang: -0.2 },
    { x: -3.3, len: 18.5, ang: -0.06 },
    { x: 3.3, len: 17.5, ang: 0.06 },
    { x: 9.6, len: 13.5, ang: 0.2 },
  ];
  fingers.forEach((f) => capsule(x, f.x, -2, f.ang, f.len, 2.9));
  capsule(x, -11, 10, -0.95, 15, 3.4);
}

function capsule(x, bx, by, ang, len, r) {
  x.save();
  x.translate(bx, by);
  x.rotate(ang);
  x.beginPath();
  x.moveTo(-r, 0);
  x.lineTo(-r, -len);
  x.arc(0, -len, r, Math.PI, 0);
  x.lineTo(r, 0);
  x.arc(0, 0, r, 0, Math.PI);
  x.closePath();
  x.fill();
  x.restore();
}

function blobPath(x, radii, R) {
  x.beginPath();
  const n = radii.length;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = R * radii[i % n];
    const nx = Math.cos(a) * r;
    const ny = Math.sin(a) * r;
    if (i === 0) x.moveTo(nx, ny);
    else {
      const pa = ((i - 0.5) / n) * Math.PI * 2;
      const pr = R * (radii[(i - 1) % n] + radii[i % n]) * 0.55;
      x.quadraticCurveTo(Math.cos(pa) * pr, Math.sin(pa) * pr, nx, ny);
    }
  }
  x.closePath();
  x.fill();
}

function smearPath(x, radii) {
  // 문질러 번진 줄: 한쪽은 굵고 다른 쪽은 가늘게
  x.beginPath();
  x.moveTo(-24, -4);
  x.quadraticCurveTo(-4, -9 * radii[0], 22, -3);
  x.quadraticCurveTo(26, 0, 22, 3);
  x.quadraticCurveTo(-4, 8 * radii[1], -24, 5);
  x.quadraticCurveTo(-28, 0, -24, -4);
  x.fill();
  x.beginPath();
  x.arc(-20, 0, 7 * radii[2], 0, Math.PI * 2);
  x.fill();
}

function dropsPath(x, drops) {
  drops.forEach((d) => {
    x.beginPath();
    x.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    x.fill();
  });
}

function rrect(x, rx, ry, w, hh, r) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + hh, r);
  x.arcTo(rx + w, ry + hh, rx, ry + hh, r);
  x.arcTo(rx, ry + hh, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
}
