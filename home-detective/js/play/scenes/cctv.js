// 증거 장면: 지직거리는 CCTV (cctv)
// 잡음 가득한 방범 카메라 화면을 다이얼 두 개(채널, 선명도)로 맞추면 방 안이 또렷해진다.
// 신호가 잡히면 "몇 명이 있을까?" 보기에서 화면 속 사람 수를 고른다.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

const CAM_W = 320; // 카메라 원본 그림 크기 (화면 크기와 상관없이 고정)
const CAM_H = 240;
const TOL = 7; // 목표값에서 이만큼 안이면 맞은 것 (눈금 0~100)
const NEAR = 48; // 이만큼 떨어지면 아무것도 안 보인다
const DIALS = [{ name: '채널' }, { name: '선명도' }];
const MONO = "ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace";
const FONT = "'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif";

const CSS = `
.sc-cctv { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 10px;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.sc-cctv-tip { flex: none; font-weight: 800; font-size: clamp(13px, 4.1vw, 16px); line-height: 1.3; color: var(--ink); }
.sc-cctv-screen { flex: none; display: flex; justify-content: center; }
.sc-cctv-bezel { position: relative; padding: 8px; border-radius: 14px; background: linear-gradient(#3a4146, #22282c);
  box-shadow: 0 4px 0 rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.12); }
.sc-cctv-canvas { display: block; border-radius: 6px; background: #0c120e; }
.sc-cctv-badge { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); padding: 3px 12px; border-radius: 999px;
  background: rgba(10, 30, 16, .85); color: #8dff9f; border: 2px solid #4fd16a; font-weight: 900; font-size: 14px;
  white-space: nowrap; pointer-events: none; animation: sc-cctv-pop .35s ease; }
.sc-cctv-ctrl { flex: none; min-height: 116px; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.sc-cctv-dials { display: flex; flex-direction: column; gap: 10px; }
.sc-cctv-dial { display: flex; align-items: center; gap: 10px; }
.sc-cctv-name { flex: none; width: 66px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
  font-weight: 900; font-size: 14px; line-height: 1.1; color: var(--ink); white-space: nowrap; }
.sc-cctv-bars { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
.sc-cctv-bars i { display: block; width: 6px; border-radius: 1px; background: rgba(0,0,0,.15); transition: background .12s; }
.sc-cctv-bars i:nth-child(1) { height: 4px; } .sc-cctv-bars i:nth-child(2) { height: 6px; }
.sc-cctv-bars i:nth-child(3) { height: 9px; } .sc-cctv-bars i:nth-child(4) { height: 11px; } .sc-cctv-bars i:nth-child(5) { height: 14px; }
.sc-cctv-bars i.on { background: #e3a43a; }
.sc-cctv-dial.ok .sc-cctv-bars i.on { background: #2f9e58; }
.sc-cctv-track { position: relative; flex: 1; min-width: 0; height: 50px; border-radius: 12px; touch-action: none; cursor: pointer;
  background: linear-gradient(#1d2327, #2b3338); box-shadow: inset 0 2px 5px rgba(0,0,0,.6); outline: none; }
.sc-cctv-track:focus-visible { box-shadow: inset 0 2px 5px rgba(0,0,0,.6), 0 0 0 3px var(--gold); }
.sc-cctv-scale { position: absolute; left: 22px; right: 22px; top: 9px; bottom: 9px; pointer-events: none;
  background: repeating-linear-gradient(90deg, rgba(190,220,200,.45) 0 2px, transparent 2px 10%),
    repeating-linear-gradient(90deg, rgba(190,220,200,.22) 0 1px, transparent 1px 2.5%);
  -webkit-mask: linear-gradient(#000 0 30%, transparent 30% 70%, #000 70%); mask: linear-gradient(#000 0 30%, transparent 30% 70%, #000 70%); }
.sc-cctv-knob { position: absolute; top: 3px; width: 44px; height: 44px; margin-left: -22px; border-radius: 10px; pointer-events: none;
  background: linear-gradient(#f0e3c4, #c9b58a); box-shadow: 0 3px 0 #7c6a45, 0 4px 8px rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center; gap: 4px; }
.sc-cctv-knob i { display: block; width: 3px; height: 22px; border-radius: 2px; background: rgba(90,70,40,.55); }
.sc-cctv-dial.ok .sc-cctv-knob { background: linear-gradient(#c9f5d3, #7fd497); box-shadow: 0 3px 0 #2f7a48, 0 4px 8px rgba(0,0,0,.5); }
.sc-cctv-dials.locked { opacity: .45; pointer-events: none; }
.sc-cctv-ask { display: flex; flex-direction: column; gap: 8px; animation: sc-cctv-rise .3s ease; }
.sc-cctv-q { font-weight: 900; font-size: 18px; text-align: center; color: var(--ink); }
.sc-cctv-opts { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 6px; }
.sc-cctv-opts .btn { min-height: 52px; padding: 6px 2px; font-size: 18px; white-space: nowrap; }
.sc-cctv-opts .btn.no { text-decoration: line-through; opacity: .45; pointer-events: none; filter: grayscale(.8); }
.sc-cctv-opts .btn.yes { background: var(--green); color: #fff; }
@keyframes sc-cctv-pop { from { opacity: 0; transform: translateX(-50%) scale(.85); } }
@keyframes sc-cctv-rise { from { opacity: 0; transform: translateY(8px); } }
`;

export function mount(root, ctx) {
  ensureStyle('hd-scene-cctv', CSS);
  const rng = ctx.rng;
  const max = Math.max(1, Math.min(6, Math.round(Number(ctx.data && ctx.data.max) || 4)));
  const count = Math.max(0, Math.min(max, Math.round(Number(ctx.data && ctx.data.count) || 0)));

  // 목표값과 시작값: 시작은 목표에서 충분히 떨어지게
  const target = DIALS.map(() => 15 + rng.int(71));
  const value = target.map((t) => {
    const away = 36 + rng.int(20);
    const up = t + away <= 100;
    const down = t - away >= 0;
    return up && (!down || rng.bool()) ? t + away : t - away;
  });
  const people = placePeople(rng, count);
  const cam = paintRoom(people);

  // ---------------------------------------------------------- 화면 요소
  const tip = h('p', { class: 'sc-cctv-tip', text: '다이얼을 움직여 화면을 맞춰 봐' });
  const canvas = h('canvas', { class: 'sc-cctv-canvas', role: 'img', 'aria-label': '방범 카메라 화면' });
  const bezel = h('div', { class: 'sc-cctv-bezel' }, canvas);
  const screen = h('div', { class: 'sc-cctv-screen' }, bezel);
  const dials = DIALS.map((d) => makeDial(d));
  const dialBox = h('div', { class: 'sc-cctv-dials' }, dials.map((d) => d.el));
  const ctrl = h('div', { class: 'sc-cctv-ctrl' }, dialBox);
  const box = h('div', { class: 'sc-cctv' }, tip, screen, ctrl);
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
  let locked = false;
  let answered = false;
  let answerAt = 0;
  let ask = null;
  const optBtns = [];
  const startMs = performance.now();

  // ---------------------------------------------------------- 다이얼
  function makeDial(d) {
    const bars = h('span', { class: 'sc-cctv-bars', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4].map(() => h('i')));
    const knob = h('div', { class: 'sc-cctv-knob' }, h('i'), h('i'), h('i'));
    const track = h(
      'div',
      { class: 'sc-cctv-track', role: 'slider', tabindex: '0', 'aria-label': d.name, 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('div', { class: 'sc-cctv-scale' }),
      knob
    );
    const el = h('div', { class: 'sc-cctv-dial' }, h('div', { class: 'sc-cctv-name' }, h('span', { text: d.name }), bars), track);
    return { el, bars, knob, track, acc: 0 };
  }

  const dist = (i) => Math.abs(value[i] - target[i]);
  const close = (i) => (locked ? 1 : Math.max(0, 1 - dist(i) / NEAR));

  function paintDial(i) {
    const d = dials[i];
    d.knob.style.left = `calc(22px + (100% - 44px) * ${value[i] / 100})`;
    d.track.setAttribute('aria-valuenow', String(Math.round(value[i])));
    const ok = locked || dist(i) <= TOL;
    const lit = ok ? 5 : Math.round(close(i) * 4.4);
    [...d.bars.children].forEach((b, k) => b.classList.toggle('on', k < lit));
    d.el.classList.toggle('ok', ok);
  }

  function setValue(i, v) {
    if (locked || dead) return;
    const nv = Math.max(0, Math.min(100, v));
    const d = dials[i];
    const wasOk = dist(i) <= TOL;
    d.acc += Math.abs(nv - value[i]);
    value[i] = nv;
    // 가까워질수록 딸깍 소리가 촘촘해진다 (금속 탐지기처럼)
    const c = close(i);
    const step = c > 0.8 ? 1.6 : c > 0.5 ? 3 : 6;
    if (d.acc >= step) {
      d.acc = 0;
      ctx.sfx('tick');
    }
    if (!wasOk && dist(i) <= TOL) ctx.buzz(15);
    paintDial(i);
    if (dist(0) <= TOL && dist(1) <= TOL) lock();
  }

  dials.forEach((d, i) => {
    let pid = null;
    let grab = 0;
    const fromX = (clientX) => {
      const r = d.track.getBoundingClientRect();
      return ((clientX - grab - r.left - 22) / Math.max(1, r.width - 44)) * 100;
    };
    on(d.track, 'pointerdown', (e) => {
      if (locked) return;
      e.preventDefault();
      pid = e.pointerId;
      try {
        d.track.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 캡처를 못 해도 움직임은 받는다 */
      }
      const kr = d.knob.getBoundingClientRect();
      // 손잡이를 잡았으면 잡은 자리를 유지하고, 빈 곳을 누르면 그리로 옮긴다
      grab = e.clientX >= kr.left - 6 && e.clientX <= kr.right + 6 ? e.clientX - (kr.left + kr.width / 2) : 0;
      setValue(i, fromX(e.clientX));
    });
    on(d.track, 'pointermove', (e) => {
      if (e.pointerId !== pid) return;
      setValue(i, fromX(e.clientX));
    });
    const up = (e) => {
      if (e.pointerId === pid) pid = null;
    };
    on(d.track, 'pointerup', up);
    on(d.track, 'pointercancel', up);
    on(d.track, 'keydown', (e) => {
      const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -5, PageUp: 5 }[e.key];
      if (!k) return;
      e.preventDefault();
      setValue(i, value[i] + k);
    });
    paintDial(i);
  });

  // ---------------------------------------------------------- 신호 잡힘 → 질문
  function lock() {
    if (locked) return;
    locked = true;
    target.forEach((t, i) => (value[i] = t));
    dials.forEach((_, i) => paintDial(i));
    dialBox.classList.add('locked');
    bezel.append(h('div', { class: 'sc-cctv-badge', text: '신호 잡힘' }));
    ctx.sfx('good');
    ctx.buzz([20, 40, 20]);
    later(750, showAsk);
  }

  function showAsk() {
    if (ask) return;
    tip.textContent = '화면 속 사람을 세어 봐';
    const opts = h('div', { class: 'sc-cctv-opts', style: { '--n': String(max + 1) } });
    for (let n = 0; n <= max; n++) {
      const b = h('button', { class: 'btn', type: 'button', text: `${n}명`, onClick: () => choose(n, b) });
      optBtns[n] = b;
      opts.append(b);
    }
    ask = h('div', { class: 'sc-cctv-ask' }, h('p', { class: 'sc-cctv-q', text: '몇 명이 있을까?' }), opts);
    ctrl.replaceChildren(ask);
  }

  function choose(n, btn) {
    if (answered || dead) return;
    if (n !== count) {
      btn.classList.add('no');
      btn.setAttribute('aria-disabled', 'true');
      ctx.sfx('bad');
      ctx.buzz([60, 40, 60]);
      ctx.miss();
      shake(box);
      return;
    }
    answered = true;
    answerAt = performance.now();
    btn.classList.add('yes');
    optBtns.forEach((b) => b !== btn && b.setAttribute('aria-disabled', 'true'));
    ctx.sfx('good');
    later(1300, finish);
  }

  function finish() {
    if (finished || dead) return;
    finished = true;
    ctx.done();
  }

  // ---------------------------------------------------------- 그리기
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  const small = document.createElement('canvas'); // 흐림: 작게 줄였다 늘려서 만든다
  small.width = CAM_W;
  small.height = CAM_H;
  const sg = small.getContext('2d');
  const noises = makeNoise();
  let over = null; // 주사선 + 가장자리 어둡게 (크기마다 한 번)

  function resize() {
    // 안내 줄과 다이얼 칸을 뺀 나머지에 맞춘다 (테두리 16px). 높이가 정해지지 않은 상자면 폭에 맞춘다.
    // 화면을 잠깐 빼고 잰다: 캔버스 크기가 상자 높이를 밀어 올려 잘못 재는 일을 막는다
    screen.style.display = 'none';
    const boxH = box.clientHeight;
    screen.style.display = '';
    const aw = box.clientWidth - 16;
    let ah = boxH - tip.offsetHeight - ctrl.offsetHeight - 20 - 16;
    if (ah < 100) ah = Math.round(aw * 0.75);
    const w = Math.max(160, Math.floor(Math.min(aw, ah * (4 / 3))));
    const hh = Math.round(w * 0.75);
    if (w === cssW && hh === cssH) return;
    cssW = w;
    cssH = hh;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = w + 'px';
    canvas.style.height = hh + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    over = makeOverlay(canvas.width, canvas.height);
  }

  let raf = 0;
  let frameNo = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    frameNo++;
    const W = canvas.width;
    const H = canvas.height;
    if (!W) return;
    const t = ms / 1000;
    const a = close(0); // 채널: 잡음과 화면 흔들림
    const b = close(1); // 선명도: 흐림
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = '#060a08';
    g.fillRect(0, 0, W, H);

    // 흐림: 선명도가 멀수록 아주 작게 줄였다가 늘린다
    const k = locked ? 1 : 0.035 + 0.965 * Math.pow(b, 2.4);
    const sw = Math.max(4, Math.round(CAM_W * k));
    const sh = Math.max(3, Math.round(CAM_H * k));
    sg.clearRect(0, 0, CAM_W, CAM_H);
    sg.imageSmoothingEnabled = true;
    sg.drawImage(cam, 0, 0, sw, sh);
    g.imageSmoothingEnabled = true;

    const roll = locked ? 0 : 1 - a;
    if (roll > 0.02) {
      // 채널이 어긋나면 화면이 위로 흐르고 가로로 찢어진다
      const strips = 12;
      const yOff = ((t * H * 0.9 * roll) % H + H) % H;
      for (let j = 0; j < strips; j++) {
        const syy = (j / strips) * sh;
        const shh = sh / strips;
        const dy = (j / strips) * H + yOff;
        const dh = H / strips + 1;
        const jx = (Math.sin(t * 9 + j * 1.7) * 0.07 + (Math.random() - 0.5) * 0.05) * W * roll * roll;
        g.drawImage(small, 0, syy, sw, shh, jx, dy % H, W, dh);
        if (dy % H + dh > H) g.drawImage(small, 0, syy, sw, shh, jx, (dy % H) - H, W, dh);
      }
      // 흐르는 밝은 띠
      g.globalAlpha = 0.25 * roll;
      g.fillStyle = '#cfe8d6';
      g.fillRect(0, (yOff + H * 0.4) % H, W, H * 0.06);
      g.globalAlpha = 1;
    } else {
      g.drawImage(small, 0, 0, sw, sh, 0, 0, W, H);
    }

    // 눈 내리는 잡음
    const snow = locked ? 0.07 : Math.min(0.94, 0.08 + 0.86 * Math.pow(1 - a, 1.1) + 0.1 * (1 - b));
    g.imageSmoothingEnabled = false;
    g.globalAlpha = snow;
    g.drawImage(noises[frameNo % noises.length], 0, 0, W, H);
    g.globalAlpha = 1;
    g.drawImage(over, 0, 0);

    if (answered) drawCountMarks();
    drawHud(t);
  }

  function drawCountMarks() {
    // 맞히면 사람마다 번호를 붙여 다시 세어 보게 한다
    const k = Math.min(1, (performance.now() - answerAt) / 300);
    const sx = canvas.width / CAM_W;
    const sy = canvas.height / CAM_H;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (!people.length) {
      const fs = Math.round(canvas.width * 0.07);
      g.font = `900 ${fs}px ${FONT}`;
      g.globalAlpha = k;
      g.fillStyle = 'rgba(0,0,0,.6)';
      const tw = g.measureText('아무도 없어').width + fs;
      g.fillRect(canvas.width / 2 - tw / 2, canvas.height * 0.42 - fs * 0.8, tw, fs * 1.6);
      g.fillStyle = '#ffe680';
      g.fillText('아무도 없어', canvas.width / 2, canvas.height * 0.42);
      g.globalAlpha = 1;
      return;
    }
    const order = people.slice().sort((p, q) => p.x - q.x);
    order.forEach((p, i) => {
      const r = canvas.width * 0.045 * (0.6 + 0.4 * k);
      const x = p.x * sx;
      const y = (p.head - p.r * 1.6) * sy - r * 1.2;
      g.fillStyle = '#ffd95a';
      g.strokeStyle = '#2b2118';
      g.lineWidth = Math.max(2, r * 0.18);
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#2b2118';
      g.font = `900 ${Math.round(r * 1.3)}px ${FONT}`;
      g.fillText(String(i + 1), x, y + r * 0.05);
    });
  }

  function drawHud(t) {
    const W = canvas.width;
    const H = canvas.height;
    const fs = Math.max(10, Math.round(W * 0.042));
    const pad = fs * 0.8;
    g.font = `700 ${fs}px ${MONO}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(235, 255, 240, 0.85)';
    if (Math.floor(t * 1.4) % 2 === 0) {
      g.fillStyle = '#ff3b30';
      g.beginPath();
      g.arc(pad + fs * 0.4, pad + fs * 0.5, fs * 0.38, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(235, 255, 240, 0.85)';
    g.fillText('REC', pad + fs, pad);
    g.textAlign = 'right';
    g.fillText('CAM 2', W - pad, pad);
    const sec = Math.floor((performance.now() - startMs) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    g.textBaseline = 'bottom';
    g.fillText(`00:${mm}:${ss}`, W - pad, H - pad * 0.7);
    if (!locked) {
      g.textAlign = 'left';
      g.fillStyle = 'rgba(255, 210, 120, 0.9)';
      g.fillText('신호 약함', pad, H - pad * 0.7);
    }
  }

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => !dead && resize());
    ro.observe(box);
  } else on(window, 'resize', resize);
  resize();
  raf = requestAnimationFrame(frame);

  if (DEBUG) {
    // 검증용: 목표 눈금과 다이얼 위치
    window.__hdCctv = {
      targets: () => target.slice(),
      values: () => value.slice(),
      locked: () => locked,
      tracks: () =>
        dials.map((d) => {
          const r = d.track.getBoundingClientRect();
          return { left: r.left + 22, width: r.width - 44, y: r.top + r.height / 2 };
        }),
      knobs: () =>
        dials.map((d) => {
          const r = d.knob.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }),
      options: () =>
        optBtns.map((b) => {
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }),
    };
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
      if (DEBUG && window.__hdCctv) delete window.__hdCctv;
    },
    solve() {
      if (dead || finished) return;
      if (!locked) lock();
      showAsk();
      if (!answered) {
        answered = true;
        answerAt = performance.now();
        optBtns.forEach((b, n) => (n === count ? b.classList.add('yes') : b.setAttribute('aria-disabled', 'true')));
      }
      finish();
    },
  };
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// ------------------------------------------------------------ 사람 자리 (씨앗 난수)

function placePeople(rng, n) {
  if (!n) return [];
  // 화면 폭을 n 칸으로 나눠 한 칸에 한 명: 살짝 겹쳐도 머리는 따로 보인다
  const left = 62;
  const right = CAM_W - 62;
  const seg = (right - left) / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = left + (i + 0.5) * seg + (rng.int(21) - 10) * (seg / 100);
    const front = (i + rng.int(2)) % 2 === 0;
    const feet = front ? 214 + rng.int(10) : 192 + rng.int(10);
    const hgt = (front ? 112 : 98) + rng.int(10);
    const r = hgt * 0.12;
    out.push({ x, feet, hgt, r, head: feet - hgt + r });
  }
  return out.sort((p, q) => p.feet - q.feet); // 뒤에 선 사람부터 그린다
}

// ------------------------------------------------------------ 그림

/** 카메라가 비추는 방 (흑백 초록빛). 가구는 사람과 헷갈리지 않게 낮고 네모나게 */
function paintRoom(people) {
  const c = document.createElement('canvas');
  c.width = CAM_W;
  c.height = CAM_H;
  const x = c.getContext('2d');
  const horizon = 140;
  // 벽
  const wall = x.createLinearGradient(0, 0, 0, horizon);
  wall.addColorStop(0, '#5d7466');
  wall.addColorStop(1, '#7d9585');
  x.fillStyle = wall;
  x.fillRect(0, 0, CAM_W, horizon);
  // 바닥 (원근)
  const floor = x.createLinearGradient(0, horizon, 0, CAM_H);
  floor.addColorStop(0, '#53685a');
  floor.addColorStop(1, '#3d4f43');
  x.fillStyle = floor;
  x.fillRect(0, horizon, CAM_W, CAM_H - horizon);
  x.strokeStyle = 'rgba(30, 45, 36, 0.5)';
  x.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    x.beginPath();
    x.moveTo(CAM_W / 2 + i * 30, horizon);
    x.lineTo(CAM_W / 2 + i * 80, CAM_H);
    x.stroke();
  }
  x.strokeStyle = 'rgba(25, 38, 30, 0.7)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(0, horizon);
  x.lineTo(CAM_W, horizon);
  x.stroke();
  // 걸레받이
  x.fillStyle = '#4a5e50';
  x.fillRect(0, horizon - 6, CAM_W, 6);

  // 창문 (왼쪽 벽)
  x.fillStyle = '#a9c2b1';
  x.fillRect(22, 28, 74, 62);
  x.strokeStyle = '#3c4f43';
  x.lineWidth = 4;
  x.strokeRect(22, 28, 74, 62);
  x.lineWidth = 2.5;
  x.beginPath();
  x.moveTo(59, 28);
  x.lineTo(59, 90);
  x.moveTo(22, 59);
  x.lineTo(96, 59);
  x.stroke();
  // 문 (오른쪽 벽)
  x.fillStyle = '#4f6556';
  x.fillRect(244, 34, 50, 106);
  x.strokeStyle = '#33443a';
  x.lineWidth = 3;
  x.strokeRect(244, 34, 50, 106);
  x.fillStyle = '#c9dccd';
  x.beginPath();
  x.arc(285, 92, 3, 0, Math.PI * 2);
  x.fill();
  // 벽시계
  x.fillStyle = '#c3d6c8';
  x.beginPath();
  x.arc(170, 36, 13, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#33443a';
  x.lineWidth = 2;
  x.stroke();
  x.beginPath();
  x.moveTo(170, 36);
  x.lineTo(170, 27);
  x.moveTo(170, 36);
  x.lineTo(177, 38);
  x.stroke();
  // 소파 (뒷벽에 붙은 낮은 상자)
  x.fillStyle = '#3e5245';
  rr(x, 112, 98, 112, 30, 7);
  x.fill();
  x.fillStyle = '#4a6051';
  rr(x, 104, 112, 128, 30, 7);
  x.fill();
  x.strokeStyle = 'rgba(200, 225, 205, 0.35)';
  x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(146, 114);
  x.lineTo(146, 140);
  x.moveTo(190, 114);
  x.lineTo(190, 140);
  x.stroke();
  // 깔개
  x.fillStyle = 'rgba(120, 145, 128, 0.45)';
  x.beginPath();
  x.ellipse(165, 196, 108, 26, 0, 0, Math.PI * 2);
  x.fill();
  // 낮은 탁자
  x.fillStyle = '#34463b';
  rr(x, 136, 160, 64, 12, 3);
  x.fill();
  x.fillRect(142, 172, 5, 12);
  x.fillRect(189, 172, 5, 12);

  // 사람 실루엣: 머리 + 어깨가 둥근 몸통 + 다리. 테두리를 밝게 둘러 겹쳐도 경계가 보이게
  people.forEach((p) => {
    const sw = p.hgt * 0.2;
    const top = p.feet - p.hgt + p.r * 2 + p.hgt * 0.02;
    const hip = p.feet - p.hgt * 0.4;
    x.fillStyle = '#0b120e';
    x.strokeStyle = '#6f8a78';
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(p.x - sw, hip);
    x.lineTo(p.x - sw, top + sw * 0.7);
    x.quadraticCurveTo(p.x - sw, top, p.x - sw * 0.3, top);
    x.lineTo(p.x + sw * 0.3, top);
    x.quadraticCurveTo(p.x + sw, top, p.x + sw, top + sw * 0.7);
    x.lineTo(p.x + sw, hip);
    // 다리 둘
    x.lineTo(p.x + sw * 0.72, hip);
    x.lineTo(p.x + sw * 0.66, p.feet);
    x.lineTo(p.x + sw * 0.08, p.feet);
    x.lineTo(p.x, hip + p.hgt * 0.08);
    x.lineTo(p.x - sw * 0.08, p.feet);
    x.lineTo(p.x - sw * 0.66, p.feet);
    x.lineTo(p.x - sw * 0.72, hip);
    x.closePath();
    x.fill();
    x.stroke();
    x.beginPath();
    x.arc(p.x, p.head, p.r, 0, Math.PI * 2);
    x.fill();
    x.stroke();
  });

  // 카메라 렌즈처럼 가장자리를 어둡게
  const v = x.createRadialGradient(CAM_W / 2, CAM_H / 2, CAM_H * 0.35, CAM_W / 2, CAM_H / 2, CAM_W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  x.fillStyle = v;
  x.fillRect(0, 0, CAM_W, CAM_H);
  return c;
}

/** 잡음 몇 장을 미리 만들어 돌려 쓴다 (낮은 해상도를 늘려 그려서 가볍다) */
function makeNoise() {
  const out = [];
  for (let n = 0; n < 6; n++) {
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 90;
    const x = c.getContext('2d');
    const img = x.createImageData(120, 90);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = v * 0.9;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.92;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    out.push(c);
  }
  return out;
}

function makeOverlay(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0, 0, 0, 0.16)';
  const step = Math.max(2, Math.round(H / 120));
  for (let y = 0; y < H; y += step * 2) x.fillRect(0, y, W, step);
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = v;
  x.fillRect(0, 0, W, H);
  return c;
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
