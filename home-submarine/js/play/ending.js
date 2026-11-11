// 결말 화면: 부상 → 등급 → 보물 공개 → 항해 일지 → 마무리. 아이가 혼자 한 장씩 넘겨 본다.
//
// 규격
//   showEnding(root, ctx) → { destroy() }
//   root  화면 전체를 덮는 빈 요소 (100dvh, 세로 flex)
//   ctx   { setup, stations, state, markRecorded(), onNewMission(), onHome() }
//         state 는 phase 가 'done' 인 엔진 상태다. 기록 저장(addHistory)은 이 화면이 한 번만 한다
//         (state.recorded 가 없을 때 저장하고, ctx.markRecorded() 를 불러 바깥이 저장하게 한다).
//         state.forced === true 면 부모가 끝낸 것: 부상 연출 없이 보물 공개, 등급은 C.
//         다시 들어오면(state.recorded 가 이미 있으면) 부상 장을 건너뛰고 등급 장부터 보여 준다.
//   돌려주는 값에는 검증용으로 page(), next(), prev(), go(i), timers(), openReport() 도 들어 있다.

import { h, fill, buzz } from '../shared/dom.js';
import { clock, bonusUnlocked } from '../shared/score.js';
import { gradeLine } from '../shared/text.js';
import { TREASURE_KINDS } from '../shared/content.js';
import { addHistory, loadHistory } from '../shared/store.js';
import { audio } from './audio.js';
import { renderLogbook, canvasBlob, drawSub, drawChest } from './logbook.js';
import { showReport, outcome } from './report.js';

const MINUS_NAMES = { damage: '선체 손상', retry: '다시 도전', query: '도착 확인 실수', memory: '암호·순서 실수', rescue: '부모 도움' };

/** 이 화면이 만든 타이머와 애니메이션 프레임을 모아 두었다가 destroy 때 한꺼번에 지운다 */
function timerBag() {
  const outs = new Set();
  const frames = new Set();
  return {
    after(ms, fn) {
      const id = setTimeout(() => {
        outs.delete(id);
        fn();
      }, ms);
      outs.add(id);
      return id;
    },
    cancel(id) {
      clearTimeout(id);
      outs.delete(id);
    },
    frame(fn) {
      const id = requestAnimationFrame((t) => {
        frames.delete(id);
        fn(t);
      });
      frames.add(id);
      return id;
    },
    cancelFrame(id) {
      cancelAnimationFrame(id);
      frames.delete(id);
    },
    clear() {
      outs.forEach((id) => clearTimeout(id));
      frames.forEach((id) => cancelAnimationFrame(id));
      outs.clear();
      frames.clear();
    },
    count: () => outs.size + frames.size,
  };
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1);
  const b = p(c2);
  return 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',') + ')';
};

/** 캔버스를 요소 크기에 맞춘다 (devicePixelRatio 최대 2). 돌려주는 값: 그릴 수 있으면 { g, W, H } */
function fitCanvas(canvas) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (!W || !H) return null;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(W * ratio);
  const ph = Math.round(H * ratio);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { g, W, H };
}

// 부상 연출 시간표 (ms)
const RISE = 2600; // 1000m → 0m
const LEAP = 420; // 물 밖으로 솟구침
const FALL = 480; // 다시 물에 떨어짐
const SETTLED = RISE + LEAP + FALL + 900;
const STILL = RISE + 5200; // 이 뒤로는 그림을 멈춘다 (전지를 아끼려고)

export function showEnding(root, ctx) {
  const { setup, state } = ctx;
  const T = timerBag();
  const res = outcome(state);
  const forced = res.forced;
  const firstVisit = !state.recorded;
  let dead = false;
  let report = null;
  let logUrl = null;

  // 기록은 처음 한 번만. 새로고침해도 다시 쌓이지 않게 바깥(state.recorded)에 표시해 둔다.
  if (firstVisit) {
    addHistory({
      at: Date.now(),
      missionNo: setup.missionNo,
      captain: setup.captain,
      grade: res.grade,
      score: res.score,
      totalMs: state.clock,
      hull: state.hull,
      hullMax: state.hullMax,
      difficulty: state.difficulty,
      retries: state.retries,
    });
    if (typeof ctx.markRecorded === 'function') ctx.markRecorded();
  }
  // 항해 일지의 날짜: 다시 들어와도 임무를 끝낸 날로
  const record = loadHistory().find((x) => x.missionNo === setup.missionNo && x.totalMs === state.clock);
  const finishedAt = record ? record.at : Date.now();

  audio.music.stop();
  // 새로고침으로 들어오면 아직 터치가 없어 소리가 잠겨 있다
  const unlock = () => audio.unlock();
  root.addEventListener('pointerdown', unlock, { once: true });

  const names = forced ? ['grade', 'treasure', 'log', 'finish'] : ['surface', 'grade', 'treasure', 'log', 'finish'];
  const pages = new Map();
  let index = firstVisit && !forced ? 0 : names.indexOf('grade');

  const stage = h('div', { class: 'end-stage' });
  const dots = h('div', { class: 'end-dots', 'aria-hidden': 'true' }, names.map(() => h('span')));
  const prevBtn = h('button', { class: 'btn ghost end-prev', type: 'button', text: '이전', onClick: () => go(index - 1) });
  const nextBtn = h('button', { class: 'btn primary end-next', type: 'button', text: '다음', onClick: () => advance() });
  const nav = h('nav', { class: 'end-nav' }, prevBtn, dots, nextBtn);
  const box = h('div', { class: 'end' }, stage, nav);
  root.append(box);

  // ---------- 1. 부상 ----------
  function surfacePage() {
    const canvas = h('canvas', { class: 'end-sea', 'aria-hidden': 'true' });
    const num = h('b', { class: 'end-depth-num', text: '1000' });
    const meter = h('div', { class: 'end-depth', 'aria-label': '수심' }, h('span', { class: 'k', text: '수심' }), num, h('span', { class: 'u', text: 'm' }));
    const title = h('div', { class: 'end-surface-title' }, h('h2', { text: '임무 성공' }), h('p', { text: '보물 상자를 건져 올렸어!' }));
    const tip = h('p', { class: 'end-tip end-surface-tip', text: '화면을 누르면 다음 장' });
    const node = h('div', { class: 'end-page end-surface', onClick: () => advance() }, canvas, meter, title, tip);

    // 바다 눈(떠다니는 알갱이): 위치만 정해 두고 올라가는 만큼 아래로 흘린다
    const snow = Array.from({ length: 46 }, (_, i) => ({ x: ((i * 73) % 100) / 100, y: ((i * 37) % 100) / 100, r: 1 + (i % 3) * 0.8 }));
    let t0 = null;
    let shift = 0; // 건너뛰기: 시간을 앞으로 당긴다
    let frameId = null;
    let last = 0;
    let breached = false;
    let landed = false;
    let titled = false;
    const splash = [];

    function emit(x, y, n, power, H) {
      const k = H / 700;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const v = (0.35 + Math.random() * 0.6) * power * k;
        splash.push({ x: x + (Math.random() - 0.5) * 120 * k, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.6 + Math.random() * 3.6, life: 1 });
      }
    }
    function showTitle() {
      if (titled) return;
      titled = true;
      title.classList.add('on');
      node.classList.add('surfaced');
    }
    function breach() {
      if (breached) return;
      breached = true;
      audio.sfx('surface');
      buzz([40, 60, 40]);
    }

    function draw(t, dt) {
      const fit = fitCanvas(canvas);
      if (!fit) return;
      const { g, W, H } = fit;
      const p = clamp(t / RISE, 0, 1);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const dep = t < RISE ? 1000 * (1 - e) : 0;
      const shallow = 1 - dep / 1000;
      num.textContent = String(Math.round(dep));
      meter.classList.toggle('zero', dep <= 0);

      const s = clamp(Math.min(W / 400, H / 620), 0.55, 1.15) * 0.82;
      // 작은 화면에서는 수면을 위로 올려 아래 "임무 성공" 글자와 상자가 겹치지 않게
      const restY = H * (H < 560 ? 0.4 : 0.47);
      const surfY = dep > 170 ? -60 : lerp(-60, restY, 1 - dep / 170);
      const subX = W * 0.5;
      const under = H * 0.64;
      const rest = restY - 14 * s;
      let subY;
      let tilt;
      if (t < RISE) {
        subY = under + Math.sin(t / 300) * 3;
        tilt = -0.2;
      } else {
        const u = t - RISE;
        const peak = restY - H * 0.15;
        if (u < LEAP) {
          const k = 1 - Math.pow(1 - u / LEAP, 3);
          subY = lerp(under, peak, k);
          tilt = lerp(-0.26, -0.04, k);
        } else if (u < LEAP + FALL) {
          const k = Math.pow((u - LEAP) / FALL, 2);
          subY = lerp(peak, rest + 16, k);
          tilt = lerp(-0.04, 0.07, k);
        } else {
          const v = u - LEAP - FALL;
          subY = rest + 16 * Math.exp(-v / 320) * Math.cos(v / 170) + Math.sin(t / 800) * 3;
          tilt = 0.07 * Math.exp(-v / 420) * Math.cos(v / 210) + Math.sin(t / 1100) * 0.02;
        }
        if (!breached) {
          breach();
          emit(subX, surfY, 34, 1.15, H);
        }
        if (!landed && u >= LEAP + FALL) {
          landed = true;
          emit(subX, surfY, 22, 0.7, H);
        }
        if (u > 150) showTitle();
      }

      // 바닷물: 깊을수록 어둡게
      const sea = g.createLinearGradient(0, 0, 0, H);
      sea.addColorStop(0, mix('#06223a', '#38b6e0', shallow));
      sea.addColorStop(1, mix('#010810', '#0c5f8c', shallow));
      g.fillStyle = sea;
      g.fillRect(0, 0, W, H);

      // 하늘과 해 (수면이 화면에 들어온 뒤)
      if (surfY > 0) {
        const sky = g.createLinearGradient(0, 0, 0, surfY);
        sky.addColorStop(0, '#5ec8f2');
        sky.addColorStop(1, '#d9f4ff');
        g.fillStyle = sky;
        g.fillRect(0, 0, W, surfY);
        g.save();
        g.beginPath();
        g.rect(0, 0, W, surfY);
        g.clip();
        const sx = W * 0.8;
        const sy = surfY - H * 0.32;
        g.translate(sx, sy);
        g.rotate(t / 4000);
        g.fillStyle = 'rgba(255, 244, 180, 0.45)';
        for (let i = 0; i < 12; i++) {
          g.rotate((Math.PI * 2) / 12);
          g.beginPath();
          g.moveTo(0, 0);
          g.lineTo(H * 0.5, -14);
          g.lineTo(H * 0.5, 14);
          g.closePath();
          g.fill();
        }
        g.rotate(-t / 4000);
        const sun = g.createRadialGradient(0, 0, 4, 0, 0, 44);
        sun.addColorStop(0, '#fffbe0');
        sun.addColorStop(0.55, '#ffe066');
        sun.addColorStop(1, 'rgba(255, 224, 102, 0)');
        g.fillStyle = sun;
        g.beginPath();
        g.arc(0, 0, 44, 0, Math.PI * 2);
        g.fill();
        g.restore();
        // 구름
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        for (const [cx, cy, cr] of [[0.18, 0.2, 1], [0.3, 0.13, 0.7]]) {
          const x = ((cx * W + t / 60) % (W + 120)) - 60;
          const y = surfY - H * (0.5 - cy);
          g.beginPath();
          g.ellipse(x, y, 34 * cr, 12 * cr, 0, 0, Math.PI * 2);
          g.ellipse(x + 20 * cr, y - 8 * cr, 22 * cr, 12 * cr, 0, 0, Math.PI * 2);
          g.fill();
        }
      }

      // 물속 햇살
      const top = Math.max(0, surfY);
      g.save();
      g.beginPath();
      g.rect(0, top, W, H - top);
      g.clip();
      g.fillStyle = 'rgba(200, 240, 255, ' + (0.03 + 0.16 * shallow) + ')';
      for (let i = 0; i < 5; i++) {
        const x = W * (0.1 + i * 0.22) + Math.sin(t / 900 + i) * 12;
        g.beginPath();
        g.moveTo(x - 18, top);
        g.lineTo(x + 18, top);
        g.lineTo(x + 70, H);
        g.lineTo(x - 30, H);
        g.closePath();
        g.fill();
      }
      // 바다 눈: 위로 올라가는 만큼 아래로 흐른다
      const scroll = ((1000 - dep) / 1000) * H * 7;
      g.fillStyle = 'rgba(220, 245, 255, 0.55)';
      for (const f of snow) {
        const y = (((f.y * H + scroll) % H) + H) % H;
        if (y < top) continue;
        g.beginPath();
        g.arc(f.x * W, y, f.r, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      // 상자와 줄 (잠수함 배 밑에 매달려 흔들린다)
      const ang = Math.sin(t / 520) * 0.22;
      const ax = subX - 12 * s;
      const ay = subY + 34 * s;
      const len = 62 * s;
      const cx = ax + Math.sin(ang) * len;
      const cy = ay + Math.cos(ang) * len + 24 * s;
      g.strokeStyle = '#17232b';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(cx, cy - 22 * s);
      g.stroke();
      const pulse = breached ? 0.6 + 0.4 * Math.sin(t / 260) : 0.25;
      drawChest(g, cx, cy, 0.62 * s, { glow: pulse });
      drawSub(g, subX, subY, s, { tilt, prop: t / 60 });

      // 수면: 물에 잠긴 부분을 물빛으로 덮고 물결을 그린다
      if (surfY > 0) {
        const wave = (x) => surfY + Math.sin(x / 26 + t / 260) * 4 + Math.sin(x / 61 - t / 400) * 3;
        g.fillStyle = 'rgba(18, 128, 182, 0.42)';
        g.beginPath();
        g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, wave(x));
        g.lineTo(W, H);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        g.lineWidth = 3;
        g.beginPath();
        for (let x = 0; x <= W; x += 8) g.lineTo(x, wave(x));
        g.stroke();
      }

      // 물보라
      const grav = 0.0021 * (H / 700);
      for (let i = splash.length - 1; i >= 0; i--) {
        const d = splash[i];
        d.vy += grav * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.vy > 0 && d.y > surfY + 6) {
          splash.splice(i, 1);
          continue;
        }
        g.fillStyle = 'rgba(255, 255, 255, 0.9)';
        g.beginPath();
        g.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        g.fill();
      }
    }

    function loop(now) {
      frameId = null;
      if (dead) return;
      if (t0 === null) t0 = now;
      const t = now - t0 + shift;
      const dt = Math.min(48, last ? now - last : 16);
      last = now;
      draw(t, dt);
      if (t < STILL || splash.length) frameId = T.frame(loop);
    }
    function start() {
      if (reducedMotion()) {
        shift = SETTLED;
        breach();
        breached = landed = true;
        t0 = performance.now();
        draw(SETTLED, 16);
        showTitle();
        return;
      }
      if (frameId === null) frameId = T.frame(loop);
    }
    return {
      node,
      enter() {
        // 크기를 재려면 화면에 붙은 뒤여야 한다
        T.frame(() => !dead && start());
      },
      leave() {
        if (frameId !== null) T.cancelFrame(frameId);
        frameId = null;
        // 다시 돌아오면 물 위에 뜬 모습부터 (연출을 처음부터 되풀이하지 않는다)
        t0 = null;
        last = 0;
        shift = SETTLED;
        breached = landed = true;
        splash.length = 0;
        showTitle();
      },
      step() {
        if (titled) return false;
        // 연출을 건너뛰고 물 위에 뜬 모습으로
        const now = performance.now();
        const t = t0 === null ? 0 : now - t0 + shift;
        shift += Math.max(0, SETTLED - t);
        if (!breached) breach();
        breached = landed = true;
        splash.length = 0;
        showTitle();
        if (frameId === null) frameId = T.frame(loop);
        return true;
      },
      state: () => ({ titled, breached, depth: Number(num.textContent) }),
    };
  }

  // ---------- 2. 등급 ----------
  function gradePage() {
    const g = res.grade;
    const big = h('div', { class: 'end-grade g-' + g, role: 'img', 'aria-label': g + ' 등급' }, h('span', { class: 'end-grade-letter', text: g }), h('span', { class: 'end-grade-sub', text: '등급' }));
    const cells = h('span', { class: 'end-hull', 'aria-hidden': 'true' }, Array.from({ length: state.hullMax }, (_, i) => h('i', { class: i < state.hull ? 'on' : '' })));
    const rows = [
      h('div', { class: 'end-row', 'data-row': 'time' }, h('span', { text: '걸린 시간' }), h('b', { text: clock(state.clock) })),
      h('div', { class: 'end-row', 'data-row': 'hull' }, h('span', { text: '남은 선체' }), h('b', {}, cells, ' ' + state.hull + ' / ' + state.hullMax + '칸')),
    ];
    let minus = [];
    if (forced) {
      rows.push(h('div', { class: 'end-row', 'data-row': 'fixed' }, h('span', { text: '고친 고장' }), h('b', { text: state.stats.resolved.length + '개' })));
      rows.push(h('p', { class: 'end-forced', text: '부모님과 함께 마무리해서 등급은 C야.' }));
    } else {
      rows.push(h('div', { class: 'end-row', 'data-row': 'score' }, h('span', { text: '점수' }), h('b', { text: res.score + '점' })));
      minus = Object.keys(MINUS_NAMES).filter((k) => res.parts[k] > 0);
      rows.push(
        h(
          'div',
          { class: 'end-minus' },
          minus.length ? minus.map((k) => h('span', { class: 'chip', 'data-part': k, text: MINUS_NAMES[k] + ' −' + res.parts[k] })) : h('span', { class: 'end-perfect', text: '깎인 점수 없음' })
        )
      );
    }
    const node = h(
      'div',
      { class: 'end-page end-gradepage' },
      h('p', { class: 'end-kicker', text: '임무 결과' }),
      big,
      h('p', { class: 'end-praise', text: forced ? '부모님과 함께 임무를 마무리했어. 다음엔 혼자서 물 위까지 가 보자.' : gradeLine(g) }),
      h('div', { class: 'card end-card' }, rows)
    );
    let shown = false;
    return {
      node,
      enter() {
        if (shown) return;
        shown = true;
        big.classList.add('slam');
        T.after(300, () => {
          audio.sfx('stage');
          buzz(30);
        });
      },
      state: () => ({ grade: g, score: res.score, minus, hull: state.hull }),
    };
  }

  // ---------- 3. 보물 공개 ----------
  function treasurePage() {
    const kind = TREASURE_KINDS.find((k) => k.id === (setup.treasure && setup.treasure.kind)) || TREASURE_KINDS[1];
    const text = ((setup.treasure && setup.treasure.text) || '').trim() || '부모님께 물어봐!';
    const len = Array.from(text).length;
    const size = len <= 6 ? 'xl' : len <= 12 ? 'l' : len <= 24 ? 'm' : 's';
    const bonusText = ((setup.bonus && setup.bonus.text) || '').trim();
    const rule = (setup.bonus && setup.bonus.rule) || 'A';
    const unlocked = !!bonusText && bonusUnlocked(res.grade, rule);

    const chest = h(
      'button',
      { class: 'end-chest', type: 'button', 'aria-label': '보물 상자 열기', onClick: (e) => (e.stopPropagation(), open()) },
      h('span', { class: 'end-chest-rays', 'aria-hidden': 'true' }),
      h('span', { class: 'end-chest-glow', 'aria-hidden': 'true' }),
      h('span', { class: 'end-chest-inside', 'aria-hidden': 'true' }),
      h('span', { class: 'end-chest-body', 'aria-hidden': 'true' }, h('i', { class: 'band l' }), h('i', { class: 'band r' }), h('i', { class: 'weed' }), h('i', { class: 'barn' })),
      h('span', { class: 'end-chest-lid', 'aria-hidden': 'true' }, h('i', { class: 'band l' }), h('i', { class: 'band r' })),
      h('span', { class: 'end-chest-lock', 'aria-hidden': 'true' }),
      h('span', { class: 'end-drip d1', 'aria-hidden': 'true' }),
      h('span', { class: 'end-drip d2', 'aria-hidden': 'true' }),
      h('span', { class: 'end-drip d3', 'aria-hidden': 'true' })
    );
    const revealSlot = h('div', { class: 'end-reveal-slot', 'aria-live': 'polite' });
    const bonusSlot = h('div', { class: 'end-bonus-slot' });
    const tip = h('p', { class: 'end-tip', text: '상자를 눌러서 열어 봐' });
    const spark = h('canvas', { class: 'end-spark', 'aria-hidden': 'true' });
    const trove = h('div', { class: 'end-trove' }, chest);
    const node = h(
      'div',
      { class: 'end-page end-treasure' },
      spark,
      h('p', { class: 'end-kicker', text: '보물 공개' }),
      h('h2', { class: 'end-title', text: forced ? '부모님이 상자를 건져 줬어' : '건져 올린 보물 상자야' }),
      revealSlot,
      trove,
      bonusSlot,
      tip
    );
    let opened = false;
    let settled = false;
    let stopSpark = () => {};
    const ids = [];

    // 상자를 열기 전에는 보물 글을 DOM 에 넣지 않는다
    function revealNode() {
      return h(
        'div',
        { class: 'end-reveal' },
        h('p', { class: 'end-reveal-lead', text: kind.lead }),
        h('p', { class: 'end-reveal-text ' + size + (kind.id === 'lock' ? ' lock' : ''), text: text })
      );
    }
    function bonusNode() {
      if (!bonusText) return null;
      // 못 받은 보너스는 문구를 DOM 에 아예 넣지 않는다 (아이가 미리 알면 안 된다)
      if (unlocked) return h('div', { class: 'end-bonus' }, h('p', { class: 'end-bonus-head', text: '보너스 보상도 받았어!' }), h('p', { class: 'end-bonus-text', text: bonusText }));
      const need = rule === 'S' ? 'S 등급이어야 받을 수 있어' : 'A 등급부터야';
      return h('div', { class: 'end-bonus locked' }, h('p', { text: '보너스 보상은 ' + need + '. 다음 임무에서 도전!' }));
    }
    function reveal() {
      if (!revealSlot.firstChild) revealSlot.append(revealNode());
      node.classList.add('revealed');
      tip.hidden = true;
    }
    function addBonus() {
      const b = bonusNode();
      if (b && !bonusSlot.firstChild) bonusSlot.append(b);
      settled = true;
    }
    function settle() {
      if (settled) return;
      ids.forEach((id) => T.cancel(id));
      ids.length = 0;
      opened = true;
      chest.classList.add('open');
      reveal();
      addBonus();
      paintNext();
    }
    function open() {
      if (opened) return;
      opened = true;
      chest.classList.add('open');
      chest.setAttribute('aria-label', '보물 상자가 열렸어');
      paintNext();
      audio.sfx('click');
      buzz(30);
      const quick = reducedMotion();
      ids.push(T.after(quick ? 0 : 260, () => audio.sfx('water')));
      ids.push(
        T.after(quick ? 0 : 620, () => {
          reveal();
          audio.sfx('stage');
          buzz([30, 50, 30]);
          if (!quick) stopSpark = sparkle(spark, chest, T);
        })
      );
      ids.push(
        T.after(quick ? 0 : 1600, () => {
          addBonus();
          if (bonusText) audio.sfx(unlocked ? 'good' : 'tap');
        })
      );
    }
    return {
      node,
      label: () => (opened ? '다음' : '상자 열기'),
      leave() {
        if (opened) settle();
        stopSpark();
      },
      step() {
        if (!opened) {
          open();
          return true;
        }
        if (!settled) {
          settle();
          return true;
        }
        return false;
      },
      state: () => ({ opened, settled, bonus: bonusText ? (unlocked ? 'open' : 'locked') : 'none' }),
    };
  }

  // ---------- 4. 항해 일지 ----------
  function logPage() {
    const frame = h('div', { class: 'end-log-frame' }, h('p', { class: 'end-log-wait', text: '항해 일지를 쓰는 중…' }));
    const save = h('a', {
      class: 'btn warn block end-save',
      href: '#',
      role: 'button',
      'aria-disabled': 'true',
      text: '사진으로 저장',
      onClick: (e) => {
        if (save.getAttribute('aria-disabled') === 'true') {
          e.preventDefault();
          return;
        }
        audio.sfx('tap');
      },
    });
    const node = h(
      'div',
      { class: 'end-page end-logpage' },
      h('p', { class: 'end-kicker', text: '항해 일지' }),
      frame,
      save,
      h('p', { class: 'end-tip small', text: '저장이 안 되면 그림을 길게 눌러서 저장해.' })
    );
    let ready = false;
    let layout = null;
    let started = false;
    function build() {
      if (started) return;
      started = true;
      let canvas;
      try {
        canvas = renderLogbook({ setup, state, grade: res.grade, forced, at: finishedAt });
        layout = canvas.layout || null;
      } catch (err) {
        console.warn('항해 일지를 그리지 못했어요', err);
        fill(frame, h('p', { class: 'end-log-wait', text: '항해 일지를 만들지 못했어. 다음 장으로 넘어가자.' }));
        return;
      }
      canvasBlob(canvas).then((blob) => {
        if (dead) return;
        if (!blob) {
          fill(frame, h('p', { class: 'end-log-wait', text: '항해 일지를 만들지 못했어. 다음 장으로 넘어가자.' }));
          return;
        }
        logUrl = URL.createObjectURL(blob);
        fill(frame, h('img', { src: logUrl, alt: '잠수함 간식호 항해 일지 임무 No.' + (setup.missionNo || 1) }));
        save.href = logUrl;
        save.setAttribute('download', '잠수함간식호-항해일지-' + (setup.missionNo || 1) + '.png');
        save.removeAttribute('aria-disabled');
        ready = true;
      });
    }
    return { node, enter: build, state: () => ({ ready, href: ready ? save.href : null, layout }) };
  }

  // ---------- 5. 마무리 ----------
  function finishPage() {
    const art = h('canvas', { class: 'end-finish-art', width: 400, height: 200, 'aria-hidden': 'true' });
    const g = art.getContext('2d');
    if (g) {
      g.scale(2, 2);
      drawSub(g, 82, 62, 0.55, { tilt: -0.04 });
      drawChest(g, 158, 76, 0.4, { glow: 0.8 });
    }
    const node = h(
      'div',
      { class: 'end-page end-finish' },
      art,
      h('h2', { class: 'end-title', text: '임무 끝!' }),
      h('p', { class: 'end-praise', text: '부모님께 폰을 돌려주자.' }),
      h('p', { class: 'end-tip', text: forced ? '오늘 어디까지 내려갔는지 이야기해 줘.' : '어느 고장이 제일 어려웠는지 이야기해 줘.' }),
      h(
        'div',
        { class: 'end-finish-actions' },
        h('button', { class: 'btn warn block end-report', type: 'button', text: '관찰 리포트 보기 (부모)', onClick: () => openReport() }),
        h('button', { class: 'btn primary block end-again', type: 'button', text: '쪽지 그대로 새 임무', onClick: () => ctx.onNewMission && ctx.onNewMission() }),
        h('button', { class: 'btn ghost block end-home', type: 'button', text: '처음으로', onClick: () => ctx.onHome && ctx.onHome() })
      )
    );
    return { node };
  }

  const builders = { surface: surfacePage, grade: gradePage, treasure: treasurePage, log: logPage, finish: finishPage };

  function render() {
    const name = names[index];
    let pg = pages.get(name);
    if (!pg) {
      pg = builders[name]();
      pages.set(name, pg);
    }
    stage.replaceChildren(pg.node);
    pg.node.classList.remove('in');
    void pg.node.offsetWidth;
    pg.node.classList.add('in');
    if (pg.enter) pg.enter();
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
    prevBtn.disabled = index === 0;
    const last = index === names.length - 1;
    nextBtn.disabled = last;
    nextBtn.style.visibility = last ? 'hidden' : '';
    paintNext();
    stage.scrollTop = 0;
  }
  function paintNext() {
    const pg = pages.get(names[index]);
    nextBtn.textContent = pg && pg.label ? pg.label() : '다음';
  }

  function go(i) {
    if (dead || i < 0 || i >= names.length || i === index) return;
    const cur = pages.get(names[index]);
    if (cur && cur.leave) cur.leave();
    index = i;
    audio.sfx('page');
    render();
  }

  /** "다음"과 화면 누르기: 장 안에서 할 일(연출 건너뛰기, 상자 열기)이 있으면 그것부터 */
  function advance() {
    if (dead) return;
    const pg = pages.get(names[index]);
    if (pg && pg.step && pg.step()) {
      paintNext();
      return;
    }
    go(index + 1);
  }

  function openReport() {
    if (report || dead) return;
    box.hidden = true;
    report = showReport(root, {
      setup,
      stations: ctx.stations,
      state,
      onBack() {
        if (report) report.destroy();
        report = null;
        box.hidden = false;
      },
    });
  }

  render();

  return {
    destroy() {
      if (dead) return;
      dead = true;
      for (const pg of pages.values()) if (pg.leave) pg.leave();
      T.clear();
      root.removeEventListener('pointerdown', unlock);
      if (report) report.destroy();
      report = null;
      box.remove();
      if (logUrl) URL.revokeObjectURL(logUrl);
    },
    page() {
      const name = names[index];
      const pg = pages.get(name);
      return { index, name, names: names.slice(), reportOpen: !!report, state: pg && pg.state ? pg.state() : null, next: nextBtn.textContent };
    },
    next: advance,
    prev: () => go(index - 1),
    go,
    timers: () => T.count(),
    openReport,
    report: () => (report ? report.data : null),
  };
}

/** 상자가 열릴 때 금화와 반짝이가 솟았다 떨어진다. 2초 남짓 뒤 스스로 멈춘다. */
function sparkle(canvas, from, T) {
  const fit = fitCanvas(canvas);
  if (!fit) return () => {};
  const { g, W, H } = fit;
  const cr = canvas.getBoundingClientRect();
  const fr = from.getBoundingClientRect();
  const ox = fr.left + fr.width / 2 - cr.left;
  const oy = fr.top + fr.height * 0.35 - cr.top;
  const k = Math.sqrt(H / 700);
  const bits = Array.from({ length: 64 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const v = (0.45 + Math.random() * 0.55) * k;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 3 + Math.random() * 5, coin: i % 3 !== 0, spin: Math.random() * 6 };
  });
  const t0 = performance.now();
  let last = t0;
  let id = null;
  const stop = () => {
    if (id !== null) T.cancelFrame(id);
    id = null;
    g.clearRect(0, 0, W, H);
  };
  const tick = (now) => {
    const dt = Math.min(40, now - last);
    last = now;
    const age = now - t0;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = age > 1800 ? Math.max(0, 1 - (age - 1800) / 500) : 1;
    for (const b of bits) {
      b.vy += 0.0013 * k * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += dt / 90;
      if (b.coin) {
        g.fillStyle = '#ffd95a';
        g.beginPath();
        g.ellipse(b.x, b.y, b.r * Math.abs(Math.cos(b.spin)) + 0.8, b.r, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e0a800';
        g.beginPath();
        g.ellipse(b.x, b.y, (b.r * Math.abs(Math.cos(b.spin))) / 2 + 0.4, b.r / 2, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = '#fffbe0';
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.spin);
        g.fillRect(-b.r, -1.2, b.r * 2, 2.4);
        g.fillRect(-1.2, -b.r, 2.4, b.r * 2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    if (age > 2300) {
      stop();
      return;
    }
    id = T.frame(tick);
  };
  id = T.frame(tick);
  return stop;
}
