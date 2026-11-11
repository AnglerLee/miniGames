// 준비 마법사: 단계 표시, 아래 고정 "이전 / 다음", 단계 사이 이동과 확인, 아이에게 건네기.

import { h, fill, showModal, DEBUG } from '../shared/dom.js';
import { clearRun, newSeed, loadHistory } from '../shared/store.js';
import { state, initState, save, STEPS, LAST_STEP, NOTES_STEP, stepProblem, firstProblem, activeRun, stations } from './state.js';
import { renderIntro, renderBasic, renderTreasure } from './steps.js';
import { renderRooms } from './rooms.js';
import { renderNotes } from './notes.js';
import { renderWatch } from './watch.js';
import { shake } from './ui.js';

const RENDER = [renderIntro, renderBasic, renderRooms, renderTreasure, renderNotes, renderWatch];

initState();

// 대문의 "준비 화면에서 고치기"는 setup.html#treasure 로 보물 단계를 바로 연다
const HASH_STEP = { '#treasure': 3, '#notes': NOTES_STEP, '#rooms': 2 };
if (HASH_STEP[location.hash] !== undefined) {
  state.wiz.step = HASH_STEP[location.hash];
  history.replaceState(null, '', location.pathname + location.search);
}

const ui = {
  missionLabel: h('span', { class: 'mission' }),
  dots: h('div', { class: 'wiz-dots' }),
  title: h('h1', { class: 'wiz-title', id: 'step-title' }),
  main: h('main', { class: 'stack', id: 'step' }),
  why: h('div', { class: 'why', id: 'why', 'aria-live': 'polite' }),
  prev: h('button', { class: 'btn ghost prev', type: 'button', id: 'prev' }, '이전'),
  next: h('button', { class: 'btn primary', type: 'button', id: 'next' }),
};
// "다음"을 눌러 막힌 단계에서만 이유를 빨갛게 보인다 (들어오자마자 혼내지 않게)
let tried = -1;

const ctx = {
  changed() {
    save();
    updateNav();
  },
  rerender() {
    save();
    render(true);
  },
  go,
};

function go(step) {
  state.wiz.step = Math.max(0, Math.min(LAST_STEP, step));
  tried = -1;
  save();
  render(false);
  window.scrollTo(0, 0);
}

function render(keepScroll) {
  const y = window.scrollY;
  const step = state.wiz.step;
  ui.missionLabel.textContent = '임무 No.' + state.setup.missionNo + ' 준비';
  fill(
    ui.dots,
    STEPS.map((t, i) =>
      h('button', {
        class: 'wiz-dot' + (i === step ? ' now' : i < step ? ' done' : ''),
        type: 'button',
        'aria-label': (i ? i + '단계 ' : '') + t,
        'aria-current': i === step ? 'step' : null,
        'data-step': i,
        onClick: () => jump(i),
      }, h('i'))
    )
  );
  fill(ui.title, h('small', { text: step ? step + ' / ' + LAST_STEP + '단계' : '부모 준비' }), STEPS[step]);
  document.title = STEPS[step] + ' - 잠수함 간식호 준비';
  fill(ui.main, RENDER[step](ctx));
  updateNav();
  if (keepScroll) window.scrollTo(0, y);
}

function nextLabel(step) {
  if (step === 0) return state.setup.ready ? '설정 확인하기' : '준비 시작하기';
  if (step === LAST_STEP) return '아이에게 폰 건네기';
  return '다음';
}

function updateNav() {
  const step = state.wiz.step;
  const p = step >= 1 && step < LAST_STEP ? stepProblem(step) : null;
  ui.prev.hidden = step === 0;
  ui.next.textContent = nextLabel(step);
  ui.next.className = 'btn ' + (step === LAST_STEP ? 'warn' : 'primary') + (p ? ' wait' : '');
  ui.next.dataset.blocked = p ? '1' : '';
  let why = '';
  let cls = 'why';
  if (p) {
    why = p.text;
    if (tried === step) cls += ' bad';
  } else if (step === NOTES_STEP) {
    why = '쪽지와 보물상자, 바닥까지 모두 준비됐어요.';
    cls += ' ok';
  } else if (step === 0) {
    why = '준비는 5분쯤 걸려요. 중간에 닫아도 이어서 할 수 있어요.';
  } else if (step === LAST_STEP) {
    why = '누르면 이 폰이 아이의 잠수함 계기판으로 바뀌어요.';
  }
  ui.why.className = cls;
  ui.why.textContent = why;
}

/** 다음으로 못 가는 이유: 아래 줄을 빨갛게 흔들고, 고칠 곳으로 데려간다 */
function complain(p) {
  tried = state.wiz.step;
  updateNav();
  ui.why.classList.remove('shake');
  void ui.why.offsetWidth;
  ui.why.classList.add('shake');
  if (p.focus) requestAnimationFrame(() => shake(p.focus));
}

/** 앞으로 건너뛸 때는 사이의 단계를 모두 확인한다 (막힌 단계에서 멈춘다) */
function jump(k) {
  const step = state.wiz.step;
  if (k <= step) return go(k);
  for (let i = step; i < k; i++) {
    const p = i >= 1 ? stepProblem(i) : null;
    if (p) {
      if (i !== step) go(i);
      complain(p);
      return;
    }
  }
  go(k);
}

function next() {
  const step = state.wiz.step;
  if (step === LAST_STEP) return handOff();
  jump(step + 1);
}

async function handOff() {
  const p = firstProblem();
  if (p) {
    go(p.step);
    complain(p);
    return;
  }
  const s = state.setup;
  let keepRun = false;
  const run = activeRun();
  if (run && run.state.phase !== 'done') {
    const v = await showModal({
      title: '하던 임무가 있어요',
      text: '아이가 임무 No.' + s.missionNo + '을 하던 중이에요.\n이어서 할까요, 새 임무로 시작할까요?',
      actions: [
        { label: '새 임무로', value: 'new', kind: 'ghost' },
        { label: '이어서 하기', value: 'resume', kind: 'primary' },
      ],
    });
    keepRun = v === 'resume';
  }
  if (!keepRun) {
    // 이미 기록이 남은 임무 번호면 다음 번호로 (새로 뽑은 임무는 다른 임무다)
    if (loadHistory().some((x) => x.missionNo === s.missionNo)) s.missionNo = (s.missionNo | 0) + 1;
    s.seed = newSeed();
    clearRun();
  }
  s.ready = true;
  // 다음에 이 화면을 열면 첫 화면(쪽지 그대로 새 임무)부터 보인다
  state.wiz.step = 0;
  save();
  location.href = 'play.html';
}

ui.prev.addEventListener('click', () => go(state.wiz.step - 1));
ui.next.addEventListener('click', next);

document.body.append(
  h(
    'div',
    { class: 'page' },
    h(
      'header',
      { class: 'wiz-top' },
      h('div', { class: 'wiz-brand' }, h('a', { class: 'link-back', href: 'index.html' }, '← 처음 화면'), ui.missionLabel),
      ui.dots,
      ui.title
    ),
    ui.main
  ),
  h('nav', { class: 'wiz-nav', 'aria-label': '단계 이동' }, h('div', { class: 'inner' }, ui.why, h('div', { class: 'btns' }, ui.prev, ui.next)))
);
render(false);

if (DEBUG) {
  window.__hsSetup = {
    setup: () => JSON.parse(JSON.stringify(state.setup)),
    goto: (n) => go(n),
    stations: () => stations(),
    wiz: () => JSON.parse(JSON.stringify(state.wiz)),
  };
}
