// 증거 장면: 찢어진 기록 (shred)
// 기록지 한 장이 6조각(2×3) 또는 9조각(3×3)으로 찢겨 섞여 있다.
// 조각 두 개를 차례로 누르거나(또는 끌어다 놓아) 자리를 바꾼다. 제자리에 간 조각은 테이프로 붙어 고정된다.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

const PW = 300; // 종이 논리 크기
const PH = 400;
const GAP = 10; // 맞추기 전 조각 사이 틈
const PAD = 12; // 판 가장자리
const AMP = 4.5; // 찢긴 선이 들쭉날쭉한 정도
const M = AMP + 2; // 조각 그림의 여백 (찢긴 선이 칸 밖으로 삐져나온다)
const MOVE_MS = 190;
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";

const CSS = `
.sc-shred { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.sc-shred-tip { flex: none; font-weight: 800; font-size: clamp(13px, 4.1vw, 16px); line-height: 1.3; color: var(--ink); }
.sc-shred-wrap { flex: none; position: relative; align-self: center; }
.sc-shred-canvas { display: block; touch-action: none; border-radius: 12px; }
.sc-shred-stamp { position: absolute; pointer-events: none; white-space: nowrap; line-height: 1.2;
  font-size: clamp(18px, 6.4vw, 27px); padding: 3px 12px; border-width: 4px; background: rgba(255, 250, 240, 0.35);
  mix-blend-mode: multiply; transform: translate(-50%, -50%) rotate(-7deg);
  animation: sc-shred-stamp .45s cubic-bezier(.2, 1.5, .4, 1) both; }
@keyframes sc-shred-stamp { from { opacity: 0; transform: translate(-50%, -50%) rotate(-16deg) scale(2.4); } }
`;

export function mount(root, ctx) {
  ensureStyle('hd-scene-shred', CSS);
  const data = ctx.data || {};
  const lines = (Array.isArray(data.lines) ? data.lines : []).map((s) => String(s)).filter((s) => s.trim()).slice(0, 8);
  if (!lines.length) lines.push('기록');
  const n = Number(data.pieces) === 9 ? 9 : 6;
  const cols = n === 9 ? 3 : 2;
  const rows = 3;
  const cw = PW / cols;
  const ch = PH / rows;
  const BW = PW + (cols - 1) * GAP + 2 * PAD;
  const BH = PH + (rows - 1) * GAP + 2 * PAD;

  const shapes = makeShapes(ctx.rng, cols, rows);
  const pieceAt = shuffleOrder(ctx.rng, n); // 칸 → 그 칸에 놓인 조각
  const texts = layoutText(lines, rows);

  const tip = h('p', { class: 'sc-shred-tip', text: '두 조각을 눌러 자리를 바꿔 봐' });
  const canvas = h('canvas', { class: 'sc-shred-canvas', role: 'img', 'aria-label': '찢어진 기록 조각들' });
  const wrap = h('div', { class: 'sc-shred-wrap' }, canvas);
  const box = h('div', { class: 'sc-shred' }, tip, wrap);
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
  let finished = false;
  let completing = false;
  let joinK = 0; // 0 → 1: 다 맞춘 뒤 틈이 닫히며 한 장이 된다
  let joinAt = 0;
  let selected = null;
  let drag = null;
  // 처음부터 제자리인 조각도 테이프로 붙여 둔다: "테이프 = 맞은 자리" 를 처음부터 보여 준다
  const fixed = Array.from({ length: n }, (_, p) => pieceAt[p] === p);
  const snapAt = Array(n).fill(-1);
  const wiggleAt = Array(n).fill(-1);
  const anim = Array(n).fill(null);
  const pos = Array(n);

  const slotOf = (p) => pieceAt.indexOf(p);
  function slotXY(s, k = joinK) {
    const gapNow = GAP * (1 - k);
    const ox = PAD + ((cols - 1) * (GAP - gapNow)) / 2;
    const oy = PAD + ((rows - 1) * (GAP - gapNow)) / 2;
    return { x: ox + (s % cols) * (cw + gapNow), y: oy + Math.floor(s / cols) * (ch + gapNow) };
  }
  pieceAt.forEach((p, s) => (pos[p] = slotXY(s)));

  // ---------------------------------------------------------- 크기
  let cssW = 0;
  let scale = 1;
  let prs = 1;
  let sprites = [];

  function resize() {
    // 그림을 잠깐 빼고 잰다: 캔버스 크기가 상자 높이를 밀어 올려 잘못 재는 일을 막는다
    wrap.style.display = 'none';
    const boxH = box.clientHeight;
    wrap.style.display = '';
    const aw = box.clientWidth;
    let ah = boxH - tip.offsetHeight - 10;
    if (ah < 140) ah = Math.round(aw * (BH / BW));
    const w = Math.max(160, Math.floor(Math.min(aw, ah * (BW / BH))));
    if (w === cssW && sprites.length) return;
    cssW = w;
    const hh = Math.round(w * (BH / BW));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = w / BW;
    prs = scale * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = hh + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    const paper = document.createElement('canvas');
    paper.width = Math.ceil(PW * prs);
    paper.height = Math.ceil(PH * prs);
    const px = paper.getContext('2d');
    px.setTransform(prs, 0, 0, prs, 0, 0);
    paintPaper(px, texts);
    sprites = shapes.map((sh) => pieceSprite(sh, paper, prs, cw, ch));
    requestDraw();
  }

  // ---------------------------------------------------------- 손가락
  function toBoard(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  function slotAt(pt) {
    for (let s = 0; s < n; s++) {
      const q = slotXY(s);
      if (pt.x >= q.x - GAP / 2 && pt.x <= q.x + cw + GAP / 2 && pt.y >= q.y - GAP / 2 && pt.y <= q.y + ch + GAP / 2) return s;
    }
    return -1;
  }

  on(canvas, 'pointerdown', (e) => {
    if (finished || completing || drag) return;
    e.preventDefault();
    const pt = toBoard(e);
    const s = slotAt(pt);
    if (s < 0) {
      selected = null;
      requestDraw();
      return;
    }
    const p = pieceAt[s];
    if (fixed[p]) {
      // 붙은 조각은 움직이지 않는다는 걸 살짝 흔들어 알려 준다
      wiggleAt[p] = performance.now();
      ctx.sfx('tap');
      requestDraw();
      return;
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 캡처를 못 해도 움직임은 받는다 */
    }
    drag = { p, from: s, pid: e.pointerId, cx: e.clientX, cy: e.clientY, gx: pt.x - pos[p].x, gy: pt.y - pos[p].y, x: pt.x, y: pt.y, moved: false };
  });

  on(canvas, 'pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const pt = toBoard(e);
    drag.x = pt.x;
    drag.y = pt.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 8) {
      drag.moved = true;
      anim[drag.p] = null;
      if (selected !== null && selected !== drag.p) selected = null;
    }
    if (drag.moved) {
      pos[drag.p] = { x: drag.x - drag.gx, y: drag.y - drag.gy };
      requestDraw();
    }
  });

  on(canvas, 'pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      selected = null;
      const t = slotAt({ x: d.x, y: d.y });
      if (t >= 0 && t !== d.from && !fixed[pieceAt[t]]) swap(d.from, t);
      else animTo(d.p, slotXY(slotOf(d.p)));
    } else if (selected === null) {
      selected = d.p;
      ctx.sfx('tap');
    } else if (selected === d.p) {
      selected = null;
    } else {
      const a = slotOf(selected);
      selected = null;
      swap(a, d.from);
    }
    requestDraw();
  });

  on(canvas, 'pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const p = drag.p;
    drag = null;
    animTo(p, slotXY(slotOf(p)));
  });
  on(canvas, 'contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------- 바꾸기, 붙이기
  function animTo(p, to) {
    anim[p] = { fx: pos[p].x, fy: pos[p].y, tx: to.x, ty: to.y, t0: performance.now() };
    requestDraw();
  }

  function swap(a, b) {
    const pa = pieceAt[a];
    const pb = pieceAt[b];
    pieceAt[a] = pb;
    pieceAt[b] = pa;
    animTo(pa, slotXY(b));
    animTo(pb, slotXY(a));
    ctx.sfx('rub');
    later(MOVE_MS + 30, () => settle([pa, pb]));
  }

  function settle(list) {
    if (completing || finished) return;
    const now = performance.now();
    let got = 0;
    list.forEach((p) => {
      if (fixed[p] || pieceAt[p] !== p) return;
      fixed[p] = true;
      snapAt[p] = now;
      if (selected === p) selected = null;
      got++;
    });
    if (!got) return;
    ctx.sfx('snap');
    ctx.buzz(25);
    requestDraw();
    if (fixed.every(Boolean)) complete();
  }

  function complete() {
    completing = true;
    selected = null;
    later(320, () => {
      joinAt = performance.now();
      requestDraw();
    });
    later(820, () => {
      showStamp();
      ctx.sfx('good');
      ctx.buzz([30, 50, 30]);
    });
    later(1700, finish);
  }

  let stamp = null;
  function showStamp() {
    if (stamp) return;
    // 글줄은 세 띠의 가운데에 있으니, 가운데 띠와 아래 띠 사이 빈 곳에 찍어 글자를 가리지 않는다
    const top = PAD + (GAP * (rows - 1)) / 2 + (PH * (rows - 1)) / rows;
    const left = PAD + (GAP * (cols - 1)) / 2 + PW / 2 + 8;
    stamp = h('div', {
      class: 'stamp sc-shred-stamp',
      text: '복원 완료',
      style: { top: `${(top / BH) * 100}%`, left: `${(left / BW) * 100}%` },
    });
    wrap.append(stamp);
    tip.textContent = '기록을 다 붙였어';
  }

  function finish() {
    if (finished || dead) return;
    finished = true;
    ctx.done();
  }

  // ---------------------------------------------------------- 그리기 (필요할 때만)
  let raf = 0;
  function requestDraw() {
    if (!raf && !dead) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (!sprites.length) return;
    const now = performance.now();
    let busy = !!drag && drag.moved;

    if (joinAt) {
      const k = Math.min(1, (now - joinAt) / 450);
      joinK = 1 - Math.pow(1 - k, 3);
      for (let p = 0; p < n; p++) pos[p] = slotXY(p);
      if (k < 1) busy = true;
    }
    for (let p = 0; p < n; p++) {
      const a = anim[p];
      if (!a) continue;
      const k = Math.min(1, (now - a.t0) / MOVE_MS);
      const e = 1 - Math.pow(1 - k, 3);
      pos[p] = { x: a.fx + (a.tx - a.fx) * e, y: a.fy + (a.ty - a.fy) * e };
      if (k >= 1) anim[p] = null;
      else busy = true;
    }

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(prs, 0, 0, prs, 0, 0);

    // 바탕: 어두운 작업 판
    g.fillStyle = '#2b4250';
    rr(g, 0, 0, BW, BH, 12);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    for (let x = 20; x < BW; x += 20) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, BH);
      g.stroke();
    }
    for (let y = 20; y < BH; y += 20) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(BW, y);
      g.stroke();
    }
    if (joinK < 1) {
      g.setLineDash([5, 4]);
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      for (let s = 0; s < n; s++) {
        const q = slotXY(s);
        g.strokeRect(q.x + 1, q.y + 1, cw - 2, ch - 2);
      }
      g.setLineDash([]);
    }

    const dragP = drag && drag.moved ? drag.p : -1;
    const order = [];
    for (let p = 0; p < n; p++) if (p !== dragP && p !== selected && !anim[p]) order.push(p);
    for (let p = 0; p < n; p++) if (p !== dragP && p !== selected && anim[p]) order.push(p);
    if (selected !== null && selected !== dragP) order.push(selected);
    if (dragP >= 0) order.push(dragP);

    order.forEach((p) => {
      if (p === dragP) {
        // 끌고 있는 조각이 놓일 칸: 그 칸의 조각 위에 테를 둘러 "여기랑 바뀐다" 를 보여 준다
        const t = slotAt({ x: drag.x, y: drag.y });
        if (t >= 0 && t !== drag.from) {
          const q = slotXY(t);
          const ok = !fixed[pieceAt[t]];
          g.fillStyle = ok ? 'rgba(255, 217, 90, 0.22)' : 'rgba(255, 90, 70, 0.2)';
          g.strokeStyle = ok ? '#ffd95a' : '#ff6b5a';
          g.lineWidth = 3;
          rr(g, q.x - 4, q.y - 4, cw + 8, ch + 8, 6);
          g.fill();
          g.stroke();
        }
      }
      let { x, y } = pos[p];
      const lifted = p === dragP || p === selected;
      if (wiggleAt[p] >= 0) {
        const k = (now - wiggleAt[p]) / 280;
        if (k < 1) {
          x += Math.sin(k * Math.PI * 6) * 3 * (1 - k);
          busy = true;
        } else wiggleAt[p] = -1;
      }
      const sc = p === dragP ? 1.06 : p === selected ? 1.04 : 1;
      if (p === selected) y -= 4;
      g.save();
      g.translate(x + cw / 2, y + ch / 2);
      g.scale(sc, sc);
      g.translate(-cw / 2, -ch / 2);
      g.shadowColor = 'rgba(0,0,0,0.38)';
      g.shadowBlur = (lifted ? 16 : 5) * prs;
      g.shadowOffsetY = (lifted ? 7 : 2) * prs;
      g.drawImage(sprites[p], -M, -M, cw + 2 * M, ch + 2 * M);
      g.shadowColor = 'transparent';
      if (snapAt[p] >= 0) {
        // 붙는 순간 한 번 반짝
        const k = (now - snapAt[p]) / 450;
        if (k < 1) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.45 * (1 - k);
          g.drawImage(sprites[p], -M, -M, cw + 2 * M, ch + 2 * M);
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          busy = true;
        }
      }
      if (fixed[p]) drawTape(g, cw, p, snapAt[p] >= 0 ? Math.min(1, (now - snapAt[p]) / 180) : 1);
      if (p === selected) {
        g.strokeStyle = '#ffd95a';
        g.lineWidth = 3.5;
        rr(g, -4, -4, cw + 8, ch + 8, 6);
        g.stroke();
      }
      g.restore();
    });

    if (busy) requestDraw();
  }

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => !dead && resize());
    ro.observe(box);
  } else on(window, 'resize', resize);
  resize();

  if (DEBUG) {
    // 검증용: 칸마다 놓인 조각과 칸의 화면 좌표
    window.__hdShred = {
      state: () => ({ pieceAt: pieceAt.slice(), fixed: fixed.slice(), selected }),
      slotCenter: (s) => {
        const r = canvas.getBoundingClientRect();
        const q = slotXY(s);
        return { x: r.left + (q.x + cw / 2) * scale, y: r.top + (q.y + ch / 2) * scale };
      },
    };
  }

  return {
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach(clearTimeout);
      timers.clear();
      ac.abort();
      if (ro) ro.disconnect();
      box.remove();
      if (DEBUG && window.__hdShred) delete window.__hdShred;
    },
    solve() {
      if (dead || finished) return;
      for (let s = 0; s < n; s++) pieceAt[s] = s;
      fixed.fill(true);
      anim.fill(null);
      selected = null;
      drag = null;
      completing = true;
      joinK = 1;
      joinAt = 0;
      for (let p = 0; p < n; p++) pos[p] = slotXY(p);
      showStamp();
      requestDraw();
      finish();
    },
  };
}

// ------------------------------------------------------------ 섞기, 찢긴 모양 (씨앗 난수)

/** 처음부터 거의 맞은 상태가 나오지 않게, 적어도 4조각은 제자리가 아니게 섞는다 */
function shuffleOrder(rng, n) {
  const need = Math.min(n, 4);
  const ids = [...Array(n).keys()];
  for (let i = 0; i < 80; i++) {
    const o = rng.shuffle(ids);
    if (o.filter((p, s) => p !== s).length >= need) return o;
  }
  return ids.map((i) => (i + 1) % n);
}

/** 조각마다 테두리 점(종이 좌표)과 찢긴 쪽 선들. 이웃 조각은 같은 찢긴 선을 나눠 가져 딱 맞는다. */
function makeShapes(rng, cols, rows) {
  const cw = PW / cols;
  const ch = PH / rows;
  const jag = (ax, ay, bx, by) => {
    const len = Math.hypot(bx - ax, by - ay);
    const k = Math.max(3, Math.round(len / 8));
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    const pts = [[ax, ay]];
    for (let i = 1; i < k; i++) {
      const t = i / k;
      const off = ((rng.int(1001) / 1000) * 2 - 1) * AMP;
      pts.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
    }
    pts.push([bx, by]);
    return pts;
  };
  const Hc = [];
  for (let r = 1; r < rows; r++) {
    Hc[r] = [];
    for (let c = 0; c < cols; c++) Hc[r][c] = jag(c * cw, r * ch, (c + 1) * cw, r * ch);
  }
  const Vc = [];
  for (let c = 1; c < cols; c++) {
    Vc[c] = [];
    for (let r = 0; r < rows; r++) Vc[c][r] = jag(c * cw, r * ch, c * cw, (r + 1) * ch);
  }
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      const y0 = r * ch;
      const x1 = x0 + cw;
      const y1 = y0 + ch;
      const top = r === 0 ? [[x0, y0], [x1, y0]] : Hc[r][c];
      const right = c === cols - 1 ? [[x1, y0], [x1, y1]] : Vc[c + 1][r];
      const bottom = r === rows - 1 ? [[x1, y1], [x0, y1]] : Hc[r + 1][c].slice().reverse();
      const left = c === 0 ? [[x0, y1], [x0, y0]] : Vc[c][r].slice().reverse();
      const pts = [...top, ...right.slice(1), ...bottom.slice(1), ...left.slice(1, -1)];
      const torn = [r > 0 && top, c < cols - 1 && right, r < rows - 1 && bottom, c > 0 && left].filter(Boolean);
      out.push({ x0, y0, pts, torn });
    }
  }
  return out;
}

/**
 * 줄마다 글자 크기와 높이. 가로 찢긴 선이 글자 한가운데를 지나가지 않게
 * 줄을 세 띠(위/가운데/아래)에 나눠 넣는다. 줄이 띠보다 많으면 제목 띠에 함께 넣는다.
 */
function layoutText(lines, rows) {
  const meas = document.createElement('canvas').getContext('2d');
  const bands = Array.from({ length: rows }, () => []);
  if (lines.length <= rows) lines.forEach((_, i) => bands[i].push(i));
  else {
    const first = lines.length - (rows - 1);
    for (let i = 0; i < first; i++) bands[0].push(i);
    for (let j = 1; j < rows; j++) bands[j].push(first + j - 1);
  }
  const bandH = PH / rows;
  const maxW = PW * 0.8;
  const out = [];
  bands.forEach((idx, b) => {
    if (!idx.length) return;
    const weights = idx.map((i) => (i === 0 ? 0.62 : 1));
    const sum = weights.reduce((a, c) => a + c, 0);
    const edge = AMP + 9;
    const usable = bandH - 2 * edge;
    let y = b * bandH + edge;
    idx.forEach((i, k) => {
      const slotH = (usable * weights[k]) / sum;
      const title = i === 0;
      const weight = title ? 900 : 800;
      let size = Math.min(slotH * 0.7, title ? 32 : 58);
      meas.font = `${weight} ${size}px ${FONT}`;
      const w = meas.measureText(lines[i]).width;
      if (w > maxW) size *= maxW / w;
      out.push({ text: lines[i], size, weight, title, y: y + slotH / 2 });
      y += slotH;
    });
  });
  return out;
}

// ------------------------------------------------------------ 그림

function paintPaper(x, texts) {
  x.fillStyle = '#fbf6e6';
  x.fillRect(0, 0, PW, PH);
  // 줄 공책처럼 파란 가로줄과 빨간 여백 선
  x.strokeStyle = 'rgba(70, 120, 200, 0.22)';
  x.lineWidth = 1;
  for (let y = 34; y < PH; y += 26) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(PW, y);
    x.stroke();
  }
  x.strokeStyle = 'rgba(210, 70, 60, 0.35)';
  x.beginPath();
  x.moveTo(24, 0);
  x.lineTo(24, PH);
  x.stroke();
  const cx = PW / 2 + 8;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  texts.forEach((t) => {
    x.font = `${t.weight} ${t.size}px ${FONT}`;
    x.fillStyle = t.title ? '#2b2118' : '#1f3a8a';
    x.fillText(t.text, cx, t.y);
    if (t.title) {
      const w = x.measureText(t.text).width;
      x.strokeStyle = '#2b2118';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx - w / 2 - 8, t.y + t.size * 0.68);
      x.lineTo(cx + w / 2 + 8, t.y + t.size * 0.68);
      x.stroke();
    }
  });
  // 가장자리가 살짝 바랜 종이
  const v = x.createRadialGradient(PW / 2, PH / 2, PH * 0.3, PW / 2, PH / 2, PH * 0.75);
  v.addColorStop(0, 'rgba(160, 120, 60, 0)');
  v.addColorStop(1, 'rgba(160, 120, 60, 0.16)');
  x.fillStyle = v;
  x.fillRect(0, 0, PW, PH);
}

/** 조각 하나: 종이를 찢긴 모양으로 오려 내고, 찢긴 쪽에 하얀 섬유 테를 두른다 */
function pieceSprite(sh, paper, prs, cw, ch) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((cw + 2 * M) * prs);
  c.height = Math.ceil((ch + 2 * M) * prs);
  const x = c.getContext('2d');
  x.setTransform(prs, 0, 0, prs, 0, 0);
  x.translate(M - sh.x0, M - sh.y0);
  x.beginPath();
  sh.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
  x.save();
  x.clip();
  x.drawImage(paper, 0, 0, paper.width, paper.height, 0, 0, PW, PH);
  x.restore();
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  x.lineWidth = 2.2;
  sh.torn.forEach((seg) => {
    x.beginPath();
    seg.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.stroke();
  });
  x.strokeStyle = 'rgba(120, 90, 50, 0.25)';
  x.lineWidth = 0.8;
  x.beginPath();
  sh.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
  x.closePath();
  x.stroke();
  return c;
}

/** 조각 위쪽 가운데에 붙는 반투명 테이프. k 는 붙는 움직임 (0 → 1) */
function drawTape(g, cw, p, k) {
  g.save();
  g.translate(cw / 2, 2);
  g.rotate(p % 2 ? 0.09 : -0.09);
  const s = 1.25 - 0.25 * k;
  g.scale(s, s);
  g.globalAlpha = 0.35 + 0.55 * k;
  g.fillStyle = 'rgba(242, 230, 180, 0.9)';
  g.beginPath();
  const w = 22;
  const hh = 7;
  g.moveTo(-w, -hh);
  g.lineTo(w, -hh);
  for (let i = 0; i <= 4; i++) g.lineTo(w + (i % 2 ? 2.5 : 0), -hh + (i * hh * 2) / 4);
  g.lineTo(-w, hh);
  for (let i = 4; i >= 0; i--) g.lineTo(-w - (i % 2 ? 2.5 : 0), -hh + (i * hh * 2) / 4);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.fillRect(-w, -hh + 1.5, w * 2, 2);
  g.restore();
}

function rr(x, rx, ry, w, hh, r) {
  x.beginPath();
  x.moveTo(rx + r, ry);
  x.arcTo(rx + w, ry, rx + w, ry + hh, r);
  x.arcTo(rx + w, ry + hh, rx, ry + hh, r);
  x.arcTo(rx, ry + hh, rx, ry, r);
  x.arcTo(rx, ry, rx + w, ry, r);
  x.closePath();
}
