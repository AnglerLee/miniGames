// 수리 놀이: 배관 잇기.
// 격자에 배관 조각(직선, ㄱ자, T자)이 흩어져 있다. 조각을 누르면 시계 방향으로 90도 돈다.
// 왼쪽 위 물통에서 나온 물이 이어진 조각을 따라 차오르고, 오른쪽 아래 빈 물통까지 이어지면 끝난다.
// 규격은 index.js 참고.
import { h, ensureStyle } from '../../shared/dom.js';

const TAU = Math.PI * 2;
const SIZES = [[3, 3], [3, 4], [4, 4]]; // [가로, 세로]
// 풀려면 꼭 돌려야 하는 최소 횟수의 범위. 너무 적으면 놀이가 안 되고, 많으면 15초를 넘긴다
const TAPS = [[3, 5], [4, 7], [6, 8]];
const EXTRA = [2, 2, 4]; // 정답 길이 최단 길보다 이만큼까지 돌아가도 된다
const WET_STEP = 45; // 물이 한 칸 나아가는 데 걸리는 시간(ms)
const CELEBRATE_MS = 420;
const GREEN = '#7bed9f';

const N = 1;
const E = 2;
const S = 4;
const W = 8;
const SIDES = [N, E, S, W];
const STEP = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };
const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
// 돌리지 않은 모양. 한 번 누를 때마다 열린 쪽이 시계 방향으로 한 칸씩 옮겨 간다
const BASE = { I: N | S, L: N | E, T: E | S | W };

const rot1 = (m) => ((m << 1) & 15) | (m >> 3);
function rotN(m, k) {
  for (let i = 0; i < (((k % 4) + 4) % 4); i++) m = rot1(m);
  return m;
}
const maskOf = (c) => rotN(BASE[c.type], c.rot);

/** 이 조각을 몇 번 더 눌러야 need 쪽이 모두 열리는지 (안 되면 -1) */
function tapsTo(c, need) {
  for (let k = 0; k < 4; k++) if ((rotN(BASE[c.type], c.rot + k) & need) === need) return k;
  return -1;
}

/** 입구(0번 칸 위)에서 물을 흘려 보낸다. 닿은 칸의 [번호, 앞 칸] 을 닿은 순서대로 돌려준다. */
function flood(cells, cols, rows) {
  const out = [];
  if (!(maskOf(cells[0]) & N)) return out;
  const seen = new Set([0]);
  const queue = [[0, -1]];
  while (queue.length) {
    const [i, from] = queue.shift();
    out.push([i, from]);
    const m = maskOf(cells[i]);
    const x = i % cols;
    const y = (i / cols) | 0;
    for (const s of SIDES) {
      if (!(m & s)) continue;
      const nx = x + STEP[s][0];
      const ny = y + STEP[s][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (seen.has(j) || !(maskOf(cells[j]) & OPP[s])) continue;
      seen.add(j);
      queue.push([j, i]);
    }
  }
  return out;
}

function isSolved(cells, cols, rows) {
  const goal = cols * rows - 1;
  return !!(maskOf(cells[goal]) & S) && flood(cells, cols, rows).some(([i]) => i === goal);
}

/**
 * 가장 적게 눌러서 푸는 방법. 입구에서 출구까지 같은 칸을 두 번 지나지 않는 길을 모두 따져 본다 (최대 4×4 라 금방 끝난다).
 * 물이 갈라져 흘러도 출구에 닿으려면 결국 이런 길 하나가 이어져 있어야 하므로 이것이 진짜 최소다.
 */
function bestPlan(cells, cols, rows) {
  const goal = cols * rows - 1;
  const seen = new Uint8Array(cols * rows);
  const plan = [];
  let best = Infinity;
  let bestSteps = null;
  const go = (i, inSide, cost) => {
    if (cost >= best) return;
    seen[i] = 1;
    const x = i % cols;
    const y = (i / cols) | 0;
    for (const out of SIDES) {
      if (out === inSide) continue;
      const k = tapsTo(cells[i], inSide | out);
      if (k < 0) continue;
      if (i === goal && out === S) {
        if (cost + k < best) {
          best = cost + k;
          bestSteps = [...plan, [i, k]];
        }
        continue;
      }
      const nx = x + STEP[out][0];
      const ny = y + STEP[out][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (seen[j]) continue;
      plan.push([i, k]);
      go(j, OPP[out], cost + k);
      plan.pop();
    }
    seen[i] = 0;
  };
  go(0, N, 0);
  return { taps: best, steps: bestSteps || [] };
}

/** 왼쪽 위에서 오른쪽 아래까지 칸을 겹치지 않고 지나는 길 하나 (maxLen 칸 이하) */
function randomPath(rng, cols, rows, maxLen) {
  const goal = cols * rows - 1;
  const seen = new Set([0]);
  const path = [0];
  const dfs = (i) => {
    if (i === goal) return true;
    const x = i % cols;
    const y = (i / cols) | 0;
    // 남은 거리로는 길이 안에 도착할 수 없으면 일찍 접는다
    if (path.length + (cols - 1 - x) + (rows - 1 - y) > maxLen) return false;
    for (const s of rng.shuffle(SIDES)) {
      const nx = x + STEP[s][0];
      const ny = y + STEP[s][1];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (seen.has(j)) continue;
      seen.add(j);
      path.push(j);
      if (dfs(j)) return true;
      seen.delete(j);
      path.pop();
    }
    return false;
  };
  dfs(0);
  return path;
}

function sideTo(cols, a, b) {
  const d = b - a;
  if (d === 1) return E;
  if (d === -1) return W;
  return d > 0 ? S : N;
}

/** 문제 만들기: 길을 하나 정하고, 길에 맞는 조각을 놓고, 나머지는 아무 조각으로 채운 뒤 모두 돌려 섞는다. */
function makePuzzle(rng, level) {
  const [cols, rows] = SIZES[level];
  const [minT, maxT] = TAPS[level];
  const shortest = cols + rows - 1;
  let fallback = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const path = randomPath(rng, cols, rows, shortest + EXTRA[level]);
    const cells = [];
    for (let i = 0; i < cols * rows; i++) {
      const r = rng.int(10);
      cells.push({ type: r < 3 ? 'I' : r < 7 ? 'L' : 'T', rot: 0, onPath: false });
    }
    path.forEach((i, k) => {
      const inSide = k === 0 ? N : OPP[sideTo(cols, path[k - 1], i)];
      const outSide = k === path.length - 1 ? S : sideTo(cols, i, path[k + 1]);
      const straight = (inSide | outSide) === (N | S) || (inSide | outSide) === (E | W);
      // 길 위에도 가끔 T자를 섞어야 "길 조각은 직선과 ㄱ자뿐"이라는 눈치로 풀리지 않는다
      cells[i].type = rng.int(4) === 0 ? 'T' : straight ? 'I' : 'L';
      cells[i].onPath = true;
    });
    for (const c of cells) c.rot = rng.int(4);
    if (isSolved(cells, cols, rows)) continue;
    const plan = bestPlan(cells, cols, rows);
    if (!Number.isFinite(plan.taps)) continue;
    if (!fallback || plan.taps > fallback.plan.taps) fallback = { cells, plan };
    if (plan.taps >= minT && plan.taps <= maxT) return { cols, rows, cells, plan };
  }
  // 여기까지 오는 일은 사실상 없다 (씨앗 수천 개를 돌려 확인). 그래도 풀 수 있는 문제 하나는 돌려준다
  return { cols, rows, cells: fallback.cells, plan: fallback.plan };
}

const CSS = `
.tk-pipes { --tk-c: #4cc9f0; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 6px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.tk-pipes-line { flex: none; display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 42px; font-size: 26px; font-weight: 900; line-height: 1.1; color: var(--text); white-space: nowrap; }
.tk-pipes-line b { width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--tk-c); box-shadow: 0 0 12px var(--tk-c); }
.tk-pipes-line.is-done { color: var(--green); }
.tk-pipes-wrap { position: relative; flex: 1 1 0; min-height: 0; }
.tk-pipes-wrap canvas { position: absolute; left: 0; top: 0; touch-action: none; }
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
  ensureStyle('hs-task-pipes', CSS);
  const level = Math.max(0, Math.min(2, Math.round(Number(ctx.data && ctx.data.level) || 0)));
  const color = ctx.color || '#4cc9f0';
  const { cols, rows, cells, plan } = makePuzzle(ctx.rng, level);
  const goal = cols * rows - 1;
  for (const c of cells) {
    c.shown = c.rot; // 화면에 보이는 각도(90도 단위). 눌린 각도를 부드럽게 따라간다
    c.turns = c.rot; // 누른 횟수를 쌓은 값 (0~3 으로 접지 않아야 3→0 에서 거꾸로 돌지 않는다)
    c.wetAt = null; // 물이 이 칸에 닿는 시각
    c.wet = 0;
    c.flash = 0;
  }

  let alive = true;
  let finished = false;
  let solved = false;
  let arriveAt = 0; // 출구에 물이 닿는 시각
  let fxAt = 0;
  let tank = 0;
  let spill = [];
  let raf = 0;
  let lastNow = performance.now();
  const timers = new Set();

  let Wd = 0;
  let Hd = 0;
  let dpr = 1;
  let C = 0;
  let gx = 0;
  let gy = 0;
  let bgCv = null;

  const line = h('p', { class: 'tk-pipes-line' }, h('b', { 'aria-hidden': 'true' }), h('span', { text: '물길을 이어' }));
  const cv = h('canvas', { role: 'img', 'aria-label': '배관 조각 격자' });
  const wrap = h('div', { class: 'tk-pipes-wrap' }, cv);
  const el = h('div', { class: 'tk-pipes', style: { '--tk-c': color } }, line, wrap);
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

  function sync() {
    el.dataset.cols = String(cols);
    el.dataset.rows = String(rows);
    el.dataset.types = cells.map((c) => c.type).join('');
    el.dataset.rots = cells.map((c) => c.rot).join('');
    el.dataset.path = cells.map((c) => (c.onPath ? 1 : 0)).join('');
    el.dataset.minTaps = String(plan.taps);
    el.dataset.solved = solved ? '1' : '0';
  }

  /** 물이 어디까지 닿는지 다시 계산한다. 새로 닿는 칸은 이미 젖은 앞 칸에서부터 한 칸씩 차례로 젖는다. */
  function reflow(now) {
    const reached = flood(cells, cols, rows);
    const hit = new Set(reached.map(([i]) => i));
    cells.forEach((c, i) => {
      if (!hit.has(i)) c.wetAt = null;
    });
    for (const [i, from] of reached) {
      const c = cells[i];
      if (c.wetAt !== null) continue;
      const base = from < 0 ? now : Math.max(now, cells[from].wetAt);
      c.wetAt = base + WET_STEP;
    }
    if (!solved && hit.has(goal) && maskOf(cells[goal]) & S) {
      solved = true;
      arriveAt = cells[goal].wetAt + WET_STEP;
      line.classList.add('is-done');
      later(Math.max(0, arriveAt - now), celebrate);
    }
  }

  function celebrate() {
    if (fxAt) return;
    fxAt = performance.now();
    spill = [];
    for (let i = 0; i < 14; i++) spill.push({ x: (Math.random() - 0.5) * 0.3, y: 0, vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random() * 1.4, t: 0 });
    ctx.sfx('water');
    ctx.buzz([20, 30, 60]);
    later(150, () => ctx.sfx('fixed'));
    later(CELEBRATE_MS, finish);
  }

  function tap(i) {
    const c = cells[i];
    c.rot = (c.rot + 1) % 4;
    c.turns += 1;
    c.flash = 1;
    ctx.sfx('click');
    ctx.buzz(8);
    reflow(performance.now());
    sync();
  }

  // ---- 크기 ----

  function layout() {
    const w = Math.floor(wrap.clientWidth);
    const hh = Math.floor(wrap.clientHeight);
    if (w < 40 || hh < 40 || (w === Wd && hh === Hd)) return;
    Wd = w;
    Hd = hh;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(Wd * dpr);
    cv.height = Math.round(Hd * dpr);
    cv.style.width = Wd + 'px';
    cv.style.height = Hd + 'px';
    // 위아래 물통 자리(칸의 0.62배씩)까지 넣어서 칸 크기를 정한다
    C = Math.floor(Math.min((Wd - 16) / cols, (Hd - 24) / (rows + 1.24), 116));
    gx = Math.round((Wd - cols * C) / 2);
    gy = Math.round((Hd - rows * C) / 2);
    cv.dataset.gx = String(gx);
    cv.dataset.gy = String(gy);
    cv.dataset.cell = String(C);
    bgCv = renderBg();
  }

  function renderBg() {
    const [c, o] = sprite(Wd, Hd, dpr);
    plate(o, Wd, Hd);
    // 조각이 끼워지는 움푹한 판
    o.fillStyle = '#071822';
    roundRect(o, gx - 5, gy - 5, cols * C + 10, rows * C + 10, 10);
    o.fill();
    for (let i = 0; i < cols * rows; i++) {
      const x = gx + (i % cols) * C;
      const y = gy + ((i / cols) | 0) * C;
      const m = Math.max(2, C * 0.035);
      const grad = o.createLinearGradient(x, y, x, y + C);
      grad.addColorStop(0, '#2f5b76');
      grad.addColorStop(1, '#1a3a4f');
      o.fillStyle = grad;
      roundRect(o, x + m, y + m, C - 2 * m, C - 2 * m, C * 0.12);
      o.fill();
      o.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      o.lineWidth = 1;
      o.stroke();
      const rv = C * 0.13;
      for (const [rx, ry] of [[rv, rv], [C - rv, rv], [rv, C - rv], [C - rv, C - rv]]) rivet(o, x + rx, y + ry, Math.max(1.6, C * 0.03));
    }
    return c;
  }

  // ---- 그리기 ----

  const pw = () => C * 0.3;

  function pipeShape(type) {
    const r = C / 2;
    g.beginPath();
    if (type === 'I') {
      g.moveTo(0, -r);
      g.lineTo(0, r);
    } else if (type === 'L') {
      g.arc(r, -r, r, Math.PI / 2, Math.PI);
    } else {
      g.moveTo(-r, 0);
      g.lineTo(r, 0);
      g.moveTo(0, 0);
      g.lineTo(0, r);
    }
  }

  /** 관 한 토막을 겉(검은 테, 강철, 밝은 면), 속(빈 관 또는 물) 차례로 칠한다. shape() 가 경로를 만든다. */
  function strokePipe(shape, wet, glow) {
    const w = pw();
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    const passes = [
      ['#06141d', w + 6],
      ['#56717f', w],
      ['#8aa6b5', w * 0.7],
      ['#071a26', w * 0.46],
    ];
    for (const [col, lw] of passes) {
      shape();
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.stroke();
    }
    if (wet > 0.01) {
      shape();
      g.save();
      g.globalAlpha = wet;
      g.strokeStyle = glow ? '#ffffff' : color;
      g.shadowColor = color;
      g.shadowBlur = 10;
      g.lineWidth = w * 0.46;
      g.stroke();
      g.restore();
    }
  }

  /** 조각 끝의 이음쇠. 어느 쪽이 열려 있는지 한눈에 보인다. */
  function flanges(mask) {
    const w = pw();
    const r = C / 2;
    const t = Math.max(3, C * 0.07);
    for (const s of SIDES) {
      if (!(mask & s)) continue;
      g.save();
      g.rotate(Math.log2(s) * (Math.PI / 2));
      g.fillStyle = '#06141d';
      g.fillRect(-w / 2 - 5, -r + 1, w + 10, t + 2);
      g.fillStyle = '#a3bccb';
      g.fillRect(-w / 2 - 3, -r + 2, w + 6, t);
      g.restore();
    }
  }

  function drawCell(i, now) {
    const c = cells[i];
    const x = gx + (i % cols) * C + C / 2;
    const y = gy + ((i / cols) | 0) * C + C / 2;
    g.save();
    g.translate(x, y);
    if (c.flash > 0.01) {
      g.fillStyle = `rgba(255, 255, 255, ${0.18 * c.flash})`;
      roundRect(g, -C / 2 + 3, -C / 2 + 3, C - 6, C - 6, C * 0.12);
      g.fill();
    }
    g.rotate(c.shown * (Math.PI / 2));
    flanges(BASE[c.type]);
    const glow = solved && fxAt && now - fxAt < 260;
    strokePipe(() => pipeShape(c.type), c.wet, glow);
    if (c.type === 'T') {
      // T자 가운데 이음매
      g.fillStyle = '#06141d';
      g.beginPath();
      g.arc(0, 0, pw() * 0.62, 0, TAU);
      g.fill();
      g.fillStyle = '#7d98a7';
      g.beginPath();
      g.arc(0, 0, pw() * 0.5, 0, TAU);
      g.fill();
      g.fillStyle = c.wet > 0.01 ? color : '#071a26';
      g.globalAlpha = c.wet > 0.01 ? Math.max(0.4, c.wet) : 1;
      g.beginPath();
      g.arc(0, 0, pw() * 0.24, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
  }

  /** 물통. 입구 쪽은 늘 차 있고, 출구 쪽은 비어 있다가 물이 닿으면 차오른다. */
  function drawTank(x, y, w, hh, level, now, goalTank) {
    g.fillStyle = '#06141d';
    roundRect(g, x - 3, y - 3, w + 6, hh + 6, 8);
    g.fill();
    g.fillStyle = '#04111a';
    roundRect(g, x, y, w, hh, 6);
    g.fill();
    if (level > 0.01) {
      g.save();
      roundRect(g, x, y, w, hh, 6);
      g.clip();
      const top = y + hh * (1 - level);
      g.fillStyle = color;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.moveTo(x, y + hh);
      for (let k = 0; k <= 12; k++) {
        const px = x + (w * k) / 12;
        g.lineTo(px, top + Math.sin(now / 260 + k * 0.9) * Math.max(1.5, hh * 0.05));
      }
      g.lineTo(x + w, y + hh);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.lineWidth = 3;
    g.strokeStyle = '#8fa9b8';
    roundRect(g, x, y, w, hh, 6);
    g.stroke();
    if (goalTank && !solved) {
      // 비어 있는 목표 물통은 구역 색으로 깜빡여 "여기까지"를 알린다
      g.save();
      g.globalAlpha = 0.45 + 0.45 * Math.sin(now / 230);
      g.strokeStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 12;
      g.lineWidth = 3;
      roundRect(g, x - 5, y - 5, w + 10, hh + 10, 9);
      g.stroke();
      g.restore();
    }
  }

  function drawEnds(now) {
    const w = C * 1.3;
    const th = C * 0.36;
    // 입구: 위쪽 물통 → 0번 칸 위
    const ix = gx + C / 2;
    const iy0 = gy - C * 0.62;
    const vpipe = (x, y0, y1, wet) => strokePipe(() => {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
    }, wet, false);
    vpipe(ix, iy0 + th, gy, 1);
    drawTank(gx + C * 0.08, iy0, w, th, 0.72, now, false);
    // 출구: 마지막 칸 아래 → 아래쪽 물통
    const ox = gx + (cols - 0.5) * C;
    const oy1 = gy + rows * C + C * 0.62;
    const outWet = solved && now >= arriveAt - WET_STEP ? Math.min(1, (now - arriveAt + WET_STEP) / 120) : 0;
    vpipe(ox, gy + rows * C, oy1 - th, outWet);
    drawTank(gx + cols * C - C * 0.08 - w, oy1 - th, w, th, tank, now, true);
    // 물통으로 쏟아지는 물방울
    if (spill.length) {
      g.fillStyle = color;
      for (const p of spill) {
        g.globalAlpha = Math.max(0, 1 - p.t / 0.6);
        g.beginPath();
        g.arc(ox + p.x * C, oy1 - th + p.y * C, Math.max(2, C * 0.04), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    const ease = 1 - Math.exp(-dt * 26);
    for (const c of cells) {
      c.shown += (c.turns - c.shown) * ease;
      const target = c.wetAt !== null && now >= c.wetAt ? 1 : 0;
      c.wet += (target - c.wet) * (1 - Math.exp(-dt * (target ? 30 : 18)));
      c.flash *= Math.exp(-dt * 10);
    }
    if (fxAt) tank += (0.75 - tank) * (1 - Math.exp(-dt * 7));
    for (const p of spill) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 5 * dt;
    }
    spill = spill.filter((p) => p.t < 0.6);
    if (Wd && bgCv) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, Wd, Hd);
      g.drawImage(bgCv, 0, 0, Wd, Hd);
      drawEnds(now);
      for (let i = 0; i < cells.length; i++) drawCell(i, now);
    }
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function onDown(e) {
    if (!alive || solved || !C) return;
    e.preventDefault();
    const b = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - b.left - gx) / C);
    const y = Math.floor((e.clientY - b.top - gy) / C);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    tap(y * cols + x);
  }

  cv.addEventListener('pointerdown', onDown);

  const ro = new ResizeObserver(() => {
    if (alive) layout();
  });
  ro.observe(wrap);
  sync();
  reflow(performance.now());
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
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      if (!solved) {
        // 지금 상태에서 가장 적게 누르는 풀이대로 돌려 놓는다
        const now = performance.now();
        for (const [i, k] of bestPlan(cells, cols, rows).steps) {
          cells[i].rot = (cells[i].rot + k) % 4;
          cells[i].turns += k;
        }
        reflow(now);
        sync();
        celebrate();
      }
      finish();
    },
  };
}
