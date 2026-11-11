// 수리 놀이: 재시동 암호.
// 큰 버튼 4개가 차례로 깜빡인 뒤("봐!") 아이가 같은 순서로 누른다("눌러!").
// 틀리면 같은 순서를 다시 보여 준다. 다 맞히면 화면이 켜진다. 규격은 index.js 참고.
import { h, ensureStyle, DEBUG } from '../../shared/dom.js';

const LEN = [3, 4, 5];
const ON_MS = [560, 470, 400];
const GAP_MS = [240, 200, 160];
const LEAD_MS = 550; // 처음 화면을 보고 숨 돌릴 틈
const RETRY_MS = 900; // 틀린 뒤 다시 보여 주기까지
const PRESS_MS = 180;
const CELEBRATE_MS = 450;

// 색만으로 가르지 않게 모양을 함께 쓴다 (● ▲ ■ ◆)
const KEYS = [
  { name: '동그라미', color: '#4cc9f0', svg: '<circle cx="50" cy="50" r="40"/>' },
  { name: '세모', color: '#ffb703', svg: '<path d="M50 9 L93 86 H7 Z"/>' },
  { name: '네모', color: '#7bed9f', svg: '<rect x="13" y="13" width="74" height="74" rx="6"/>' },
  { name: '마름모', color: '#ff6b81', svg: '<path d="M50 5 L95 50 L50 95 L5 50 Z"/>' },
];

const CSS = `
.tk-reboot { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 10px; user-select: none; -webkit-user-select: none; }
.tk-reboot-screen { flex: none; position: relative; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border-radius: 14px; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 40%, #0f3140 0%, #061820 70%); border: 5px solid #34495a;
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.8), 0 0 0 2px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.35); transition: background-color 0.2s ease; }
.tk-reboot-screen::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0 2px, transparent 2px 4px); }
.tk-reboot-say { font-size: 30px; font-weight: 900; line-height: 1.1; letter-spacing: -0.02em; color: #8ff3ff; text-shadow: 0 0 12px rgba(76, 201, 240, 0.8); white-space: nowrap; }
.tk-reboot[data-phase='input'] .tk-reboot-say { color: #fff; text-shadow: 0 0 14px var(--c); }
.tk-reboot.is-bad .tk-reboot-say { color: var(--red); text-shadow: 0 0 12px rgba(255, 77, 109, 0.8); }
.tk-reboot-dots { display: flex; gap: 10px; }
.tk-reboot-dot { width: 15px; height: 15px; border-radius: 50%; border: 2px solid rgba(143, 243, 255, 0.55); background: transparent; transition: background-color 0.1s ease, transform 0.1s ease; }
.tk-reboot-dot.is-show { background: #8ff3ff; border-color: #8ff3ff; box-shadow: 0 0 8px #8ff3ff; }
.tk-reboot-dot.is-ok { background: var(--c); border-color: var(--c); box-shadow: 0 0 10px var(--c); transform: scale(1.15); }
.tk-reboot-screen.is-on { background: radial-gradient(120% 120% at 50% 40%, #ffffff 0%, var(--c) 45%, color-mix(in srgb, var(--c) 55%, #000) 100%); animation: tk-reboot-on 0.45s ease both; }
.tk-reboot-screen.is-on .tk-reboot-say { color: #04121d; text-shadow: none; }
.tk-reboot-screen.is-on .tk-reboot-dot { background: #04121d; border-color: #04121d; box-shadow: none; }
.tk-reboot-pad { flex: 1 1 0; min-height: 0; max-height: 380px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; padding: 12px; border-radius: 16px;
  background:
    radial-gradient(circle at 10px 10px, #aebfca 0 2.5px, transparent 3.5px),
    radial-gradient(circle at calc(100% - 10px) 10px, #aebfca 0 2.5px, transparent 3.5px),
    radial-gradient(circle at 10px calc(100% - 10px), #aebfca 0 2.5px, transparent 3.5px),
    radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), #aebfca 0 2.5px, transparent 3.5px),
    linear-gradient(180deg, #465e6e, #2a3d4a);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.35); }
.tk-reboot-key { position: relative; min-height: 64px; border-radius: 18px; background: linear-gradient(180deg, #1c2a33, #0e171d); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.12), 0 5px 0 rgba(0, 0, 0, 0.45); touch-action: none; transition: transform 0.06s ease; }
.tk-reboot-cap { position: absolute; inset: 7px; display: flex; align-items: center; justify-content: center; border-radius: 13px;
  background: radial-gradient(90% 90% at 50% 35%, color-mix(in srgb, var(--k) 30%, #0b1a24), color-mix(in srgb, var(--k) 12%, #060e14));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--k) 45%, transparent); transition: background 0.08s ease, box-shadow 0.08s ease; }
.tk-reboot-cap svg { height: min(58%, 92px); width: auto; aspect-ratio: 1; fill: var(--k); opacity: 0.9; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.5)); }
.tk-reboot[data-phase='input'] .tk-reboot-cap { box-shadow: inset 0 0 0 3px var(--k); }
.tk-reboot-key.is-lit .tk-reboot-cap, .tk-reboot-key.is-press .tk-reboot-cap { background: radial-gradient(90% 90% at 50% 35%, #fff 0%, var(--k) 55%); box-shadow: inset 0 0 0 3px #fff, 0 0 26px var(--k), 0 0 8px var(--k); }
.tk-reboot-key.is-lit svg, .tk-reboot-key.is-press svg { fill: #04121d; opacity: 1; filter: none; }
.tk-reboot-key.is-press { transform: translateY(3px); box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.12), 0 2px 0 rgba(0, 0, 0, 0.45); }
.tk-reboot-key.is-bad .tk-reboot-cap { background: var(--red-deep); box-shadow: inset 0 0 0 3px var(--red); }
.tk-reboot-key.is-bad svg { fill: #fff; }
.tk-reboot[data-phase='show'] .tk-reboot-key, .tk-reboot[data-phase='wait'] .tk-reboot-key, .tk-reboot[data-phase='done'] .tk-reboot-key { cursor: default; }
.tk-reboot-foot { flex: none; display: flex; justify-content: center; }
.tk-reboot-again { min-height: 48px; padding: 6px 16px; border-radius: 12px; font-size: 15px; font-weight: 800; color: var(--text-soft); background: rgba(255, 255, 255, 0.06); border: 1px solid var(--panel-line); }
.tk-reboot-again:disabled { opacity: 0.35; }
@keyframes tk-reboot-on { 0% { filter: brightness(3); transform: scaleY(0.06); } 45% { filter: brightness(2); transform: scaleY(1.04); } 100% { filter: none; transform: none; } }
`;

export function mount(root, ctx) {
  ensureStyle('hs-task-reboot', CSS);
  const rng = ctx.rng;
  const level = Math.max(0, Math.min(2, Number(ctx.data && ctx.data.level) || 0));
  const color = ctx.color || '#4cc9f0';
  const len = LEN[level];
  const onMs = ON_MS[level];
  const gapMs = GAP_MS[level];
  // 같은 버튼이 바로 이어 나오지 않게 한다 (같은 불이 두 번 깜빡이면 아이 눈에는 한 번으로 보인다)
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(i === 0 ? rng.int(4) : (seq[i - 1] + 1 + rng.int(3)) % 4);

  let alive = true;
  let finished = false;
  let phase = 'wait';
  let pos = 0;
  let showToken = 0;
  const timers = new Set();
  const pressTimers = new Map();

  const say = h('p', { class: 'tk-reboot-say', text: '봐!' });
  const dots = seq.map(() => h('span', { class: 'tk-reboot-dot' }));
  const screen = h('div', { class: 'tk-reboot-screen' }, say, h('div', { class: 'tk-reboot-dots' }, dots));
  const keys = KEYS.map((k, i) =>
    h(
      'button',
      { class: 'tk-reboot-key', type: 'button', 'data-i': String(i), 'aria-label': k.name, style: { '--k': k.color } },
      h('span', { class: 'tk-reboot-cap', html: `<svg viewBox="0 0 100 100" aria-hidden="true">${k.svg}</svg>` })
    )
  );
  const pad = h('div', { class: 'tk-reboot-pad' }, keys);
  const again = h('button', { class: 'tk-reboot-again', type: 'button', text: '↻ 다시 보기', disabled: true });
  const el = h('div', { class: 'tk-reboot', style: { '--c': color } }, screen, pad, h('div', { class: 'tk-reboot-foot' }, again));
  root.append(el);

  function later(ms, fn) {
    const id = setTimeout(() => {
      timers.delete(id);
      if (alive) fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function finish() {
    if (finished || !alive) return;
    finished = true;
    ctx.done();
  }

  function setPhase(p) {
    phase = p;
    el.dataset.phase = p;
    again.disabled = p !== 'input';
  }

  function mark() {
    el.dataset.pos = String(pos);
    el.dataset.len = String(len);
  }

  function setDots(fn) {
    dots.forEach((d, i) => {
      d.classList.toggle('is-show', fn(i) === 'show');
      d.classList.toggle('is-ok', fn(i) === 'ok');
    });
  }

  function light(i, on) {
    keys[i].classList.toggle('is-lit', on);
    el.dataset.lit = on ? String(i) : '';
  }

  /** 순서를 처음부터 보여 준다. 이전에 걸어 둔 보여 주기는 token 으로 무효가 된다 */
  function show(delay) {
    const token = ++showToken;
    pos = 0;
    mark();
    setPhase('show');
    say.textContent = '봐!';
    setDots(() => '');
    keys.forEach((k, i) => light(i, false));
    let t = delay;
    seq.forEach((k, step) => {
      later(t, () => {
        if (token !== showToken) return;
        light(k, true);
        setDots((i) => (i <= step ? 'show' : ''));
        ctx.sfx('beep', k);
      });
      later(t + onMs, () => {
        if (token !== showToken) return;
        light(k, false);
      });
      t += onMs + gapMs;
    });
    later(t, () => {
      if (token !== showToken) return;
      setDots(() => '');
      say.textContent = '눌러!';
      setPhase('input');
    });
  }

  function flash(i, cls, ms) {
    const key = keys[i];
    key.classList.add(cls);
    const old = pressTimers.get(key);
    if (old) {
      clearTimeout(old);
      timers.delete(old);
    }
    pressTimers.set(
      key,
      later(ms, () => key.classList.remove(cls))
    );
  }

  function shake() {
    pad.classList.remove('shake');
    void pad.offsetWidth;
    pad.classList.add('shake');
    later(400, () => pad.classList.remove('shake'));
  }

  function win() {
    setPhase('done');
    say.textContent = '켜졌다!';
    screen.classList.add('is-on');
    setDots(() => 'ok');
    keys.forEach((k, i) => later(i * 60, () => light(i, true)));
    ctx.sfx('fixed');
    ctx.buzz([30, 40, 60]);
    later(CELEBRATE_MS, finish);
  }

  function press(i) {
    // 보여 주는 동안과 끝난 뒤에는 눌리지 않는다
    if (!alive || phase !== 'input') return;
    flash(i, 'is-press', PRESS_MS);
    if (i === seq[pos]) {
      ctx.sfx('beep', i);
      ctx.buzz(12);
      pos++;
      mark();
      setDots((d) => (d < pos ? 'ok' : ''));
      if (pos >= len) win();
      return;
    }
    // 틀림: 흔들고 같은 순서를 다시 보여 준다
    ctx.miss();
    ctx.sfx('bad');
    ctx.buzz([40, 40, 40]);
    flash(i, 'is-bad', RETRY_MS - 200);
    shake();
    setPhase('wait');
    pos = 0;
    mark();
    el.classList.add('is-bad');
    say.textContent = '다시!';
    setDots(() => '');
    later(RETRY_MS, () => {
      el.classList.remove('is-bad');
      show(250);
    });
  }

  function onKeyDown(e) {
    const key = e.currentTarget;
    e.preventDefault();
    press(Number(key.dataset.i));
  }

  // 키보드로 누른 click(detail 0)만 받는다. 손가락은 pointerdown 에서 바로 처리해 반응을 빠르게 한다
  function onKeyClick(e) {
    if (e.detail === 0) press(Number(e.currentTarget.dataset.i));
  }

  function onAgain() {
    if (!alive || phase !== 'input') return;
    ctx.sfx('tap');
    show(200);
  }

  keys.forEach((k) => {
    k.addEventListener('pointerdown', onKeyDown);
    k.addEventListener('click', onKeyClick);
  });
  again.addEventListener('click', onAgain);
  mark();
  show(LEAD_MS);

  if (DEBUG) window.__hsReboot = { seq: seq.slice() };

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      showToken++;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      pressTimers.clear();
      keys.forEach((k) => {
        k.removeEventListener('pointerdown', onKeyDown);
        k.removeEventListener('click', onKeyClick);
      });
      again.removeEventListener('click', onAgain);
      if (DEBUG && window.__hsReboot) delete window.__hsReboot;
      el.remove();
    },
    solve() {
      if (!alive || finished) return;
      showToken++;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      pressTimers.clear();
      keys.forEach((k) => k.classList.remove('is-press', 'is-bad', 'is-lit'));
      el.classList.remove('is-bad');
      pos = len;
      mark();
      if (phase !== 'done') win();
      finish();
    },
  };
}
