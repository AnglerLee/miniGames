// 증거 장면: 발자국 채취.
// 먼지 덮인 바닥을 손가락으로 문지르면 먼지가 걷히고 그 아래 발자국이 드러난다.
// 발자국이 충분히 드러나면 무늬 보기 4개가 나오고, 같은 무늬를 고른다. 규격은 index.js 참고.
import { h, ensureStyle } from '../../shared/dom.js';
import { drawFootprint, traitCanvas } from '../../shared/draw.js';
import { FOOT_PATTERNS } from '../../shared/content.js';
import { makeRng } from '../../shared/prng.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
// 바닥 그림의 가로/세로. 고정해 두어야 크기가 바뀌어도 닦은 자리가 그대로 남는다
const ASPECT = 1.15;
// 닦은 자리를 세는 낮은 해상도 격자. 칸은 정사각형, 좌표는 바닥 폭을 1로 본다
const GN = 46;
const GM = Math.round(GN / ASPECT);
const BRUSH = 0.075; // 손가락 반지름 (바닥 폭 기준)
const NEED = 0.6; // 발자국이 이만큼 드러나면 보기를 보여 준다
const CELEBRATE_MS = 700;
const MAX_DUST_BITS = 90;
const BIT_COLORS = ['#b4ada0', '#9d958a', '#cfc8bd'];
// drawFootprint 의 신발 바닥 모양 (발자국 길이 1 기준)
const SOLE = { cy: -0.17, rx: 0.21, ry: 0.33 };
const HEEL = { cy: 0.33, rx: 0.16, ry: 0.17 };

const CSS = `
.sc-dust { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 10px; color: var(--ink); user-select: none; -webkit-user-select: none; }
.sc-dust-line { flex: none; text-align: center; font-size: 17px; font-weight: 800; line-height: 1.35; }
.sc-dust-line.is-hint { color: var(--red-deep); }
.sc-dust-wrap { position: relative; flex: 1 1 0; min-height: 150px; }
.sc-dust-board { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.sc-dust-board canvas { position: absolute; left: 0; top: 0; border-radius: 12px; }
.sc-dust-floor { box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(0, 0, 0, 0.1); }
.sc-dust-dust { touch-action: none; transition: opacity 0.5s ease; }
.sc-dust-dust.is-gone { opacity: 0; }
.sc-dust-fx { pointer-events: none; }
.sc-dust-ctl { flex: none; height: 92px; display: flex; flex-direction: column; justify-content: center; }
.sc-dust-meter { display: flex; align-items: center; gap: 10px; padding: 0 4px; font-size: 15px; font-weight: 800; white-space: nowrap; }
.sc-dust-bar { flex: 1; height: 16px; border-radius: 999px; background: rgba(0, 0, 0, 0.1); box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.22); overflow: hidden; }
.sc-dust-fill { width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #c99a3c, var(--gold)); transition: width 0.15s ease; }
.sc-dust-opts { display: flex; gap: 5px; animation: sc-dust-in 0.3s ease both; }
.sc-dust-opt { position: relative; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 2px 4px; border-radius: 12px; background: #fffaf0; border: 2px solid var(--paper-line); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.18); color: var(--ink); font-size: clamp(10.5px, 3.4vw, 13px); font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; transition: transform 0.06s ease; }
.sc-dust-opt:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.18); }
.sc-dust-opt canvas { max-width: 100%; height: auto !important; }
.sc-dust-opt.is-wrong > * { opacity: 0.4; }
.sc-dust-opt.is-wrong::after { content: '✕'; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--red); font-size: 40px; font-weight: 900; }
.sc-dust-opt.is-right { border-color: var(--green); background: #e1f3e8; box-shadow: 0 0 0 3px rgba(63, 157, 107, 0.35); pointer-events: none; }
.sc-dust-stamp { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%) rotate(-5deg); padding: 6px 14px; border: 3px solid var(--green); border-radius: 10px; background: rgba(246, 236, 214, 0.95); color: var(--green); font-size: 21px; font-weight: 900; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); animation: sc-dust-pop 0.35s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
.sc-dust-stamp[hidden] { display: none; }
@keyframes sc-dust-in { from { opacity: 0; transform: translateY(10px); } }
@keyframes sc-dust-pop { from { opacity: 0; transform: translateX(-50%) rotate(-5deg) scale(1.7); } }
`;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

function inEllipse(x, y, e) {
  const u = x / e.rx;
  const v = (y - e.cy) / e.ry;
  return u * u + v * v <= 1;
}

function insidePrint(p, x, y) {
  const dx = (x - p.x) / p.size;
  const dy = (y - p.y) / p.size;
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return inEllipse(lx, ly, SOLE) || inEllipse(lx, ly, HEEL);
}

/**
 * 걸어간 발자국 3개. 걸은 방향으로 좌우 번갈아, 살짝 바깥으로 기울게 놓고 바닥 안에 꽉 차게 맞춘다.
 * 비스듬히 걷게 해야 세로가 짧은 바닥에서도 발자국을 크게 그릴 수 있다.
 */
function walkPrints(rng) {
  const heading = ((rng.bool() ? 1 : -1) * (32 + rng.int(22)) + (rng.bool() ? 180 : 0)) * DEG;
  const n = 3;
  const first = rng.bool() ? 1 : -1;
  const dx = Math.sin(heading);
  const dy = -Math.cos(heading);
  const nx = Math.cos(heading);
  const ny = Math.sin(heading);
  const raw = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? -first : first;
    const along = (i - (n - 1) / 2) * 0.92;
    raw.push({
      x: dx * along + nx * side * 0.27,
      y: dy * along + ny * side * 0.27,
      angle: heading + (side * 6 + rng.int(7) - 3) * DEG,
      size: 1,
    });
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of raw) {
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      for (const e of [SOLE, HEEL]) {
        const lx = Math.cos(a) * e.rx;
        const ly = e.cy + Math.sin(a) * e.ry;
        const x = p.x + lx * c - ly * s;
        const y = p.y + lx * s + ly * c;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  const H = 1 / ASPECT;
  const m = 0.07;
  const k = Math.min((1 - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0), 0.44);
  const ox = 0.5 - (k * (x0 + x1)) / 2;
  const oy = H / 2 - (k * (y0 + y1)) / 2;
  return raw.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k, angle: p.angle, size: k }));
}

export function mount(root, ctx) {
  ensureStyle('hd-scene-dust', CSS);
  const data = ctx.data;
  const rng = ctx.rng;
  const prints = walkPrints(rng);
  const floorSeed = rng.next();
  const dustSeed = rng.next();

  // 발자국이 있는 칸과 닦은 칸. 매 move 마다 그림을 읽지 않고 이 격자로 센다
  const footMask = new Uint8Array(GN * GM);
  const cleared = new Uint8Array(GN * GM);
  let footTotal = 0;
  let footShown = 0;
  for (let j = 0; j < GM; j++) {
    for (let i = 0; i < GN; i++) {
      const x = (i + 0.5) / GN;
      const y = (j + 0.5) / GN;
      if (prints.some((p) => insidePrint(p, x, y))) {
        footMask[j * GN + i] = 1;
        footTotal++;
      }
    }
  }
  // 닦은 길 (바닥 폭 기준 좌표). 화면 크기가 바뀌면 먼지를 새로 깔고 이 길을 다시 지운다
  const strokes = [];

  let alive = true;
  let finished = false;
  let stage = 'rub';
  let wipedAll = false;
  const timers = new Set();
  let raf = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let drag = null;
  let lastRub = 0;
  let celebAt = 0;
  let lastNow = 0;
  const bits = [];

  const line = h('p', { class: 'sc-dust-line', text: '손가락으로 먼지를 닦아 봐' });
  const floorCv = h('canvas', { class: 'sc-dust-floor', role: 'img', 'aria-label': '먼지 덮인 바닥' });
  const dustCv = h('canvas', { class: 'sc-dust-dust' });
  const fxCv = h('canvas', { class: 'sc-dust-fx' });
  const stamp = h('div', { class: 'sc-dust-stamp', hidden: true });
  // 세 겹 캔버스와 도장을 바닥 크기와 같은 판에 담는다
  const board = h('div', { class: 'sc-dust-board' }, floorCv, dustCv, fxCv, stamp);
  const wrap = h('div', { class: 'sc-dust-wrap' }, board);
  const fillBar = h('div', { class: 'sc-dust-fill' });
  const meter = h('div', { class: 'sc-dust-meter' }, h('span', { text: '👣 발자국' }), h('div', { class: 'sc-dust-bar' }, fillBar));
  const ctl = h('div', { class: 'sc-dust-ctl' }, meter);
  const optBtns = data.options.map((n, i) =>
    h(
      'button',
      { class: 'sc-dust-opt', type: 'button', 'aria-label': FOOT_PATTERNS[n], onClick: () => pick(i) },
      traitCanvas('foot', n, 56),
      h('span', { text: FOOT_PATTERNS[n] })
    )
  );
  const el = h('div', { class: 'sc-dust', 'data-stage': stage, 'data-progress': '0' }, line, wrap, ctl);
  root.append(el);
  const fg = floorCv.getContext('2d');
  const dg = dustCv.getContext('2d');
  const xg = fxCv.getContext('2d');

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

  function ratio() {
    return footTotal ? footShown / footTotal : 1;
  }

  function showOptions() {
    setStage('pick');
    line.textContent = '어떤 무늬일까?';
    ctl.replaceChildren(h('div', { class: 'sc-dust-opts' }, optBtns));
    ctx.sfx('reveal');
  }

  function updateMeter() {
    const r = ratio();
    el.dataset.progress = r.toFixed(2);
    fillBar.style.width = Math.min(100, (r / NEED) * 100).toFixed(1) + '%';
    if (stage === 'rub' && r >= NEED) showOptions();
  }

  function showStamp() {
    stamp.textContent = FOOT_PATTERNS[data.options[data.answer]] + ' 발자국!';
    stamp.hidden = false;
  }

  function pick(i) {
    if (!alive || stage !== 'pick') return;
    const b = optBtns[i];
    if (i === data.answer) {
      setStage('done');
      b.classList.add('is-right');
      optBtns.forEach((o, j) => {
        if (j !== i) o.disabled = true;
      });
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 범인의 신발 무늬야';
      ctx.sfx('good');
      ctx.buzz(30);
      // 남은 먼지를 걷어 내 발자국 전체를 보여 준다
      dustCv.classList.add('is-gone');
      showStamp();
      celebAt = performance.now();
      wake();
      later(CELEBRATE_MS, finish);
    } else {
      b.disabled = true;
      b.classList.add('is-wrong');
      ctx.miss();
      ctx.sfx('bad');
      ctx.buzz([40, 40, 40]);
      shake(wrap);
      line.textContent = '발자국 무늬를 다시 잘 봐';
      line.classList.add('is-hint');
    }
  }

  // ---- 그리기 ----

  function sizeCanvas(c, g) {
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout() {
    const w = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight * ASPECT));
    if (w < 40 || w === W) return;
    W = w;
    H = Math.round(W / ASPECT);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    board.style.width = W + 'px';
    board.style.height = H + 'px';
    sizeCanvas(floorCv, fg);
    sizeCanvas(dustCv, dg);
    sizeCanvas(fxCv, xg);
    bits.length = 0;
    paintFloor();
    paintDust();
  }

  function paintFloor() {
    const r = makeRng(floorSeed);
    fg.fillStyle = '#e6cfa4';
    fg.fillRect(0, 0, W, H);
    // 밝은 나무 마루. 발자국이 잘 보이게 바닥은 밝게 둔다
    const board = W * 0.155;
    for (let y = 0, row = 0; y < H; y += board, row++) {
      const shade = r.int(5);
      fg.fillStyle = ['#e8d2a8', '#e2c89a', '#ead6ae', '#dfc496', '#e5cda0'][shade];
      fg.fillRect(0, y, W, board);
      fg.strokeStyle = 'rgba(150, 110, 60, 0.18)';
      fg.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const gy = y + board * (0.25 + k * 0.25) + (r.int(7) - 3);
        fg.beginPath();
        fg.moveTo(0, gy);
        fg.bezierCurveTo(W * 0.3, gy - 3, W * 0.6, gy + 3, W, gy - 1);
        fg.stroke();
      }
      const joint = W * (0.2 + r.int(60) / 100) + (row % 2 ? W * 0.1 : 0);
      fg.strokeStyle = 'rgba(120, 80, 40, 0.35)';
      fg.lineWidth = 1.5;
      fg.beginPath();
      fg.moveTo(joint, y);
      fg.lineTo(joint, y + board);
      fg.stroke();
      fg.fillStyle = 'rgba(110, 75, 35, 0.4)';
      fg.fillRect(0, y + board - 1.5, W, 1.5);
    }
    for (const p of prints) {
      drawFootprint(fg, data.pattern, p.x * W, p.y * W, p.size * W, { angle: p.angle, color: '#3a2717', alpha: 0.92 });
    }
  }

  function paintDust() {
    dg.save();
    dg.globalCompositeOperation = 'source-over';
    dg.clearRect(0, 0, W, H);
    dg.restore();
    if (wipedAll) return;
    const r = makeRng(dustSeed);
    dg.fillStyle = '#bdb6a9';
    dg.fillRect(0, 0, W, H);
    // 얼룩덜룩한 먼지 결
    for (let i = 0; i < 24; i++) {
      const x = (r.int(1000) / 1000) * W;
      const y = (r.int(1000) / 1000) * H;
      const rr = W * (0.08 + r.int(14) / 100);
      const grad = dg.createRadialGradient(x, y, 0, x, y, rr);
      grad.addColorStop(0, i % 2 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(80, 70, 60, 0.1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      dg.fillStyle = grad;
      dg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // 발자국 자리가 아주 살짝 도드라진다 (무늬는 안 보이고 모양만). 어디를 문지를지 눈치챌 수 있게
    dg.fillStyle = 'rgba(70, 60, 50, 0.03)';
    for (const p of prints) {
      for (const grow of [1, 1.12]) {
        dg.save();
        dg.translate(p.x * W, p.y * W);
        dg.rotate(p.angle);
        dg.scale(p.size * W * grow, p.size * W * grow);
        dg.beginPath();
        dg.ellipse(0, SOLE.cy, SOLE.rx, SOLE.ry, 0, 0, TAU);
        dg.ellipse(0, HEEL.cy, HEEL.rx, HEEL.ry, 0, 0, TAU);
        dg.fill();
        dg.restore();
      }
    }
    const colors = ['#d4cec4', '#a59d91', '#8f877b', '#ddd8cf', '#b0a89b'];
    const n = Math.round(W * H * 0.008);
    for (let i = 0; i < n; i++) {
      dg.fillStyle = colors[r.int(colors.length)];
      const s = 0.8 + r.int(15) / 10;
      dg.fillRect((r.int(10000) / 10000) * W, (r.int(10000) / 10000) * H, s, s);
    }
    // 보풀
    dg.strokeStyle = 'rgba(140, 130, 118, 0.7)';
    dg.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const x = (r.int(1000) / 1000) * W;
      const y = (r.int(1000) / 1000) * H;
      const l = W * 0.05;
      dg.beginPath();
      dg.moveTo(x, y);
      dg.bezierCurveTo(x + l, y - l * 0.6, x - l * 0.3, y + l, x + l * 0.8, y + l * 0.5);
      dg.stroke();
    }
    for (const s of strokes) wipe(s[0], s[1], s[2], s[3]);
  }

  /** 먼지를 지운다. 바깥쪽은 반쯤만 지워 가장자리가 부드럽다 */
  function wipe(x0, y0, x1, y1) {
    dg.save();
    dg.globalCompositeOperation = 'destination-out';
    dg.lineCap = 'round';
    dg.lineJoin = 'round';
    const pass = [
      ['rgba(0, 0, 0, 0.3)', BRUSH * 2.5],
      ['#000', BRUSH * 2],
    ];
    for (const [color, width] of pass) {
      dg.strokeStyle = color;
      dg.lineWidth = width * W;
      dg.beginPath();
      dg.moveTo(x0 * W, y0 * W);
      dg.lineTo(x1 * W + 0.01, y1 * W);
      dg.stroke();
    }
    dg.restore();
  }

  /** 닦은 칸을 표시하고 새로 닦인 칸 수를 돌려준다 */
  function mark(x0, y0, x1, y1) {
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - BRUSH) * GN));
    const i1 = Math.min(GN - 1, Math.floor((Math.max(x0, x1) + BRUSH) * GN));
    const j0 = Math.max(0, Math.floor((Math.min(y0, y1) - BRUSH) * GN));
    const j1 = Math.min(GM - 1, Math.floor((Math.max(y0, y1) + BRUSH) * GN));
    let fresh = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * GN + i;
        if (cleared[k]) continue;
        if (segDist((i + 0.5) / GN, (j + 0.5) / GN, x0, y0, x1, y1) > BRUSH) continue;
        cleared[k] = 1;
        fresh++;
        if (footMask[k]) footShown++;
      }
    }
    return fresh;
  }

  function rub(a, b) {
    strokes.push([a.x, a.y, b.x, b.y]);
    wipe(a.x, a.y, b.x, b.y);
    const fresh = mark(a.x, a.y, b.x, b.y);
    if (fresh > 0) {
      const now = performance.now();
      // 소리는 너무 잦지 않게
      if (now - lastRub > 220) {
        lastRub = now;
        ctx.sfx('rub');
      }
      const dirx = b.x - a.x;
      const diry = b.y - a.y;
      const len = Math.hypot(dirx, diry) || 1;
      for (let i = 0; i < 3 && bits.length < MAX_DUST_BITS; i++) {
        bits.push({
          x: b.x * W,
          y: b.y * W,
          vx: (Math.random() - 0.5) * 140 + (dirx / len) * 90,
          vy: (Math.random() - 0.5) * 140 + (diry / len) * 90 - 40,
          life: 0,
          max: 0.45 + Math.random() * 0.35,
          size: 1.5 + Math.random() * 2.5,
          color: BIT_COLORS[i % 3],
        });
      }
      wake();
      updateMeter();
    }
  }

  function drawFx(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    xg.clearRect(0, 0, W, H);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life += dt;
      if (b.life >= b.max) {
        bits.splice(i, 1);
        continue;
      }
      b.vy += 260 * dt;
      b.vx *= 0.96;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      xg.globalAlpha = 1 - b.life / b.max;
      xg.fillStyle = b.color;
      xg.beginPath();
      xg.arc(b.x, b.y, b.size, 0, TAU);
      xg.fill();
    }
    xg.globalAlpha = 1;
    const p = celebAt ? (now - celebAt) / CELEBRATE_MS : 2;
    if (p < 1.5) {
      // 맞힌 발자국 테두리가 금빛으로 두어 번 반짝인다
      const glow = Math.max(0, Math.sin(p * Math.PI * 2.5)) * Math.max(0, 1 - p / 1.5);
      xg.strokeStyle = `rgba(227, 179, 65, ${0.25 + 0.75 * glow})`;
      xg.shadowColor = '#ffe08a';
      xg.shadowBlur = 12;
      for (const fp of prints) {
        xg.save();
        xg.translate(fp.x * W, fp.y * W);
        xg.rotate(fp.angle);
        const s = fp.size * W;
        xg.lineWidth = 3;
        xg.beginPath();
        xg.ellipse(0, SOLE.cy * s, SOLE.rx * s * 1.12, SOLE.ry * s * 1.06, 0, 0, TAU);
        xg.moveTo(HEEL.rx * s * 1.14, HEEL.cy * s);
        xg.ellipse(0, HEEL.cy * s, HEEL.rx * s * 1.14, HEEL.ry * s * 1.12, 0, 0, TAU);
        xg.stroke();
        xg.restore();
      }
      xg.shadowColor = 'transparent';
    }
    return bits.length > 0 || p < 1.5;
  }

  function frame(now) {
    raf = 0;
    if (!alive || !W) return;
    if (drawFx(now)) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (raf || !alive) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ---- 손가락 ----

  function local(e) {
    const b = dustCv.getBoundingClientRect();
    return { x: (e.clientX - b.left) / W, y: (e.clientY - b.top) / W };
  }

  function onDown(e) {
    if (!alive || stage === 'done' || drag || !W) return;
    e.preventDefault();
    try {
      dustCv.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 이미 끝난 포인터 */
    }
    const p = local(e);
    drag = { id: e.pointerId, p };
    rub(p, p);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id || stage === 'done') return;
    const p = local(e);
    if (Math.hypot(p.x - drag.p.x, p.y - drag.p.y) < 0.004) return;
    rub(drag.p, p);
    drag.p = p;
  }

  function onUp(e) {
    if (drag && e.pointerId === drag.id) drag = null;
  }

  dustCv.addEventListener('pointerdown', onDown);
  dustCv.addEventListener('pointermove', onMove);
  dustCv.addEventListener('pointerup', onUp);
  dustCv.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(() => {
    if (alive) layout();
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
      dustCv.removeEventListener('pointerdown', onDown);
      dustCv.removeEventListener('pointermove', onMove);
      dustCv.removeEventListener('pointerup', onUp);
      dustCv.removeEventListener('pointercancel', onUp);
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      wipedAll = true;
      paintDust();
      footShown = footTotal;
      if (stage === 'rub') showOptions();
      updateMeter();
      setStage('done');
      optBtns.forEach((o, j) => {
        o.disabled = j !== data.answer;
        if (j === data.answer) o.classList.add('is-right');
      });
      line.classList.remove('is-hint');
      line.textContent = '찾았다! 범인의 신발 무늬야';
      showStamp();
      finish();
    },
  };
}
