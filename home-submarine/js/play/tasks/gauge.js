// 수리 놀이: 압력 맞추기.
// 반원 계기판의 바늘이 좌우로 흔들린다. 바늘이 초록 칸에 들어왔을 때 누른다(큰 버튼이든 화면 아무 데나).
// 세 번 맞히면 끝. 맞힐 때마다 위의 불이 하나씩 켜지고 초록 칸이 다른 곳으로 옮겨 간다.
// 규격은 index.js 참고.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const HITS = 3;
// 바늘 움직임: period 는 한 번 왔다 갔다 하는 시간(초), wob 은 빠르기가 출렁이는 정도
const LEVELS = [
  { zone: 0.28, period: 3.6, wob: [0.1, 0.05] },
  { zone: 0.22, period: 3.0, wob: [0.14, 0.06] },
  { zone: 0.16, period: 2.4, wob: [0.32, 0.12] },
];
const SWING = 0.46; // 바늘이 가운데에서 양쪽으로 가는 폭 (계기판 전체 = 1)
const SLACK = 1.5 / 180; // 경계에서 억울하지 않게 초록 칸 양쪽에 1.5도씩 여유
const HIT_LOCK_MS = 180; // 맞힌 직후 두 번 눌림을 막는다
const MISS_LOCK_MS = 300; // 틀린 직후 마구 누르기를 막는다
const ZONE_MOVE_MS = 240;
const CELEBRATE_MS = 420;
const GREEN = '#7bed9f';

const CSS = `
.tk-gauge { --tk-c: #4cc9f0; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.tk-gauge-top { flex: none; display: flex; align-items: center; justify-content: center; gap: 14px; min-height: 42px; flex-wrap: nowrap; }
.tk-gauge-line { font-size: 24px; font-weight: 900; line-height: 1.1; color: var(--text); white-space: nowrap; }
.tk-gauge-line b { color: var(--green); text-shadow: 0 0 10px rgba(123, 237, 159, 0.7); }
.tk-gauge-lamps { display: flex; gap: 8px; }
.tk-gauge-lamp { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #3d5868, #10232f 70%); border: 3px solid #5d7a8b; box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.6); }
.tk-gauge-lamp.is-on { background: radial-gradient(circle at 35% 35%, #f2fff6, var(--green) 45%, #2f9e5b); border-color: #d2f9de; box-shadow: 0 0 14px var(--green), 0 0 4px #fff; animation: tk-gauge-pop 0.3s ease; }
.tk-gauge-wrap { position: relative; flex: 1 1 0; min-height: 0; }
.tk-gauge-wrap canvas { position: absolute; left: 0; top: 0; }
.tk-gauge-btn { flex: none; width: 100%; min-height: 68px; font-size: 28px; letter-spacing: 0.06em; color: #04121d; background: var(--tk-c); border-color: transparent; border-radius: 16px; box-shadow: 0 5px 0 rgba(0, 0, 0, 0.45), 0 0 18px color-mix(in srgb, var(--tk-c) 45%, transparent); }
.tk-gauge-btn.is-press { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.45); }
.tk-gauge.is-done .tk-gauge-btn { background: var(--green); }
@keyframes tk-gauge-pop { from { transform: scale(1.6); } }
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
  for (const [x, y] of [[13, 13], [w - 13, 13], [13, hh - 13], [w - 13, hh - 13]]) rivet(o, x, y, 4.5);
}

export function mount(root, ctx) {
  ensureStyle('hs-task-gauge', CSS);
  const level = Math.max(0, Math.min(2, Math.round(Number(ctx.data && ctx.data.level) || 0)));
  const rng = ctx.rng;
  const color = ctx.color || '#4cc9f0';
  const P = LEVELS[level];
  const omega = TAU / P.period;
  const s1 = rng.int(628) / 100;
  const s2 = rng.int(628) / 100;
  const zw = P.zone;

  let alive = true;
  let finished = false;
  let complete = false;
  let lit = 0;
  let t = 0; // 놀이 안의 시간(초)
  let phase = rng.int(628) / 100;
  let u = 0.5; // 바늘 자리. 0 = 맨 왼쪽, 1 = 맨 오른쪽
  let zone = pickZone(null, -1);
  let zoneFrom = zone;
  let zoneAt = -1e9;
  let lockUntil = 0;
  let hitAt = -1e9;
  let missAt = -1e9;
  let doneAt = 0;
  let wobble = 0;
  let raf = 0;
  let lastNow = performance.now();
  const timers = new Set();

  let W = 0;
  let H = 0;
  let dpr = 1;
  let px = 0;
  let py = 0;
  let R = 0;
  let bgCv = null;

  const lamps = Array.from({ length: HITS }, () => h('span', { class: 'tk-gauge-lamp' }));
  const top = h(
    'div',
    { class: 'tk-gauge-top' },
    h('p', { class: 'tk-gauge-line' }, h('b', { text: '초록' }), '에 맞춰'),
    h('div', { class: 'tk-gauge-lamps', 'aria-label': '맞힌 횟수' }, lamps)
  );
  const cv = h('canvas', { role: 'img', 'aria-label': '압력 계기판' });
  const wrap = h('div', { class: 'tk-gauge-wrap' }, cv);
  const btn = h('button', { class: 'btn tk-gauge-btn', type: 'button', text: '지금!' });
  const el = h('div', { class: 'tk-gauge', style: { '--tk-c': color } }, top, wrap, btn);
  root.append(el);
  const g = cv.getContext('2d');

  /** 새 초록 칸. 앞 칸과 멀리, 지금 바늘이 있는 곳은 피해서 (눌러 둔 손가락이 그대로 또 맞지 않게) */
  function pickZone(prev, needle) {
    const lo = 0.06;
    const hi = 0.94 - zw;
    let best = null;
    for (let k = 0; k < 24; k++) {
      const start = lo + (rng.int(1000) / 1000) * (hi - lo);
      const c = start + zw / 2;
      const farPrev = !prev || Math.abs(c - (prev.start + zw / 2)) >= 0.25;
      const clearNeedle = needle < 0 || needle < start - 0.06 || needle > start + zw + 0.06;
      if (farPrev && clearNeedle) return { start };
      if (!best && clearNeedle) best = { start };
    }
    // 마땅한 곳이 없으면 바늘 반대쪽 끝으로 보낸다
    return best || { start: needle > 0.5 ? lo : hi };
  }

  function zoneNow(now) {
    const p = Math.min(1, (now - zoneAt) / ZONE_MOVE_MS);
    const e = 1 - (1 - p) * (1 - p);
    return zoneFrom.start + (zone.start - zoneFrom.start) * e;
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

  function sync() {
    lamps.forEach((l, i) => l.classList.toggle('is-on', i < lit));
    el.dataset.lit = String(lit);
    el.dataset.zone = `${zone.start.toFixed(4)},${(zone.start + zw).toFixed(4)}`;
    el.classList.toggle('is-done', complete);
  }

  /** 바늘을 now 까지 움직인다. 누른 순간에도 불러서 그 순간의 자리로 판정한다. */
  function advance(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    t += dt;
    if (complete) {
      // 압력이 잡혀서 바늘이 초록 가운데로 가서 멈춘다
      u += (zone.start + zw / 2 - u) * (1 - Math.exp(-dt * 12));
      return;
    }
    // 사인 곡선에 빠르기가 조금씩 출렁인다 (어려움은 많이)
    const speed = 1 + P.wob[0] * Math.sin(t * 0.9 + s1) + P.wob[1] * Math.sin(t * 2.3 + s2);
    phase += omega * speed * dt;
    // 압력계 바늘의 잔떨림 (1도 안쪽)
    const jitter = 0.0035 * Math.sin(t * 37) + 0.0025 * Math.sin(t * 53 + s1);
    u = Math.max(0, Math.min(1, 0.5 + SWING * Math.sin(phase) + jitter));
  }

  function shake() {
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    later(380, () => wrap.classList.remove('shake'));
  }

  function press() {
    if (!alive || complete) return;
    const now = performance.now();
    btn.classList.add('is-press');
    later(110, () => btn.classList.remove('is-press'));
    if (now < lockUntil) return;
    advance(now);
    const z0 = zone.start - SLACK;
    const z1 = zone.start + zw + SLACK;
    if (u >= z0 && u <= z1) {
      lit += 1;
      hitAt = now;
      ctx.buzz(30);
      if (lit >= HITS) {
        complete = true;
        doneAt = now;
        ctx.sfx('fixed');
        later(CELEBRATE_MS, finish);
      } else {
        ctx.sfx('good');
        zoneFrom = { start: zoneNow(now) };
        zone = pickZone(zone, u);
        zoneAt = now;
        lockUntil = now + HIT_LOCK_MS;
      }
    } else {
      missAt = now;
      wobble = 1;
      lockUntil = now + MISS_LOCK_MS;
      ctx.miss();
      ctx.sfx('bad');
      ctx.buzz([40, 40, 40]);
      shake();
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
    // 계기판 몸통은 가운데 위로 1.1R, 아래로 0.24R. 판 안에 꽉 차게 둔다
    R = Math.max(30, Math.min((W - 16) / 2.2, (H - 16) / 1.34, 200));
    px = W / 2;
    py = H / 2 + R * 0.43;
    bgCv = renderBg();
  }

  const ang = (v) => Math.PI + v * Math.PI;

  function renderBg() {
    const [c, o] = sprite(W, H, dpr);
    plate(o, W, H);
    // 계기판 몸통 (D 모양)
    const body = (r, below) => {
      o.beginPath();
      o.arc(px, py, r, Math.PI, TAU);
      o.lineTo(px + r, py + below - 10);
      o.arcTo(px + r, py + below, px + r - 10, py + below, 10);
      o.lineTo(px - r + 10, py + below);
      o.arcTo(px - r, py + below, px - r, py + below - 10, 10);
      o.closePath();
    };
    o.fillStyle = 'rgba(0, 0, 0, 0.35)';
    o.save();
    o.translate(3, 6);
    body(R * 1.1, R * 0.24);
    o.fill();
    o.restore();
    const bz = o.createLinearGradient(px - R, py - R, px + R, py + R * 0.3);
    bz.addColorStop(0, '#d0dfe7');
    bz.addColorStop(0.5, '#7590a0');
    bz.addColorStop(1, '#2c4453');
    body(R * 1.1, R * 0.24);
    o.fillStyle = bz;
    o.fill();
    o.lineWidth = 2;
    o.strokeStyle = '#061520';
    o.stroke();
    const face = o.createRadialGradient(px, py - R * 0.3, R * 0.1, px, py, R);
    face.addColorStop(0, '#163447');
    face.addColorStop(1, '#06141d');
    body(R * 1.0, R * 0.14);
    o.fillStyle = face;
    o.fill();
    // 눈금 띠: 양 끝은 위험(빨강)
    const bandR = R * 0.8;
    const bandW = R * 0.2;
    o.lineWidth = bandW;
    o.strokeStyle = '#1f4257';
    o.beginPath();
    o.arc(px, py, bandR, Math.PI, TAU);
    o.stroke();
    o.strokeStyle = '#7a2335';
    o.beginPath();
    o.arc(px, py, bandR, Math.PI, ang(0.05));
    o.stroke();
    o.beginPath();
    o.arc(px, py, bandR, ang(0.95), TAU);
    o.stroke();
    // 눈금
    o.strokeStyle = '#cfe3ee';
    o.lineCap = 'round';
    for (let k = 0; k <= 20; k++) {
      const a = ang(k / 20);
      const major = k % 5 === 0;
      const r0 = R * (major ? 0.56 : 0.6);
      const r1 = R * 0.67;
      o.lineWidth = major ? Math.max(2.5, R * 0.025) : Math.max(1.2, R * 0.012);
      o.beginPath();
      o.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
      o.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1);
      o.stroke();
    }
    for (const sx of [-1, 1]) rivet(o, px + sx * R * 0.94, py + R * 0.08, Math.max(3, R * 0.035));
    return c;
  }

  // ---- 그리기 ----

  function drawZone(now) {
    const zs = zoneNow(now);
    const a0 = ang(zs);
    const a1 = ang(zs + zw);
    const bandR = R * 0.8;
    const bandW = R * 0.2;
    const inside = !complete && u >= zs - SLACK && u <= zs + zw + SLACK;
    const pulse = Math.max(0, 1 - (now - hitAt) / 350);
    const missP = Math.max(0, 1 - (now - missAt) / 350);
    g.save();
    g.lineCap = 'butt';
    g.shadowColor = GREEN;
    g.shadowBlur = inside || complete ? 22 : 10;
    g.strokeStyle = missP > 0 ? mix('#7bed9f', '#ff4d6d', missP) : inside || pulse > 0 ? '#b9ffd0' : GREEN;
    g.lineWidth = bandW * (1 + 0.25 * pulse);
    g.beginPath();
    g.arc(px, py, bandR, a0, a1);
    g.stroke();
    g.restore();
    // 초록 칸 양쪽 끝의 흰 선
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    for (const a of [a0, a1]) {
      g.moveTo(px + Math.cos(a) * (bandR - bandW * 0.55), py + Math.sin(a) * (bandR - bandW * 0.55));
      g.lineTo(px + Math.cos(a) * (bandR + bandW * 0.55), py + Math.sin(a) * (bandR + bandW * 0.55));
    }
    g.stroke();
  }

  function drawNeedle(now) {
    const shakeA = wobble * 0.08 * Math.sin(now / 18);
    const a = ang(u) + shakeA;
    const len = R * 0.9;
    const bw = R * 0.075;
    g.save();
    g.translate(px, py);
    g.rotate(a);
    // 그림자 어긋남은 회전과 상관없이 화면 기준이라 늘 아래로 진다
    g.shadowColor = 'rgba(0, 0, 0, 0.45)';
    g.shadowOffsetX = 2;
    g.shadowOffsetY = 4;
    g.shadowBlur = 4;
    g.fillStyle = complete ? GREEN : '#ff4d6d';
    needlePath(len, bw);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    // 축 (구역 색)
    g.fillStyle = '#061520';
    g.beginPath();
    g.arc(px, py, R * 0.13 + 3, 0, TAU);
    g.fill();
    const hg = g.createRadialGradient(px - R * 0.04, py - R * 0.04, R * 0.01, px, py, R * 0.13);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.4, color);
    hg.addColorStop(1, '#203a4a');
    g.fillStyle = hg;
    g.beginPath();
    g.arc(px, py, R * 0.13, 0, TAU);
    g.fill();
    // 맞혔을 때 바늘 끝에서 튀는 빛
    const p = (now - hitAt) / 380;
    if (p >= 0 && p < 1) {
      const tx = px + Math.cos(a) * len;
      const ty = py + Math.sin(a) * len;
      g.strokeStyle = `rgba(185, 255, 208, ${1 - p})`;
      g.lineWidth = 3;
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const b = (k / 8) * TAU;
        g.moveTo(tx + Math.cos(b) * R * (0.06 + 0.12 * p), ty + Math.sin(b) * R * (0.06 + 0.12 * p));
        g.lineTo(tx + Math.cos(b) * R * (0.1 + 0.2 * p), ty + Math.sin(b) * R * (0.1 + 0.2 * p));
      }
      g.stroke();
    }
  }

  function needlePath(len, bw) {
    g.beginPath();
    g.moveTo(-R * 0.08, -bw * 0.6);
    g.lineTo(len, 0);
    g.lineTo(-R * 0.08, bw * 0.6);
    g.closePath();
  }

  function drawDone(now) {
    if (!complete) return;
    const p = (now - doneAt) / 500;
    if (p > 1) return;
    g.strokeStyle = GREEN;
    g.globalAlpha = 1 - p;
    g.lineWidth = 6 * (1 - p) + 2;
    g.beginPath();
    g.arc(px, py, R * (1.1 + 0.12 * p), Math.PI, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const prev = lastNow;
    advance(now);
    const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
    wobble *= Math.exp(-dt * 8);
    if (W && bgCv) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.drawImage(bgCv, 0, 0, W, H);
      drawZone(now);
      drawNeedle(now);
      drawDone(now);
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    press();
  }

  function onKey(e) {
    // 키보드로 버튼을 누를 때만 (손가락은 pointerdown 에서 이미 처리했다)
    if (e.detail === 0) press();
  }

  el.addEventListener('pointerdown', onDown);
  btn.addEventListener('click', onKey);

  const ro = new ResizeObserver(() => {
    if (alive) layout();
  });
  ro.observe(wrap);
  sync();
  layout();
  raf = requestAnimationFrame(frame);

  // 검증용 손잡이: 바늘 자리는 그림에만 있으므로 ?debug=1 일 때만 밖에서 읽게 한다
  const handle = { needle: () => u, zone: () => [zone.start, zone.start + zw], slack: SLACK };
  if (DEBUG) window.__hsGauge = handle;

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      btn.removeEventListener('click', onKey);
      el.remove();
      if (window.__hsGauge === handle) delete window.__hsGauge;
    },
    solve() {
      if (!alive || finished) return;
      if (!complete) {
        lit = HITS;
        complete = true;
        doneAt = performance.now();
        ctx.sfx('fixed');
        sync();
      }
      finish();
    },
  };
}

/** 두 #rrggbb 색을 k(0~1) 만큼 섞는다 */
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
