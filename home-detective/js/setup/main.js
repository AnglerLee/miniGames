// 준비 마법사: 단계 표시, 아래 고정 "이전 / 다음", 단계 사이 이동과 확인, 아이에게 건네기.

import { h, fill, showModal, DEBUG } from '../shared/dom.js';
import { clearRun } from '../shared/store.js';
import { state, initState, save, STEPS, LAST_STEP, stepProblem, currentCase, activeRun, usedBefore } from './state.js';
import { renderIntro, renderBasic, renderTreasure } from './steps.js';
import { renderRooms, renderSuspects } from './cast.js';
import { renderTags } from './tags.js';
import { renderWatch } from './watch.js';
import { shake } from './ui.js';

const RENDER = [renderIntro, renderBasic, renderRooms, renderSuspects, renderTreasure, renderTags, renderWatch];

initState();

const ui = {
  caseLabel: h('span', { class: 'case' }),
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
  ui.caseLabel.textContent = '사건 No.' + state.setup.caseNo + ' 준비';
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
  document.title = STEPS[step] + ' - 우리 집 탐정 준비';
  fill(ui.main, RENDER[step](ctx));
  updateNav();
  if (keepScroll) window.scrollTo(0, y);
}

function nextLabel(step) {
  if (step === 0) return usedBefore() ? '지금 사건 설정 고치기' : '준비 시작하기';
  if (step === 4) return '사건 만들기';
  if (step === LAST_STEP) return '아이에게 폰 건네기';
  return '다음';
}

function updateNav() {
  const step = state.wiz.step;
  const p = step >= 1 && step <= 5 ? stepProblem(step) : null;
  ui.prev.hidden = step === 0;
  ui.next.textContent = nextLabel(step);
  ui.next.className = 'btn ' + (step === LAST_STEP ? 'gold' : 'primary') + (p ? ' wait' : '');
  ui.next.dataset.blocked = p ? '1' : '';
  let why = '';
  let cls = 'why';
  if (p) {
    why = p.text;
    if (tried === step) cls += ' warn';
  } else if (step === 5) {
    why = '쪽지와 보물상자 모두 준비됐어요.';
    cls += ' ok';
  } else if (step === 0) {
    why = '준비는 10분쯤 걸려요.';
  } else if (step === LAST_STEP) {
    why = '누르면 이 폰이 아이의 탐정 수첩으로 바뀌어요.';
  }
  ui.why.className = cls;
  ui.why.textContent = why;
}

/** 다음으로 못 가는 이유: 아래 줄을 빨갛게 흔들고, 고칠 곳으로 데려간다 (토스트는 같은 말이 겹쳐 쓰지 않는다) */
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
  for (let i = 1; i < LAST_STEP; i++) {
    const p = stepProblem(i);
    if (p) {
      go(i);
      complain(p);
      return;
    }
  }
  let keepRun = false;
  if (activeRun()) {
    const v = await showModal({
      title: '하던 수사가 있어요',
      text: '아이가 이 사건을 풀던 중이에요.\n이어서 할까요, 처음부터 다시 할까요?',
      actions: [
        { label: '처음부터', value: 'restart', kind: 'ghost' },
        { label: '이어서 하기', value: 'resume', kind: 'primary' },
      ],
    });
    keepRun = v === 'resume';
  }
  state.setup.ready = true;
  // 다음에 이 화면을 열면 "새 사건 / 지금 사건 다시 보기"를 고르는 첫 화면부터 보인다
  state.wiz.step = 0;
  save();
  if (!keepRun) clearRun();
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
      h('div', { class: 'wiz-brand' }, h('a', { class: 'link-back', href: 'index.html' }, '← 처음 화면'), ui.caseLabel),
      ui.dots,
      ui.title
    ),
    ui.main
  ),
  h('nav', { class: 'wiz-nav', 'aria-label': '단계 이동' }, h('div', { class: 'inner' }, ui.why, h('div', { class: 'btns' }, ui.prev, ui.next)))
);
render(false);

if (DEBUG) {
  window.__hdSetup = {
    setup: () => JSON.parse(JSON.stringify(state.setup)),
    goto: (n) => go(n),
    cs: () => currentCase().cs,
  };
}
