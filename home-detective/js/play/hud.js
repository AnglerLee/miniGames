// 위쪽 HUD: 남은 시간, 간식 게이지(베어 먹히는 쿠키), 탐정 배지, 진행, 무전과 메뉴 버튼.
// 250ms 마다 불리지만 글자나 그림이 바뀔 때만 DOM 을 건드린다.

import { h } from '../shared/dom.js';
import { RULES, clock } from '../shared/score.js';
import { G, on, left, progress, mmss } from './game.js';
import { audio } from './audio.js';

let els = null;
const last = { text: '', eaten: -1, prog: '', badges: -1, mode: '', tension: -1, pct: -1 };

export function mountHud({ onRadio, onMenu }) {
  const cookie = h('canvas', { class: 'cookie', 'aria-hidden': 'true' });
  const digits = h('span', { class: 'timer-digits' });
  const label = h('span', { class: 'timer-label', text: '남은 시간' });
  const timer = h('div', { class: 'timer', role: 'timer' }, label, digits);
  const badges = h('div', { class: 'badges', role: 'img' });
  const prog = h('span', { class: 'prog' });
  const pct = h('span', { class: 'snack-pct' });
  const fillBar = h('i');
  const radio = h('button', { class: 'hud-btn radio', type: 'button', 'aria-label': '무전 (힌트)', onClick: onRadio }, h('b', { text: '📻' }), h('span', { text: '무전' }));
  const menu = h('button', { class: 'hud-btn menu', type: 'button', 'aria-label': '메뉴', onClick: onMenu }, h('b', { text: '☰' }), h('span', { text: '메뉴' }));
  const snack = h('div', { class: 'snack' }, cookie);
  const el = h(
    'header',
    { class: 'hud' },
    h('div', { class: 'hud-row' }, snack, timer, h('div', { class: 'hud-gap' }), radio, menu),
    h('div', { class: 'hud-row2' }, prog, pct, badges),
    h('div', { class: 'snack-bar', 'aria-hidden': 'true' }, fillBar)
  );
  els = { el, cookie, snack, digits, label, timer, badges, prog, pct, fillBar, radio, menu };
  Object.assign(last, { text: '', eaten: -1, prog: '', badges: -1, mode: '', tension: -1, pct: -1 });
  on('penalty', flyPenalty);
  on('change', () => hudTick(Date.now()));
  return el;
}

/** 시간과 게이지를 다시 그린다 */
export function hudTick(now) {
  if (!els || !G.run) return;
  const run = G.run;
  const ms = left(now);
  const ratio = Math.max(0, Math.min(1, ms / run.limitMs));

  const text = clock(ms);
  if (text !== last.text) {
    last.text = text;
    els.digits.textContent = text;
  }
  const mode = ms < 0 ? 'late' : ratio < 0.2 ? 'low' : '';
  if (mode !== last.mode) {
    last.mode = mode;
    els.el.classList.toggle('low', mode === 'low');
    els.el.classList.toggle('late', mode === 'late');
    els.label.textContent = mode === 'late' ? '시간 초과' : '남은 시간';
  }

  // 쿠키는 남은 시간 비율만큼 남는다. 0.4% 단위로만 다시 그린다.
  const eaten = Math.round((1 - ratio) * 250) / 250;
  if (eaten !== last.eaten) {
    last.eaten = eaten;
    drawCookie(els.cookie, eaten);
    els.fillBar.style.width = ratio * 100 + '%';
  }
  const p = Math.ceil(ratio * 100);
  if (p !== last.pct) {
    last.pct = p;
    els.pct.textContent = ms < 0 ? '간식이 위험해!' : '🍪 간식 ' + p + '%';
  }

  const pr = progress();
  const progText = '탐문 ' + pr.asked + '/' + pr.suspects + ' · 증거 ' + pr.evidence + '/' + pr.evidenceTotal;
  if (progText !== last.prog) {
    last.prog = progText;
    els.prog.textContent = progText;
  }

  if (run.badges !== last.badges) {
    const lost = last.badges > run.badges && last.badges >= 0;
    last.badges = run.badges;
    els.badges.replaceChildren(
      ...Array.from({ length: RULES.badges }, (_, i) => h('i', { class: 'badge' + (i < run.badges ? ' on' : '') + (lost && i === run.badges ? ' lost' : ''), text: '★' }))
    );
    els.badges.setAttribute('aria-label', '탐정 배지 ' + run.badges + '개');
  }

  // 남은 비율 1 → 0 을 긴장 0 → 0.8 로, 시간을 넘기면 1
  const tension = ms < 0 ? 1 : Math.round((1 - ratio) * 0.8 * 100) / 100;
  if (tension !== last.tension && run.phase === 'play') {
    last.tension = tension;
    audio.music.setTension(tension);
  }
}

export function setRadioBlink(on) {
  if (els) els.radio.classList.toggle('blink', !!on);
}

/** 깎인 시간이 시계에서 날아간다 */
function flyPenalty(ms) {
  if (!els) return;
  const fly = h('span', { class: 'fly', text: '-' + mmss(ms) });
  els.timer.append(fly);
  setTimeout(() => fly.remove(), 1600);
  els.snack.classList.remove('chomp');
  void els.snack.offsetWidth;
  els.snack.classList.add('chomp');
}

// ---------- 쿠키 그림 ----------

// 초코칩 자리 (쿠키 반지름 1 기준). 그림이 매번 같아야 하므로 고정값이다.
const CHIPS = [
  [-0.45, -0.35, 0.13], [0.1, -0.55, 0.11], [0.5, -0.2, 0.12], [-0.1, -0.05, 0.14],
  [-0.55, 0.25, 0.11], [0.3, 0.3, 0.13], [-0.15, 0.55, 0.1], [0.62, 0.42, 0.09],
];
const BITE_JITTER = [0.08, -0.06, 0.12, -0.02, 0.1, -0.08, 0.05];

function drawCookie(cv, eaten) {
  const css = cv.clientWidth || 52;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(css * dpr)) {
    cv.width = Math.round(css * dpr);
    cv.height = Math.round(css * dpr);
  }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);
  const cx = css / 2;
  const cy = css / 2;
  const R = css * 0.44;

  // 접시 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + R * 0.9, R * 0.9, R * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 쿠키 한 장을 따로 그린 뒤 베어 문 자리를 지운다
  const off = document.createElement('canvas');
  off.width = cv.width;
  off.height = cv.height;
  const o = off.getContext('2d');
  o.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = o.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#f0c27f');
  g.addColorStop(0.75, '#d4934c');
  g.addColorStop(1, '#a8652a');
  o.fillStyle = g;
  o.beginPath();
  o.arc(cx, cy, R, 0, Math.PI * 2);
  o.fill();
  o.fillStyle = '#4a2814';
  for (const [x, y, r] of CHIPS) {
    o.beginPath();
    o.ellipse(cx + x * R, cy + y * R, r * R, r * R * 0.8, x * 2, 0, Math.PI * 2);
    o.fill();
  }
  if (eaten > 0) {
    // 오른쪽부터 베어 먹힌다. 먹힌 앞쪽 경계는 이빨 자국처럼 둥글게 파인다.
    o.globalCompositeOperation = 'destination-out';
    const br = R * 0.3;
    const front = cx + R - eaten * 2.2 * R;
    o.fillRect(front + br, 0, css, css);
    BITE_JITTER.forEach((j, k) => {
      const y = cy + (k - 3) * br * 1.35;
      o.beginPath();
      o.arc(front + br + j * br, y, br, 0, Math.PI * 2);
      o.fill();
    });
    o.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(off, 0, 0, css, css);

  // 부스러기
  if (eaten > 0.02) {
    ctx.fillStyle = '#c98a45';
    const n = Math.min(6, 1 + Math.floor(eaten * 8));
    for (let i = 0; i < n; i++) {
      const x = cx + R * (0.95 - eaten * 1.2) + ((i * 7) % 5) * 2.2 - 3;
      const y = cy + R * 0.75 + ((i * 3) % 4) * 1.6;
      ctx.fillRect(x, y, 2.4, 2);
    }
  }
}
