// 증거 장면: 멈춘 시계.
// 떨어져 깨진 시계 위에 유리 조각이 덮여 있다. 손가락으로 조각을 쓸어 내면 바늘이 드러나고,
// 짧은 바늘(시침)을 읽어 멈춘 시각을 고른다. mirrored 면 거울에 비친 모습이라 좌우를 뒤집어 읽어야 한다.
// 규격은 index.js 참고.
import { h, ensureStyle } from '../../shared/dom.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";
const FINGER = 0.09; // 손가락 굵기 (시계 반지름 기준). 조각을 살짝 스쳐도 걸리게 넉넉히 잡는다
const FLY_SEC = 0.55;
const CELEBRATE_MS = 700;

const CSS = `
.sc-clock { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 10px; color: var(--ink); user-select: none; -webkit-user-select: none; }
.sc-clock-line { flex: none; text-align: center; font-size: 17px; font-weight: 800; line-height: 1.35; }
.sc-clock-line.is-hint { color: var(--red-deep); }
.sc-clock-wrap { position: relative; flex: 1 1 0; min-height: 150px; }
.sc-clock-board { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.sc-clock-board canvas { position: absolute; left: 0; top: 0; touch-action: none; }
.sc-clock-opts { flex: none; display: flex; gap: 8px; }
.sc-clock-opts .btn { flex: 1 1 0; min-width: 0; min-height: 54px; padding: 8px 4px; font-size: 17px; white-space: nowrap; }
.sc-clock-opts .btn.is-wrong { text-decoration: line-through; text-decoration-thickness: 3px; text-decoration-color: var(--red); }
.sc-clock-opts .btn.is-right { background: var(--green); color: #fff; pointer-events: none; }
.sc-clock-stamp { position: absolute; left: 50%; top: 74%; transform: translate(-50%, -50%) rotate(-6deg); padding: 6px 14px; border: 3px solid var(--green); border-radius: 10px; background: rgba(246, 236, 214, 0.95); color: var(--green); font-size: 22px; font-weight: 900; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); animation: sc-clock-pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
.sc-clock-stamp[hidden] { display: none; }
@keyframes sc-clock-pop { from { opacity: 0; transform: translate(-50%, -50%) rotate(-6deg) scale(1.7); } }
`;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + hh, r);
  g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 유리 금: 부딪힌 점에서 뻗는 줄기 몇 개와 그 사이를 잇는 고리 조각. 단위는 시계 반지름. */
function makeCrack(rng) {
  // 바늘이 가리키는 쪽(오른쪽 위, 거울이면 왼쪽 위)을 피해 아래쪽에서 깨진다
  const a = (200 + rng.int(36)) * DEG;
  const d = 0.45 + rng.int(15) / 100;
  const ix = Math.sin(a) * d;
  const iy = -Math.cos(a) * d;
  const rays = [];
  const n = 7;
  for (let k = 0; k < n; k++) {
    const base = (k / n) * TAU + rng.int(30) * DEG;
    const len = 0.25 + rng.int(55) / 100;
    const segs = 3 + rng.int(3);
    const pts = [[ix, iy]];
    let x = ix;
    let y = iy;
    for (let s = 0; s < segs; s++) {
      const aa = base + (rng.int(41) - 20) * DEG;
      x += (Math.cos(aa) * len) / segs;
      y += (Math.sin(aa) * len) / segs;
      pts.push([x, y]);
    }
    rays.push(pts);
  }
  const rings = [];
  for (const rr of [0.1, 0.22]) {
    for (let k = 0; k < n; k++) {
      if (rng.int(3) === 0) continue;
      const a0 = (k / n) * TAU + rng.int(20) * DEG;
      const a1 = a0 + (TAU / n) * (0.6 + rng.int(40) / 100);
      rings.push([
        [ix + Math.cos(a0) * rr, iy + Math.sin(a0) * rr],
        [ix + Math.cos((a0 + a1) / 2) * rr * 1.08, iy + Math.sin((a0 + a1) / 2) * rr * 1.08],
        [ix + Math.cos(a1) * rr, iy + Math.sin(a1) * rr],
      ]);
    }
  }
  return { ix, iy, rays, rings };
}

/**
 * 유리 조각: 바늘 위에 넷, 반대쪽에 둘. 반대쪽에도 두어야 조각 자리만 보고 시각을 짐작하지 못한다.
 * 좌표는 화면에 보이는 대로(거울이면 뒤집힌 쪽), 단위는 시계 반지름.
 */
function makeShards(rng, shownHour) {
  const opp = shownHour + Math.PI;
  const spots = [
    [shownHour, 0.46],
    [shownHour, 0.2],
    [0, 0],
    [0, 0.5],
    [opp + 0.9, 0.5],
    [opp - 0.9, 0.45],
  ];
  return spots.map(([a, d], i) => {
    // 시침 위의 두 조각은 크게 해서 바늘이 비치지 않게 한다
    const r = (i < 2 ? 0.22 : 0.17) + rng.int(5) / 100;
    const n = 4 + rng.int(2);
    const off = rng.int(360) * DEG;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const aa = off + (k / n) * TAU + (rng.int(31) - 15) * DEG;
      const rr = r * (0.78 + rng.int(28) / 100);
      pts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]);
    }
    return {
      x: Math.sin(a) * d + (rng.int(9) - 4) / 100,
      y: -Math.cos(a) * d + (rng.int(9) - 4) / 100,
      r,
      pts,
      rot: 0,
      state: 'rest',
      vx: 0,
      vy: 0,
      spin: 0,
      t: 0,
    };
  });
}

export function mount(root, ctx) {
  ensureStyle('hd-scene-clock', CSS);
  const data = ctx.data;
  const rng = ctx.rng;
  const mirrored = !!data.mirrored;
  // 정각이라 분침은 12, 시침은 숫자에 딱 맞는다
  const hourAngle = (data.hour % 12) * 30 * DEG;
  const shownHour = mirrored ? -hourAngle : hourAngle;
  // 초침은 아래쪽(5~7시)에만 둔다. 보기 시각(2·3·4시)이나 그 거울 자리(8·9·10시)를 가리키면 헷갈린다
  const secAngle = (25 + rng.int(11)) * 6 * DEG;
  const crack = makeCrack(rng);
  const shards = makeShards(rng, shownHour);

  let alive = true;
  let finished = false;
  let stage = 'sweep';
  const timers = new Set();
  let raf = 0;
  let S = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let faceCv = null;
  let glassCv = null;
  let lastNow = performance.now();
  let kick = 0;
  let twitchAt = -1e9;
  let nextTwitch = lastNow + 700;
  let celebAt = 0;
  let drag = null;

  const line = h('p', { class: 'sc-clock-line', text: '손가락으로 유리 조각을 쓸어 내' });
  const cv = h('canvas', { role: 'img', 'aria-label': mirrored ? '거울에 비친 멈춘 시계' : '멈춘 시계' });
  const stamp = h('div', { class: 'sc-clock-stamp', hidden: true });
  // 도장이 캔버스 위에 오도록 캔버스 크기와 같은 판에 함께 담는다
  const board = h('div', { class: 'sc-clock-board' }, cv, stamp);
  const wrap = h('div', { class: 'sc-clock-wrap' }, board);
  const buttons = data.options.map((label, i) =>
    h('button', { class: 'btn sc-clock-opt', type: 'button', disabled: true, text: label, onClick: () => pick(i) })
  );
  const el = h('div', { class: 'sc-clock', 'data-stage': stage }, line, wrap, h('div', { class: 'sc-clock-opts' }, buttons));
  root.append(el);
  const g = cv.getContext('2d');

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

  function showStamp() {
    stamp.textContent = data.options[data.answer] + '에 멈췄어';
    stamp.hidden = false;
  }

  function toRead() {
    setStage('read');
    buttons.forEach((b) => (b.disabled = false));
    line.textContent = '시계가 몇 시에 멈췄을까?';
    ctx.sfx('reveal');
  }

  function pick(i) {
    if (!alive || stage !== 'read') return;
    const btn = buttons[i];
    if (i === data.answer) {
      setStage('done');
      btn.classList.add('is-right');
      buttons.forEach((b, j) => {
        if (j !== i) b.disabled = true;
      });
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 시계가 멈춘 시각이야';
      ctx.sfx('good');
      ctx.buzz(30);
      showStamp();
      celebAt = performance.now();
      later(CELEBRATE_MS, finish);
    } else {
      btn.disabled = true;
      btn.classList.add('is-wrong');
      ctx.miss();
      ctx.sfx('bad');
      ctx.buzz([40, 40, 40]);
      kick += 4 * DEG;
      shake(wrap);
      line.textContent = mirrored ? '거울은 왼쪽과 오른쪽이 반대야' : '짧은 바늘이 가리키는 곳을 봐';
      line.classList.add('is-hint');
    }
  }

  function launch(s, dx, dy, speed) {
    const len = Math.hypot(dx, dy) || 1;
    s.state = 'fly';
    s.t = 0;
    s.vx = (dx / len) * speed;
    s.vy = (dy / len) * speed;
    s.spin = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5);
    kick += 1.2 * DEG;
    ctx.sfx('tap');
    ctx.buzz(8);
    if (stage === 'sweep' && shards.every((q) => q.state !== 'rest')) toRead();
  }

  // ---- 크기 ----

  function layout() {
    const w = wrap.clientWidth;
    const hh = wrap.clientHeight;
    const size = Math.floor(Math.min(w, hh));
    if (size < 20 || size === S) return;
    S = size;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(S * dpr);
    cv.height = Math.round(S * dpr);
    cv.style.width = S + 'px';
    cv.style.height = S + 'px';
    board.style.width = S + 'px';
    board.style.height = S + 'px';
    if (mirrored) {
      cx = S / 2;
      cy = S * 0.44;
      R = S * 0.33;
    } else {
      cx = S / 2;
      cy = S / 2;
      R = S * 0.46;
    }
    faceCv = renderFace();
    glassCv = renderGlass();
  }

  /** 시계 몸통 (테, 판, 눈금, 숫자). 바늘과 유리는 따로 그린다. 가운데 (0,0), 단위 CSS px. */
  function offscreen() {
    const c = document.createElement('canvas');
    const px = Math.ceil(2 * R * dpr);
    c.width = px;
    c.height = px;
    const o = c.getContext('2d');
    o.setTransform(px / (2 * R), 0, 0, px / (2 * R), px / 2, px / 2);
    return [c, o];
  }

  function renderFace() {
    const [c, o] = offscreen();
    let grad = o.createLinearGradient(-R, -R, R, R);
    grad.addColorStop(0, '#a56a3b');
    grad.addColorStop(1, '#5a341a');
    o.fillStyle = grad;
    o.beginPath();
    o.arc(0, 0, R, 0, TAU);
    o.fill();
    o.fillStyle = '#d9b45a';
    o.beginPath();
    o.arc(0, 0, R * 0.9, 0, TAU);
    o.fill();
    const fr = R * 0.86;
    grad = o.createRadialGradient(-fr * 0.2, -fr * 0.25, fr * 0.1, 0, 0, fr);
    grad.addColorStop(0, '#fffdf6');
    grad.addColorStop(1, '#ece2c8');
    o.fillStyle = grad;
    o.beginPath();
    o.arc(0, 0, fr, 0, TAU);
    o.fill();

    o.strokeStyle = '#2b2118';
    for (let i = 0; i < 60; i++) {
      // 거울 시계의 12시는 아래에서 빨간 세모로 따로 그린다
      if (mirrored && i === 0) continue;
      const a = i * 6 * DEG;
      const quarter = i % 15 === 0;
      const major = i % 5 === 0;
      const len = quarter ? 0.14 * R : major ? 0.1 * R : 0.035 * R;
      o.lineWidth = quarter ? 0.055 * R : major ? 0.032 * R : 0.012 * R;
      const r1 = fr - 0.03 * R;
      const r0 = r1 - len;
      o.beginPath();
      o.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      o.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      o.stroke();
    }
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    if (mirrored) {
      // 숫자가 없으니 12시만은 확실히 알 수 있게
      const top = -(fr - 0.03 * R);
      o.fillStyle = '#d9412f';
      o.beginPath();
      o.moveTo(-0.09 * R, top);
      o.lineTo(0.09 * R, top);
      o.lineTo(0, top + 0.2 * R);
      o.closePath();
      o.fill();
    } else {
      o.fillStyle = '#2b2118';
      o.font = `900 ${0.22 * R}px ${FONT}`;
      const nr = R * 0.6;
      [['12', 0], ['3', 90], ['6', 180], ['9', 270]].forEach(([t, a]) => {
        o.fillText(t, Math.sin(a * DEG) * nr, -Math.cos(a * DEG) * nr + 0.01 * R);
      });
    }
    // 상표 글자. 거울이면 이것도 뒤집혀 보여서 "거울 속"이라는 걸 한 번 더 알려 준다
    o.fillStyle = '#9c8a6c';
    o.font = `800 ${0.11 * R}px ${FONT}`;
    o.fillText('똑딱 시계', 0, 0.34 * R);
    return c;
  }

  function renderGlass() {
    const [c, o] = offscreen();
    o.save();
    o.beginPath();
    o.arc(0, 0, R * 0.86, 0, TAU);
    o.clip();
    o.lineJoin = 'round';
    o.lineCap = 'round';
    const passes = [
      { color: 'rgba(40, 40, 50, 0.35)', width: 0.024 * R, off: 0.007 * R },
      { color: 'rgba(255, 255, 255, 0.95)', width: 0.013 * R, off: 0 },
    ];
    for (const p of passes) {
      o.strokeStyle = p.color;
      o.lineWidth = p.width;
      o.beginPath();
      for (const pts of [...crack.rays, ...crack.rings]) {
        pts.forEach(([x, y], i) => (i ? o.lineTo(x * R + p.off, y * R + p.off) : o.moveTo(x * R + p.off, y * R + p.off)));
      }
      o.stroke();
    }
    o.fillStyle = 'rgba(255, 255, 255, 0.9)';
    o.beginPath();
    o.arc(crack.ix * R, crack.iy * R, 0.035 * R, 0, TAU);
    o.fill();
    o.restore();
    return c;
  }

  // ---- 그리기 ----

  function hand(angle, len, tail, w, color) {
    g.save();
    g.rotate(angle);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-w / 2, tail);
    g.lineTo(-w * 0.42, -len * 0.78);
    g.lineTo(0, -len);
    g.lineTo(w * 0.42, -len * 0.78);
    g.lineTo(w / 2, tail);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawHands(now) {
    const s = (now - twitchAt) / 1000;
    // 초침이 한 칸 가려다 못 가고 떨다 멈춘다
    const twitch = s < 1 ? 6 * DEG * Math.sin(s * TAU * 5) * Math.exp(-s * 5) : 0;
    for (const [dx, dy, color] of [
      [0.022 * R, 0.035 * R, 'rgba(0, 0, 0, 0.2)'],
      [0, 0, '#2b2118'],
    ]) {
      g.save();
      g.translate(dx, dy);
      hand(0, 0.8 * R, 0.12 * R, 0.055 * R, color);
      hand(hourAngle, 0.5 * R, 0.1 * R, 0.11 * R, color);
      g.restore();
    }
    g.save();
    g.rotate(secAngle + twitch);
    g.strokeStyle = '#d9412f';
    g.lineWidth = Math.max(1.5, 0.014 * R);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0.2 * R);
    g.lineTo(0, -0.82 * R);
    g.stroke();
    g.fillStyle = '#d9412f';
    g.beginPath();
    g.arc(0, 0.15 * R, 0.035 * R, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = '#c99a3c';
    g.beginPath();
    g.arc(0, 0, 0.06 * R, 0, TAU);
    g.fill();
    g.fillStyle = '#2b2118';
    g.beginPath();
    g.arc(0, 0, 0.022 * R, 0, TAU);
    g.fill();
  }

  function drawShards() {
    for (const s of shards) {
      if (s.state === 'gone') continue;
      g.save();
      g.globalAlpha = s.state === 'fly' ? Math.max(0, 1 - s.t / FLY_SEC) : 1;
      g.translate(s.x * R, s.y * R);
      g.rotate(s.rot);
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R)));
      g.closePath();
      const grad = g.createLinearGradient(-s.r * R, -s.r * R, s.r * R, s.r * R);
      // 금이 잔뜩 간 유리는 뿌옇게 보여 아래가 비치지 않는다
      grad.addColorStop(0, '#f2f8fa');
      grad.addColorStop(1, '#b3c8d3');
      g.fillStyle = grad;
      g.shadowColor = 'rgba(0, 0, 0, 0.3)';
      g.shadowBlur = 0.06 * R;
      g.shadowOffsetY = 0.025 * R;
      g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(1.2, 0.016 * R);
      g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      g.lineWidth = Math.max(1, 0.01 * R);
      g.beginPath();
      g.moveTo(s.pts[0][0] * R * 0.5, s.pts[0][1] * R * 0.5);
      g.lineTo(s.pts[2][0] * R * 0.4, s.pts[2][1] * R * 0.4);
      g.stroke();
      g.restore();
    }
  }

  function drawGlare() {
    g.save();
    g.beginPath();
    g.arc(0, 0, R * 0.86, 0, TAU);
    g.clip();
    g.fillStyle = 'rgba(255, 255, 255, 0.2)';
    g.beginPath();
    g.ellipse(-0.38 * R, -0.5 * R, 0.55 * R, 0.2 * R, -35 * DEG, 0, TAU);
    g.fill();
    g.restore();
  }

  function mirrorBox() {
    const x = S * 0.05;
    const y = S * 0.02;
    return { x, y, w: S * 0.9, h: S * 0.86, ft: S * 0.035, r: S * 0.06 };
  }

  function drawMirrorBack() {
    const m = mirrorBox();
    const grad = g.createLinearGradient(m.x, m.y, m.x + m.w, m.y + m.h);
    grad.addColorStop(0, '#c99a52');
    grad.addColorStop(1, '#7a5426');
    g.fillStyle = grad;
    roundRect(g, m.x, m.y, m.w, m.h, m.r);
    g.fill();
    const glass = g.createLinearGradient(m.x, m.y, m.x + m.w, m.y + m.h);
    glass.addColorStop(0, '#eef4f6');
    glass.addColorStop(1, '#b4c6cf');
    g.fillStyle = glass;
    roundRect(g, m.x + m.ft, m.y + m.ft, m.w - 2 * m.ft, m.h - 2 * m.ft, m.r * 0.6);
    g.fill();
  }

  function drawMirrorFront() {
    const m = mirrorBox();
    g.save();
    roundRect(g, m.x + m.ft, m.y + m.ft, m.w - 2 * m.ft, m.h - 2 * m.ft, m.r * 0.6);
    g.clip();
    // 거울 유리에 비스듬한 빛줄기
    g.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (const [x0, w] of [[0.12, 0.12], [0.3, 0.05], [0.7, 0.08]]) {
      g.beginPath();
      g.moveTo(S * x0, m.y + m.h);
      g.lineTo(S * (x0 + w), m.y + m.h);
      g.lineTo(S * (x0 + w + 0.35), m.y);
      g.lineTo(S * (x0 + 0.35), m.y);
      g.closePath();
      g.fill();
    }
    g.restore();
    // 이름표
    const pw = S * 0.62;
    const ph = Math.max(24, S * 0.095);
    const px = (S - pw) / 2;
    const py = m.y + m.h - ph * 0.55;
    g.fillStyle = '#e3b341';
    roundRect(g, px, py, pw, ph, ph * 0.3);
    g.fill();
    g.strokeStyle = '#9b7420';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#2b2118';
    g.font = `900 ${Math.max(13, S * 0.05)}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('거울에 비친 시계야', S / 2, py + ph / 2 + 1);
  }

  function drawCelebrate(now) {
    const p = (now - celebAt) / CELEBRATE_MS;
    if (!celebAt || p > 1.6) return;
    const fade = Math.max(0, 1 - p / 1.6);
    g.save();
    g.strokeStyle = `rgba(227, 179, 65, ${fade})`;
    g.lineWidth = 0.07 * R;
    g.shadowColor = '#ffe08a';
    g.shadowBlur = 0.2 * R;
    g.beginPath();
    g.arc(0, 0, R * (1.0 + 0.06 * Math.min(1, p)), 0, TAU);
    g.stroke();
    g.shadowColor = 'transparent';
    g.fillStyle = `rgba(255, 246, 200, ${fade})`;
    for (let k = 0; k < 6; k++) {
      const a = k * 60 * DEG + 15 * DEG + p * 0.6;
      const r = 0.16 * R * Math.sin(Math.min(1, p) * Math.PI) + 0.04 * R;
      const x = Math.sin(a) * R * 1.02;
      const y = -Math.cos(a) * R * 1.02;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const aa = (i * Math.PI) / 4;
        const rr = i % 2 ? r * 0.25 : r;
        g.lineTo(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr);
      }
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    for (const s of shards) {
      if (s.state !== 'fly') continue;
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 3 * dt;
      s.rot += s.spin * dt;
      if (s.t > FLY_SEC) s.state = 'gone';
    }
    kick *= Math.exp(-dt * 2.5);
    if (stage !== 'done' && now >= nextTwitch) {
      twitchAt = now;
      nextTwitch = now + 2300 + Math.random() * 1500;
      ctx.sfx('tick');
    }
    if (S) {
      // 떨어진 충격이 남아 시계가 아주 살짝 흔들린다. 조각이 튀거나 틀리면 더 크게
      const sway = 0.6 * DEG * Math.sin((now / 1000) * (TAU / 3.4)) + kick * Math.sin((now / 1000) * TAU * 1.8);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, S, S);
      if (mirrored) drawMirrorBack();
      g.save();
      g.translate(cx, cy);
      g.fillStyle = 'rgba(0, 0, 0, 0.18)';
      g.beginPath();
      g.arc(0.03 * R, 0.06 * R, R, 0, TAU);
      g.fill();
      g.rotate(sway);
      g.save();
      if (mirrored) g.scale(-1, 1);
      g.drawImage(faceCv, -R, -R, 2 * R, 2 * R);
      drawHands(now);
      g.drawImage(glassCv, -R, -R, 2 * R, 2 * R);
      g.restore();
      drawGlare();
      drawShards();
      drawCelebrate(now);
      g.restore();
      if (mirrored) drawMirrorFront();
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function local(e) {
    const b = cv.getBoundingClientRect();
    return { x: (e.clientX - b.left - cx) / R, y: (e.clientY - b.top - cy) / R, t: e.timeStamp };
  }

  function onDown(e) {
    if (!alive || stage !== 'sweep' || drag || !R) return;
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 이미 끝난 포인터 */
    }
    const p = local(e);
    drag = { id: e.pointerId, p, start: p, moved: 0 };
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const p = local(e);
    const a = drag.p;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    drag.moved += len;
    // 빨리 쓸수록 멀리 날아간다 (단위: 반지름/초)
    const speed = Math.min(7, Math.max(3, (len / Math.max(8, p.t - a.t)) * 600));
    for (const s of shards) {
      if (s.state !== 'rest') continue;
      if (segDist(s.x, s.y, a.x, a.y, p.x, p.y) < s.r * 0.9 + FINGER) launch(s, dx, dy, speed);
    }
    drag.p = p;
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    // 문지르지 않고 톡 건드려도 그 조각은 바깥쪽으로 튕겨 나간다
    if (drag.moved < 0.05 && stage === 'sweep') {
      const p = drag.start;
      for (const s of shards) {
        if (s.state !== 'rest') continue;
        if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + FINGER * 0.5) {
          launch(s, s.x || Math.random() - 0.5, s.y || -0.5, 3.4);
        }
      }
    }
    drag = null;
  }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(() => {
    if (alive) layout();
  });
  ro.observe(wrap);
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
      shards.forEach((s) => (s.state = 'gone'));
      setStage('done');
      buttons.forEach((b, j) => {
        b.disabled = j !== data.answer;
        if (j === data.answer) b.classList.add('is-right');
      });
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 시계가 멈춘 시각이야';
      showStamp();
      finish();
    },
  };
}
