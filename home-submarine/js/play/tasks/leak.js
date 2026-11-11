// 수리 놀이: 물 새는 곳 막기.
// 리벳 박힌 강철 벽 여기저기서 물줄기가 뿜어져 나온다. 구멍을 누르면 둥근 철판이 탁 붙어 막힌다.
// 한 번에 1~3개만 열려 있고, 하나를 막으면 잠깐 뒤 다른 곳이 터진다. 규격은 index.js 참고.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';
import { makeRng } from '../../shared/prng.js';

const TAU = Math.PI * 2;
const TOTAL = [5, 7, 9];
const MAX_OPEN = [2, 2, 3];
const BIG_COUNT = [0, 0, 3];
const CELEBRATE_MS = 420;
// 구멍 자리: 3개와 2개가 엇갈린 다섯 줄(13자리). 엇갈려 놓아야 세로가 짧은 벽에서도
// 이웃 구멍이 60px 넘게 떨어진다 (가장 작은 놀이 상자 300×360 의 벽에서 가장 가까운 두 자리가 약 63px).
const ROWS_Y = [0.1, 0.255, 0.41, 0.565, 0.72];
const ROW3_X = [0.15, 0.5, 0.85];
const ROW2_X = [0.325, 0.675];
const JITTER = 8; // 자리마다 ±0.008 만큼 흔든다 (줄 맞춘 티가 덜 나게. 더 키우면 60px 를 못 지킨다)
const MIN_REACH = 32; // 누르는 곳 반지름. 지름 64px
const MAX_BITS = 140;

const CSS = `
.tk-leak { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 8px; user-select: none; -webkit-user-select: none; }
.tk-leak-top { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 2px; }
.tk-leak-say { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.2; white-space: nowrap; }
.tk-leak.is-fixed .tk-leak-say { color: var(--green); }
.tk-leak-count { flex: none; min-width: 84px; padding: 4px 12px; border-radius: 10px; text-align: center; font: 900 22px/1.2 var(--mono); color: var(--c); background: rgba(0, 0, 0, 0.38); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 45%, transparent); white-space: nowrap; }
.tk-leak-wrap { position: relative; flex: 1 1 0; min-height: 220px; border-radius: 14px; overflow: hidden; background: #22323d; box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.45), 0 4px 14px rgba(0, 0, 0, 0.35); }
.tk-leak-wrap canvas { position: absolute; left: 0; top: 0; touch-action: none; }
`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeBack = (k) => {
  const c = 1.8;
  const t = k - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};

function slotList() {
  const out = [];
  ROWS_Y.forEach((y, r) => {
    for (const x of r % 2 ? ROW2_X : ROW3_X) out.push({ x, y });
  });
  return out;
}

/** 구멍 배치와 순서. 모두 ctx.rng 로 정해 같은 씨앗이면 같은 문제가 나온다 */
function makeHoles(rng, level) {
  const total = TOTAL[level];
  const slots = rng.shuffle(slotList()).slice(0, total);
  // 첫 구멍은 늘 작은 구멍: 한 번 눌러 막는 것부터 익힌다
  const rest = [];
  for (let i = 1; i < total; i++) rest.push(i);
  const big = new Set(rng.sample(rest, BIG_COUNT[level]));
  const jit = () => (rng.int(JITTER * 2 + 1) - JITTER) / 1000;
  return slots.map((s, i) => {
    const x = s.x + jit();
    const y = s.y + jit();
    // 물줄기는 벽 가운데 쪽으로 뿜는다 (밖으로 뿜으면 바로 화면 밖으로 나간다)
    const dir = s.x < 0.5 ? 1 : s.x > 0.5 ? -1 : rng.bool() ? 1 : -1;
    return {
      i,
      x,
      y,
      big: big.has(i),
      need: big.has(i) ? 2 : 1,
      hits: 0,
      state: 'wait',
      openAt: 0,
      hitAt: 0,
      dir,
      speed: 0.85 + rng.int(31) / 100,
      lift: 0.25 + rng.int(56) / 100,
      phase: rng.int(1000) / 1000,
      edge: Array.from({ length: 11 }, () => 0.78 + rng.int(37) / 100),
      spin: (rng.int(360) * Math.PI) / 180,
    };
  });
}

export function mount(root, ctx) {
  ensureStyle('hs-task-leak', CSS);
  const rng = ctx.rng;
  const level = clamp(Number(ctx.data && ctx.data.level) || 0, 0, 2);
  const color = ctx.color || '#4cc9f0';
  const total = TOTAL[level];
  const maxOpen = MAX_OPEN[level];
  const holes = makeHoles(rng, level);
  const delays = holes.map(() => 300 + rng.int(301));
  const wallSeed = rng.next();

  let alive = true;
  let finished = false;
  let phase = 'play';
  let plugged = 0;
  let next = 0;
  let pending = 0;
  let water = 0.25;
  let doneAt = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let raf = 0;
  let lastNow = 0;
  const timers = new Set();
  const bits = [];
  const ripples = [];

  const say = h('p', { class: 'tk-leak-say', text: '구멍을 막아' });
  const count = h('div', { class: 'tk-leak-count', 'aria-live': 'polite' });
  const cv = h('canvas', { role: 'img', 'aria-label': '물이 새는 강철 벽' });
  const wrap = h('div', { class: 'tk-leak-wrap' }, cv);
  const el = h('div', { class: 'tk-leak', style: { '--c': color } }, h('div', { class: 'tk-leak-top' }, say, count), wrap);
  root.append(el);
  const g = cv.getContext('2d');
  const bg = document.createElement('canvas');
  const bgg = bg.getContext('2d');

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

  const openCount = () => holes.reduce((n, o) => n + (o.state === 'open' ? 1 : 0), 0);

  function updateTop() {
    count.textContent = `${plugged} / ${total}`;
    el.dataset.plugged = String(plugged);
    el.dataset.total = String(total);
    el.dataset.open = String(openCount());
    el.dataset.phase = phase;
  }

  // 자리는 0~1 비율로 정해 두고, 그릴 때 가장자리 여백(최소 px)을 뺀 칸 안에 펼친다.
  // 비율만 쓰면 낮은 벽에서 위 줄 구멍 고리가 테두리에 잘린다
  function hx(o) {
    const m = Math.max(W * ROW3_X[0], 40);
    return m + ((o.x - ROW3_X[0]) / (ROW3_X[2] - ROW3_X[0])) * (W - 2 * m);
  }

  function hy(o) {
    const top = Math.max(H * ROWS_Y[0], 44);
    const bottom = H * ROWS_Y[ROWS_Y.length - 1];
    return top + ((o.y - ROWS_Y[0]) / (ROWS_Y[ROWS_Y.length - 1] - ROWS_Y[0])) * (bottom - top);
  }

  function radius(o) {
    const base = clamp(Math.min(W, H) * 0.048, 12, 19);
    return o.big ? base * 1.45 : base;
  }

  // ---- 구멍 열고 막기 ----

  function openHole(o) {
    if (!alive || phase !== 'play' || o.state !== 'wait') return;
    o.state = 'open';
    o.openAt = performance.now();
    ctx.sfx('water');
    // 터질 때 물방울이 튄다
    for (let k = 0; k < 10; k++) spawnBit(hx(o), hy(o), (Math.random() - 0.5) * 220, -60 - Math.random() * 140);
    updateTop();
    wake();
  }

  /** 열린 구멍이 한도보다 적으면 다음 구멍을 0.3~0.6초 뒤에 연다 */
  function refill() {
    while (phase === 'play' && next < total && openCount() + pending < maxOpen) {
      const o = holes[next];
      const wait = delays[next];
      next++;
      pending++;
      later(wait, () => {
        pending--;
        openHole(o);
      });
    }
  }

  function hit(o, now) {
    o.hits++;
    o.hitAt = now;
    const R = radius(o);
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * TAU;
      spawnBit(hx(o) + Math.cos(a) * R, hy(o) + Math.sin(a) * R, Math.cos(a) * 160, Math.sin(a) * 160 - 40);
    }
    ctx.sfx('click');
    if (o.hits < o.need) {
      // 큰 구멍: 작은 철판이 반쯤 걸려 물줄기만 가늘어진다
      ctx.buzz(15);
      return;
    }
    o.state = 'plugged';
    plugged++;
    ctx.buzz(28);
    updateTop();
    if (plugged >= total) win(now);
    else refill();
  }

  function win(now) {
    phase = 'done';
    doneAt = now;
    say.textContent = '막았다!';
    el.classList.add('is-fixed');
    updateTop();
    ctx.sfx('fixed');
    ctx.buzz([30, 40, 60]);
    later(CELEBRATE_MS, finish);
  }

  // ---- 그리기 ----

  function layout() {
    const w = Math.floor(wrap.clientWidth);
    const hh = Math.floor(wrap.clientHeight);
    if (w < 40 || hh < 40 || (w === W && hh === H)) return;
    W = w;
    H = hh;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, bg]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgg.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintWall();
    draw(performance.now());
    wake();
  }

  function rivet(c, x, y, r) {
    c.fillStyle = 'rgba(0, 0, 0, 0.45)';
    c.beginPath();
    c.arc(x + 0.8, y + 1.2, r, 0, TAU);
    c.fill();
    const gr = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#d5e2ea');
    gr.addColorStop(0.5, '#7d93a2');
    gr.addColorStop(1, '#3b4e5b');
    c.fillStyle = gr;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  }

  /** 움직이지 않는 벽은 한 번만 그려 두고 매 장면 그대로 붙인다 */
  function paintWall() {
    const c = bgg;
    const r = makeRng(wallSeed);
    const base = c.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#465e6e');
    base.addColorStop(0.55, '#33495a');
    base.addColorStop(1, '#223340');
    c.fillStyle = base;
    c.fillRect(0, 0, W, H);
    // 철판 2×3 장. 판마다 빛이 조금씩 다르게 든다
    const cols = 2;
    const rows = 3;
    const pw = W / cols;
    const ph = H / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * pw;
        const y = j * ph;
        const sheen = c.createLinearGradient(x, y, x + pw, y + ph);
        const a = 0.04 + r.int(6) / 100;
        sheen.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        sheen.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
        sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        c.fillStyle = sheen;
        c.fillRect(x, y, pw, ph);
        // 긁힌 자국
        c.strokeStyle = 'rgba(210, 230, 240, 0.07)';
        c.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const sx = x + (r.int(100) / 100) * pw;
          const sy = y + (r.int(100) / 100) * ph;
          c.beginPath();
          c.moveTo(sx, sy);
          c.lineTo(sx + 14 + r.int(26), sy + r.int(9) - 4);
          c.stroke();
        }
      }
    }
    // 이음매: 어두운 홈 + 밝은 턱
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    c.beginPath();
    for (let i = 1; i < cols; i++) {
      c.moveTo(i * pw, 0);
      c.lineTo(i * pw, H);
    }
    for (let j = 1; j < rows; j++) {
      c.moveTo(0, j * ph);
      c.lineTo(W, j * ph);
    }
    c.stroke();
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    c.beginPath();
    for (let i = 1; i < cols; i++) {
      c.moveTo(i * pw + 2, 0);
      c.lineTo(i * pw + 2, H);
    }
    for (let j = 1; j < rows; j++) {
      c.moveTo(0, j * ph + 2);
      c.lineTo(W, j * ph + 2);
    }
    c.stroke();
    // 이음매를 따라 리벳
    const rr = clamp(Math.min(W, H) * 0.009, 2.2, 3.4);
    const stepX = pw / Math.max(3, Math.round(pw / 28));
    for (let j = 0; j <= rows; j++) {
      const y = clamp(j * ph, 7, H - 7);
      for (let x = stepX / 2; x < W; x += stepX) {
        rivet(c, x, y + (j === 0 ? 0 : j === rows ? 0 : -6), rr);
        if (j > 0 && j < rows) rivet(c, x, y + 8, rr);
      }
    }
    const stepY = ph / Math.max(3, Math.round(ph / 28));
    for (let i = 0; i <= cols; i++) {
      const x = clamp(i * pw, 7, W - 7);
      for (let y = stepY / 2; y < H; y += stepY) {
        if (i > 0 && i < cols) {
          rivet(c, x - 6, y, rr);
          rivet(c, x + 8, y, rr);
        } else rivet(c, x, y, rr);
      }
    }
    // 가장자리를 어둡게 눌러 벽이 화면 안쪽으로 들어가 보이게 한다
    const vg = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
  }

  function blob(cx, cy, r, edge, spin) {
    g.beginPath();
    const n = edge.length;
    for (let k = 0; k <= n; k++) {
      const a = spin + (k / n) * TAU;
      const rr = r * edge[k % n];
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  function drawHole(o, now) {
    const cx = hx(o);
    const cy = hy(o);
    const R = radius(o);
    const k = clamp((now - o.openAt) / 170, 0, 1);
    const r = R * easeBack(k);
    // 눌러야 할 곳: 구역 색 고리가 두근거린다
    const pulse = 0.5 + 0.5 * Math.sin(now / 150 + o.phase * TAU);
    g.strokeStyle = color;
    g.globalAlpha = (0.45 + 0.45 * pulse) * k;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, R * 1.9 + pulse * 3, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
    // 찢어져 밖으로 휜 철판 입술
    blob(cx, cy, r * 1.32, o.edge, o.spin + 0.3);
    g.fillStyle = '#6f8594';
    g.fill();
    g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    g.lineWidth = 1.5;
    g.stroke();
    // 깜깜한 구멍 속
    blob(cx, cy, r, o.edge, o.spin);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.1);
    gr.addColorStop(0, '#000');
    gr.addColorStop(0.75, '#081118');
    gr.addColorStop(1, '#1d2c36');
    g.fillStyle = gr;
    g.fill();
    // 안쪽에 물빛이 비친다
    g.strokeStyle = 'rgba(120, 210, 255, 0.45)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r * 0.55, -2.4, -1.2);
    g.stroke();
    if (o.hits > 0) drawPlate(cx + R * 0.38 * o.dir, cy - R * 0.2, R * 1.12, now - o.hitAt, 2, false);
  }

  /** 둥근 철판. age 는 붙은 지 지난 ms (붙을 때 커졌다 줄어든다) */
  function drawPlate(cx, cy, pr, age, bolts, rim) {
    const k = clamp(age / 140, 0, 1);
    const s = 1 + (1 - easeOut(k)) * 0.45;
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);
    g.fillStyle = 'rgba(0, 0, 0, 0.4)';
    g.beginPath();
    g.arc(2, 3.5, pr, 0, TAU);
    g.fill();
    const gr = g.createRadialGradient(-pr * 0.35, -pr * 0.45, pr * 0.1, 0, 0, pr);
    gr.addColorStop(0, '#e2ecf1');
    gr.addColorStop(0.55, '#93a8b5');
    gr.addColorStop(1, '#566b79');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, pr, 0, TAU);
    g.fill();
    if (rim) {
      g.strokeStyle = color;
      g.lineWidth = 3;
      g.stroke();
    }
    g.strokeStyle = 'rgba(40, 55, 65, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(0, 0, pr * 0.84, 0, TAU);
    g.stroke();
    const br = Math.max(1.8, pr * 0.1);
    for (let b = 0; b < bolts; b++) {
      const a = -Math.PI / 2 + (b / bolts) * TAU + 0.4;
      rivet(g, Math.cos(a) * pr * 0.66, Math.sin(a) * pr * 0.66, br);
    }
    g.restore();
    // 붙는 순간 하얀 고리가 퍼진다
    if (age < 260) {
      const p = age / 260;
      g.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - p)})`;
      g.lineWidth = 3 * (1 - p) + 1;
      g.beginPath();
      g.arc(cx, cy, pr * (1 + p * 0.9), 0, TAU);
      g.stroke();
    }
  }

  function surfaceY() {
    return H - (0.035 + 0.13 * water) * H;
  }

  /** 물줄기: 포물선을 따라 흐르는 굵은 줄 + 그 위를 달리는 물방울 */
  function drawJet(o, now) {
    const S = Math.min(W, H) / 320;
    const R = radius(o);
    const grow = clamp((now - o.openAt) / 260, 0, 1);
    const thin = o.hits > 0 ? 0.35 : 1;
    const width = R * (o.big ? 0.62 : 0.5) * thin;
    const cx = hx(o) + (o.hits > 0 ? -o.dir * R * 0.55 : 0);
    const cy = hy(o) + (o.hits > 0 ? R * 0.2 : 0);
    const vx = o.dir * 120 * o.speed * S * (o.hits > 0 ? 0.75 : 1);
    const vy = -110 * o.lift * S;
    const gy = 760 * S;
    const sy = surfaceY();
    const tFall = (-vy + Math.sqrt(vy * vy + 2 * gy * Math.max(0, sy - cy))) / gy;
    const tWall = (o.dir > 0 ? W - 6 - cx : cx - 6) / Math.abs(vx);
    const tEnd = Math.min(tFall, tWall) * grow;
    const at = (t) => [cx + vx * t, cy + vy * t + 0.5 * gy * t * t];
    const N = 22;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [lw, style] of [
      [width * 1.9, 'rgba(90, 180, 235, 0.22)'],
      [width, 'rgba(140, 215, 255, 0.7)'],
      [width * 0.38, 'rgba(235, 250, 255, 0.85)'],
    ]) {
      g.strokeStyle = style;
      g.lineWidth = lw;
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const [x, y] = at((k / N) * tEnd);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // 줄을 따라 달리는 물방울이 "뿜는" 느낌을 준다
    const drops = o.hits > 0 ? 6 : 12;
    g.fillStyle = 'rgba(215, 242, 255, 0.9)';
    for (let k = 0; k < drops; k++) {
      const s = (now / 1000 * 1.7 + k / drops + o.phase) % 1;
      const [x, y] = at(s * tEnd);
      const wob = Math.sin(k * 12.9 + now / 80) * width * 0.6;
      g.beginPath();
      g.arc(x + wob * 0.3, y + wob, Math.max(1, width * 0.42 * (1 - s * 0.5)), 0, TAU);
      g.fill();
    }
    // 떨어진 자리에서 물이 튄다
    if (grow >= 1 && Math.random() < (o.hits > 0 ? 0.25 : 0.6)) {
      const [x, y] = at(tEnd);
      spawnBit(x, y, (Math.random() - 0.5) * 120, -50 - Math.random() * 110);
    }
  }

  function drawWater(now) {
    const sy = surfaceY();
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = sy + Math.sin(x * 0.045 + now * 0.004) * 2.6 + Math.sin(x * 0.11 - now * 0.006) * 1.3;
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    const gr = g.createLinearGradient(0, sy - 4, 0, H);
    gr.addColorStop(0, 'rgba(76, 201, 240, 0.6)');
    gr.addColorStop(1, 'rgba(6, 50, 90, 0.88)');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(205, 242, 255, 0.7)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = sy + Math.sin(x * 0.045 + now * 0.004) * 2.6 + Math.sin(x * 0.11 - now * 0.006) * 1.3;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  function spawnBit(x, y, vx, vy) {
    if (bits.length >= MAX_BITS) return;
    bits.push({ x, y, vx, vy, life: 0, max: 0.3 + Math.random() * 0.3, r: 1.4 + Math.random() * 2 });
  }

  function drawBits(dt) {
    const sy = surfaceY();
    g.fillStyle = 'rgba(200, 238, 255, 0.85)';
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life += dt;
      b.vy += 620 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life >= b.max || (b.vy > 0 && b.y > sy + 6)) {
        bits.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - b.life / b.max;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawRipples(now) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = (now - ripples[i].at) / 240;
      if (p >= 1) {
        ripples.splice(i, 1);
        continue;
      }
      g.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - p)})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(ripples[i].x, ripples[i].y, 6 + p * 16, 0, TAU);
      g.stroke();
    }
  }

  function draw(now, dt = 0) {
    if (!W) return;
    g.clearRect(0, 0, W, H);
    g.drawImage(bg, 0, 0, W, H);
    const age = doneAt ? now - doneAt : 0;
    for (const o of holes) {
      if (o.state === 'plugged') {
        drawPlate(hx(o), hy(o), radius(o) * 1.7, now - o.hitAt, o.big ? 6 : 5, true);
        if (doneAt && age < 600) {
          // 다 막으면 철판들이 구역 색으로 한 번 번쩍인다
          g.save();
          g.globalAlpha = 0.6 * (1 - age / 600);
          g.fillStyle = color;
          g.beginPath();
          g.arc(hx(o), hy(o), radius(o) * 1.7, 0, TAU);
          g.fill();
          g.restore();
        }
      } else if (o.state === 'open') drawHole(o, now);
    }
    for (const o of holes) if (o.state === 'open') drawJet(o, now);
    drawWater(now);
    drawBits(dt);
    drawRipples(now);
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (phase === 'play') {
      const n = openCount();
      // 새는 곳이 많을수록 바닥 물이 빨리 찬다. 다 막혀 있으면 조금씩 빠진다 (실패는 없다)
      water = clamp(water + (n ? n * 0.035 : -0.06) * dt, 0, 1);
    } else water = Math.max(0, water - 0.9 * dt);
    draw(now, dt);
    const settled = phase === 'done' && water <= 0 && bits.length === 0 && now - doneAt > 700;
    if (!settled) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !alive || !W) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function onDown(e) {
    if (!alive || phase !== 'play' || !W) return;
    e.preventDefault();
    const b = cv.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    let best = null;
    let bestD = Infinity;
    for (const o of holes) {
      if (o.state !== 'open') continue;
      const d = Math.hypot(x - hx(o), y - hy(o));
      if (d <= Math.max(MIN_REACH, radius(o) * 2.1) && d < bestD) {
        best = o;
        bestD = d;
      }
    }
    const now = performance.now();
    // 빈 곳을 눌러도 실수가 아니다. 눌린 자리만 살짝 보여 준다
    if (best) hit(best, now);
    else ripples.push({ x, y, at: now });
    wake();
  }

  cv.addEventListener('pointerdown', onDown);
  const ro = new ResizeObserver(() => {
    if (alive) layout();
  });
  ro.observe(wrap);
  layout();

  // 첫 구멍은 바로, 나머지는 조금씩 늦게 터진다
  const first = Math.min(maxOpen, total);
  for (let i = 0; i < first; i++) {
    const o = holes[i];
    next++;
    if (i === 0) openHole(o);
    else {
      pending++;
      later(i * 260, () => {
        pending--;
        openHole(o);
      });
    }
  }
  updateTop();

  if (DEBUG) {
    window.__hsLeak = {
      holes: () => {
        const b = cv.getBoundingClientRect();
        return holes.map((o) => ({ i: o.i, x: b.left + hx(o), y: b.top + hy(o), big: o.big, need: o.need, hits: o.hits, state: o.state, r: radius(o) }));
      },
      size: () => ({ W, H }),
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
      if (DEBUG && window.__hsLeak) delete window.__hsLeak;
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      const now = performance.now();
      for (const o of holes) {
        o.hits = o.need;
        if (o.state !== 'plugged') {
          o.state = 'plugged';
          o.hitAt = now;
        }
      }
      plugged = total;
      if (phase === 'play') win(now);
      draw(now);
      finish();
    },
  };
}
