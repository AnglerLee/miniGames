// 수리 놀이: 펌프질.
// 왼쪽 손잡이를 손가락으로 끝까지 내렸다 끝까지 올리면 한 번. 오른쪽 탱크가 한 칸씩 찬다.
// 가만두면 탱크가 조금씩 줄어든다. 실수 개념은 없다. 규격은 index.js 참고.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

const TAU = Math.PI * 2;
const NEED = [5, 7, 9];
// 가만둘 때 1초에 줄어드는 양 (탱크 전체 = 1). 0 은 거의 그대로, 2 는 2초 쉬면 한 칸쯤 준다
const LEAK_PER_S = [0.004, 0.02, 0.045];
const IDLE_MS = 700; // 손잡이를 이만큼 안 움직이면 줄기 시작한다
// 끝에서 이만큼 안쪽까지 들어오면 "끝에 닿았다". 위 10%·아래 10% 이므로 한 번 세려면 80% 넘게 움직여야 한다
const END_ZONE = 0.1;
const CELEBRATE_MS = 420;

const CSS = `
.tk-pump { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; user-select: none; -webkit-user-select: none; }
.tk-pump-say { flex: none; text-align: center; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
.tk-pump.is-fixed .tk-pump-say { color: var(--green); }
.tk-pump-wrap { position: relative; flex: 1 1 0; min-height: 240px; border-radius: 14px; overflow: hidden; background: #22323d; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.45), 0 4px 14px rgba(0, 0, 0, 0.35); }
.tk-pump-wrap canvas { position: absolute; left: 0; top: 0; touch-action: none; }
`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function roundRect(g, x, y, w, hh, r) {
  const rr = Math.min(r, w / 2, hh / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + hh, rr);
  g.arcTo(x + w, y + hh, x, y + hh, rr);
  g.arcTo(x, y + hh, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

function rivet(g, x, y, r) {
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.beginPath();
  g.arc(x + 0.8, y + 1.2, r, 0, TAU);
  g.fill();
  const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#d5e2ea');
  gr.addColorStop(0.5, '#7d93a2');
  gr.addColorStop(1, '#3b4e5b');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** #rrggbb 를 rgba 문자열로 */
function rgba(hex, a) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  if (!Number.isFinite(n)) return `rgba(76, 201, 240, ${a})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function mount(root, ctx) {
  ensureStyle('hs-task-pump', CSS);
  const level = clamp(Number(ctx.data && ctx.data.level) || 0, 0, 2);
  const color = ctx.color || '#4cc9f0';
  const need = NEED[level];
  const leakRate = LEAK_PER_S[level];
  // 이 놀이는 배치가 고정이라 씨앗은 탱크 안 물방울 모양에만 쓴다
  const bubbleSeed = ctx.rng ? ctx.rng.int(1000) : 0;

  let alive = true;
  let finished = false;
  let phase = 'play';
  let pos = 0; // 손잡이 위치. 0 위 끝, 1 아래 끝
  let armed = 'down'; // 다음에 닿아야 할 끝
  let strokes = 0;
  let fill = 0;
  let shown = 0;
  let lastMove = 0;
  let doneAt = 0;
  let hitTop = -1e9;
  let hitBottom = -1e9;
  let flowAt = -1e9;
  let drag = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let lastNow = 0;
  let geo = null;
  const timers = new Set();
  const bubbles = [];

  const say = h('p', { class: 'tk-pump-say', text: '위아래로!' });
  const cv = h('canvas', { role: 'img', 'aria-label': '펌프 손잡이와 물탱크' });
  const wrap = h('div', { class: 'tk-pump-wrap' }, cv);
  const el = h('div', { class: 'tk-pump', style: { '--c': color } }, say, wrap);
  root.append(el);
  const g = cv.getContext('2d');

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

  function mark() {
    el.dataset.strokes = String(strokes);
    el.dataset.need = String(need);
    el.dataset.fill = fill.toFixed(3);
    el.dataset.armed = armed;
    el.dataset.phase = phase;
  }

  // ---- 펌프 규칙 ----

  function addWater(amount, now) {
    fill = Math.min(1, fill + amount);
    flowAt = now;
    for (let k = 0; k < 5; k++) bubbles.push(newBubble(true));
    // 반 칸씩 더한 값이 소수 오차로 1 에 살짝 못 미치는 일이 있어 여유를 둔다
    if (fill >= 1 - 1e-6 && phase === 'play') win(now);
  }

  function win(now) {
    fill = 1;
    phase = 'done';
    doneAt = now;
    say.textContent = '가득 찼다!';
    el.classList.add('is-fixed');
    ctx.sfx('fixed');
    ctx.buzz([30, 40, 60]);
    mark();
    later(CELEBRATE_MS, finish);
  }

  /** 손잡이를 옮기고 끝에 닿았는지 본다. 내렸다 올리는 한 번에 반 칸씩 두 번 채운다 */
  function moveTo(p, now) {
    if (phase !== 'play') return;
    // 끝을 밀고 있는 손가락도 펌프질 중이다 (손잡이는 멈춰 있어도 탱크가 줄면 안 된다)
    lastMove = now;
    pos = clamp(p, 0, 1);
    if (armed === 'down' && pos >= 1 - END_ZONE) {
      armed = 'up';
      hitBottom = now;
      ctx.sfx('pump');
      ctx.buzz(22);
      addWater(0.5 / need, now);
    } else if (armed === 'up' && pos <= END_ZONE) {
      armed = 'down';
      hitTop = now;
      strokes++;
      ctx.sfx('click');
      ctx.buzz(22);
      addWater(0.5 / need, now);
    }
    mark();
  }

  // ---- 그리기 ----

  function measure() {
    const pad = 12;
    const gripH = clamp(H * 0.11, 40, 52);
    const gripW = clamp(W * 0.38, 104, 150);
    const px = clamp(W * 0.29, gripW / 2 + 14, W);
    const topY = pad + gripH / 2 + 12;
    // 긴 화면에서도 손가락이 오갈 거리는 260px 까지만. 남는 높이는 몸통이 길어져 채운다
    const botY = Math.min(H * 0.72 - gripH / 2 - 12, topY + 260);
    const barrelTop = botY + gripH / 2 + 12;
    const barrelW = clamp(W * 0.15, 40, 60);
    const baseY = H - pad - 6;
    const tankX0 = Math.max(px + gripW / 2 + 16, W * 0.6);
    const tankX1 = W - pad - 2;
    const tankY0 = pad + 8;
    const tankY1 = H - pad - 4;
    const pipeY = baseY - 30;
    return { pad, gripH, gripW, px, topY, botY, barrelTop, barrelW, baseY, tankX0, tankX1, tankY0, tankY1, pipeY };
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
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    geo = measure();
    bubbles.length = 0;
    draw(performance.now(), 0);
    wake();
  }

  function newBubble(burst) {
    const t = geo;
    const iw = t.tankX1 - t.tankX0 - 20;
    const seedish = (bubbles.length * 37 + bubbleSeed) % 100;
    return {
      x: t.tankX0 + 10 + (burst ? 6 + Math.random() * 24 : ((seedish / 100) * 0.6 + Math.random() * 0.4) * iw),
      y: t.tankY1 - 12,
      r: 2 + Math.random() * (burst ? 4 : 2.5),
      vy: 50 + Math.random() * 60,
      wob: Math.random() * TAU,
    };
  }

  function drawPanel() {
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#465e6e');
    base.addColorStop(0.55, '#33495a');
    base.addColorStop(1, '#223340');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    const rr = 3;
    for (const [x, y] of [
      [9, 9],
      [W - 9, 9],
      [9, H - 9],
      [W - 9, H - 9],
    ]) {
      rivet(g, x, y, rr);
    }
  }

  function drawLight(x, y, w, lit, flash) {
    roundRect(g, x - w / 2, y - 4, w, 8, 4);
    if (lit) {
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 14 + flash * 14;
      g.fillStyle = color;
      g.fill();
      g.restore();
      g.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.5 * flash})`;
      roundRect(g, x - w / 2 + 4, y - 2, w - 8, 3, 2);
      g.fill();
    } else {
      g.fillStyle = '#16222a';
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      g.lineWidth = 1;
      g.stroke();
    }
  }

  function chevron(x, y, s, up, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [lw, style] of [
      [s * 0.42, 'rgba(0, 0, 0, 0.55)'],
      [s * 0.26, color],
    ]) {
      g.strokeStyle = style;
      g.lineWidth = lw;
      g.beginPath();
      const d = up ? -1 : 1;
      g.moveTo(x - s, y - d * s * 0.45);
      g.lineTo(x, y + d * s * 0.45);
      g.lineTo(x + s, y - d * s * 0.45);
      g.stroke();
    }
    g.restore();
  }

  function drawPump(now) {
    const t = geo;
    const gy = t.topY + (t.botY - t.topY) * pos;
    // 바닥 받침
    g.fillStyle = '#1a262e';
    roundRect(g, t.px - t.barrelW * 0.95, t.baseY - 10, t.barrelW * 1.9, 14, 5);
    g.fill();
    // 홈 (손잡이가 움직이는 길)
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(g, t.px - 10, t.topY - 6, 20, t.botY - t.topY + 12, 10);
    g.fill();
    // 끝 불빛: 끝에 닿으면 켜진다
    const atTop = pos <= END_ZONE;
    const atBottom = pos >= 1 - END_ZONE;
    const ft = clamp(1 - (now - hitTop) / 350, 0, 1);
    const fb = clamp(1 - (now - hitBottom) / 350, 0, 1);
    drawLight(t.px, t.topY - t.gripH / 2 - 7, t.gripW * 0.9, atTop, ft);
    drawLight(t.px, t.botY + t.gripH / 2 + 7, t.gripW * 0.9, atBottom, fb);
    // 피스톤 막대
    const rodW = 12;
    const rg = g.createLinearGradient(t.px - rodW / 2, 0, t.px + rodW / 2, 0);
    rg.addColorStop(0, '#7b8f9c');
    rg.addColorStop(0.4, '#e3edf2');
    rg.addColorStop(1, '#5b6e7b');
    g.fillStyle = rg;
    g.fillRect(t.px - rodW / 2, gy, rodW, t.barrelTop - gy + 6);
    // 몸통
    const bg = g.createLinearGradient(t.px - t.barrelW / 2, 0, t.px + t.barrelW / 2, 0);
    bg.addColorStop(0, '#4b5f6c');
    bg.addColorStop(0.35, '#a9bcc7');
    bg.addColorStop(1, '#3a4b57');
    g.fillStyle = bg;
    roundRect(g, t.px - t.barrelW / 2, t.barrelTop, t.barrelW, t.baseY - t.barrelTop - 6, 8);
    g.fill();
    g.fillStyle = '#2b3a44';
    roundRect(g, t.px - t.barrelW / 2 - 5, t.barrelTop - 4, t.barrelW + 10, 10, 4);
    g.fill();
    for (const y of [t.barrelTop + 18, t.baseY - 22]) {
      rivet(g, t.px - t.barrelW / 2 + 7, y, 2.4);
      rivet(g, t.px + t.barrelW / 2 - 7, y, 2.4);
    }
    // 가야 할 방향 화살표: 손잡이와 가야 할 끝 사이를 흘러간다
    if (phase === 'play') {
      const up = armed === 'up';
      const from = up ? gy - t.gripH / 2 - 12 : gy + t.gripH / 2 + 12;
      const to = up ? t.topY - t.gripH / 2 : t.botY + t.gripH / 2;
      const span = Math.abs(to - from);
      if (span > 30) {
        const sz = clamp(t.gripW * 0.17, 14, 22);
        const gap = sz * 1.5;
        const n = Math.floor(span / gap);
        const shift = ((now / 520) % 1) * gap;
        for (let k = 0; k < n; k++) {
          const d = k * gap + shift;
          if (d > span - sz * 0.5) continue;
          const y = up ? from - d : from + d;
          const a = 0.35 + 0.65 * (1 - d / span);
          chevron(t.px, y, sz, up, a);
        }
      }
    }
    // T 손잡이
    const gw = t.gripW;
    const gh = t.gripH;
    const lit = clamp(Math.max(1 - (now - hitTop) / 300, 1 - (now - hitBottom) / 300), 0, 1);
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, 0.5)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 4;
    const hg = g.createLinearGradient(0, gy - gh / 2, 0, gy + gh / 2);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.18, color);
    hg.addColorStop(1, rgba(color, 0.55));
    g.fillStyle = '#10181e';
    roundRect(g, t.px - gw / 2, gy - gh / 2, gw, gh, gh / 2);
    g.fill();
    g.restore();
    g.fillStyle = hg;
    roundRect(g, t.px - gw / 2 + 3, gy - gh / 2 + 3, gw - 6, gh - 6, (gh - 6) / 2);
    g.fill();
    // 손잡이 고무 홈 (잡는 곳이라는 표시)
    g.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    g.lineWidth = 3;
    g.beginPath();
    for (let k = -2; k <= 2; k++) {
      const x = t.px + k * gw * 0.13;
      g.moveTo(x, gy - gh * 0.22);
      g.lineTo(x, gy + gh * 0.22);
    }
    g.stroke();
    if (lit > 0) {
      g.fillStyle = `rgba(255, 255, 255, ${0.45 * lit})`;
      roundRect(g, t.px - gw / 2 + 3, gy - gh / 2 + 3, gw - 6, gh - 6, (gh - 6) / 2);
      g.fill();
    }
  }

  function drawPipe(now) {
    const t = geo;
    const x0 = t.px + t.barrelW / 2 - 2;
    const x1 = t.tankX0 + 4;
    const y = t.pipeY;
    const pg = g.createLinearGradient(0, y - 9, 0, y + 9);
    pg.addColorStop(0, '#5f7482');
    pg.addColorStop(0.4, '#c2d1da');
    pg.addColorStop(1, '#3c4e5a');
    g.fillStyle = pg;
    g.fillRect(x0, y - 9, x1 - x0, 18);
    g.fillStyle = '#2b3a44';
    for (const x of [x0 + 6, x1 - 8]) {
      roundRect(g, x - 4, y - 13, 8, 26, 3);
      g.fill();
    }
    // 방금 펌프질했으면 관 속으로 물이 지나가는 것이 비친다
    const k = (now - flowAt) / 450;
    if (k >= 0 && k < 1) {
      g.fillStyle = `rgba(150, 225, 255, ${0.85 * (1 - k)})`;
      for (let i = 0; i < 4; i++) {
        const p = (k * 1.4 + i * 0.22) % 1;
        g.beginPath();
        g.ellipse(x0 + 10 + p * (x1 - x0 - 20), y, 7, 4, 0, 0, TAU);
        g.fill();
      }
    }
  }

  function drawTank(now, dt) {
    const t = geo;
    const x0 = t.tankX0;
    const x1 = t.tankX1;
    const y0 = t.tankY0;
    const y1 = t.tankY1;
    const full = phase === 'done';
    const glow = full ? 0.6 + 0.4 * Math.sin((now - doneAt) / 90) : 0;
    // 쇠 테두리
    g.save();
    if (full) {
      g.shadowColor = color;
      g.shadowBlur = 24 * glow + 8;
    }
    const fg = g.createLinearGradient(x0, 0, x1, 0);
    fg.addColorStop(0, '#56697a');
    fg.addColorStop(0.3, '#a8bac5');
    fg.addColorStop(1, '#3f505d');
    g.fillStyle = full ? color : fg;
    roundRect(g, x0, y0, x1 - x0, y1 - y0, 16);
    g.fill();
    g.restore();
    // 유리 속
    const ix0 = x0 + 8;
    const ix1 = x1 - 8;
    const iy0 = y0 + 8;
    const iy1 = y1 - 8;
    g.fillStyle = '#071722';
    roundRect(g, ix0, iy0, ix1 - ix0, iy1 - iy0, 10);
    g.fill();
    g.save();
    roundRect(g, ix0, iy0, ix1 - ix0, iy1 - iy0, 10);
    g.clip();
    // 물
    const ih = iy1 - iy0;
    const sy = iy1 - shown * ih;
    if (shown > 0.001) {
      const wg = g.createLinearGradient(0, sy, 0, iy1);
      if (full) {
        wg.addColorStop(0, '#ffffff');
        wg.addColorStop(0.12, color);
        wg.addColorStop(1, rgba(color, 0.6));
      } else {
        wg.addColorStop(0, '#7fdcff');
        wg.addColorStop(0.15, '#3aa6d8');
        wg.addColorStop(1, '#14527e');
      }
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(ix0, iy1);
      for (let x = ix0; x <= ix1 + 4; x += 6) {
        g.lineTo(x, sy + Math.sin(x * 0.09 + now * 0.006) * 2.2 * (shown < 1 ? 1 : 0.4));
      }
      g.lineTo(ix1, iy1);
      g.closePath();
      g.fill();
    }
    // 거품
    g.fillStyle = 'rgba(220, 245, 255, 0.75)';
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.vy * dt;
      b.wob += dt * 6;
      if (b.y < sy + b.r) {
        bubbles.splice(i, 1);
        continue;
      }
      g.beginPath();
      g.arc(b.x + Math.sin(b.wob) * 2, b.y, b.r, 0, TAU);
      g.fill();
    }
    // 눈금: 펌프질 한 번에 한 칸
    for (let k = 1; k < need; k++) {
      const y = iy1 - (k / need) * ih;
      const reached = shown >= k / need - 1e-6;
      g.fillStyle = reached ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)';
      g.fillRect(ix0, y - 1.5, (ix1 - ix0) * 0.32, 3);
      g.fillRect(ix1 - (ix1 - ix0) * 0.14, y - 1, (ix1 - ix0) * 0.14, 2);
    }
    // 가득 선
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.setLineDash([8, 6]);
    g.beginPath();
    g.moveTo(ix0, iy0 + 2);
    g.lineTo(ix1, iy0 + 2);
    g.stroke();
    g.setLineDash([]);
    // 유리 반사
    g.fillStyle = 'rgba(255, 255, 255, 0.08)';
    g.fillRect(ix0 + (ix1 - ix0) * 0.62, iy0, (ix1 - ix0) * 0.12, ih);
    g.restore();
    for (const y of [y0 + 4.5, y1 - 4.5]) {
      rivet(g, x0 + 14, y, 2.4);
      rivet(g, x1 - 14, y, 2.4);
    }
  }

  function draw(now, dt) {
    if (!W || !geo) return;
    g.clearRect(0, 0, W, H);
    drawPanel();
    drawPipe(now);
    drawTank(now, dt);
    drawPump(now);
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (phase === 'play' && fill > 0 && now - lastMove > IDLE_MS) {
      fill = Math.max(0, fill - leakRate * dt);
      el.dataset.fill = fill.toFixed(3);
    }
    shown += (fill - shown) * Math.min(1, dt * 12);
    if (Math.abs(fill - shown) < 0.0005) shown = fill;
    if (phase === 'play' && Math.random() < dt * 1.2 && shown > 0.05) bubbles.push(newBubble(false));
    draw(now, dt);
    const settled = phase === 'done' && now - doneAt > 900 && bubbles.length === 0;
    if (!settled) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !alive || !W) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----
  // 판 어디를 잡아도 된다. 손가락이 움직인 만큼 손잡이가 따라간다 (끝을 넘으면 거기서 멈춘다)

  function onDown(e) {
    if (!alive || phase !== 'play' || drag || !geo) return;
    e.preventDefault();
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 이미 끝난 포인터 */
    }
    drag = { id: e.pointerId, y: e.clientY };
    lastMove = performance.now();
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y;
    drag.y = e.clientY;
    moveTo(pos + dy / (geo.botY - geo.topY), performance.now());
    wake();
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
  layout();
  mark();

  if (DEBUG) {
    window.__hsPump = {
      geom: () => {
        if (!geo) return null;
        const b = cv.getBoundingClientRect();
        return { x: b.left + geo.px, top: b.top + geo.topY, bottom: b.top + geo.botY, grip: b.top + geo.topY + (geo.botY - geo.topY) * pos, H: geo.gripH, W: geo.gripW };
      },
      state: () => ({ pos, armed, strokes, fill, need, phase }),
    };
  }

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
      if (DEBUG && window.__hsPump) delete window.__hsPump;
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      strokes = Math.max(strokes, need);
      pos = 0;
      armed = 'down';
      if (phase === 'play') win(performance.now());
      shown = 1;
      draw(performance.now(), 0);
      finish();
    },
  };
}
