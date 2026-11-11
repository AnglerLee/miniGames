// 탭 4 "고발": 범인 → 거짓말 → 근거 → 확인. 판정은 logic.judge 가 한다.
// 틀리면 배지와 시간이 깎이고, 배지를 다 쓰면 잠깐 고발이 멈춘다 (시계는 계속 간다).

import { h, avatar, buzz } from '../shared/dom.js';
import { judge, innocenceReasons } from '../shared/logic.js';
import { RULES } from '../shared/score.js';
import { josa, statementNote, statementLine, evidenceTitle, evidenceIcon, factText, itemText } from '../shared/text.js';
import { G, commit, log, at, emit, penalize, heard, heardAny, evDone, owned, mmss } from './game.js';
import { replay } from './fx.js';
import { audio } from './audio.js';

/** 마법사 상태 (탭을 옮겨도 남는다) */
const W = { step: 1, suspect: null, slot: null, item: null };
let busy = false;
let countEl = null;
let rerender = () => {};

export function resetWizard() {
  Object.assign(W, { step: 1, suspect: null, slot: null, item: null });
}

/**
 * 고발을 판정하고 결과를 run 에 적는다 (화면과 검증 손잡이가 함께 쓴다).
 * 돌려주는 값: 'solved' | 'deny' | 'wrong' | 'suspended'
 */
export function applyAccusation(pick) {
  const run = G.run;
  const now = Date.now();
  if (run.suspendUntil > now) return 'suspended';
  const item = pick.item || null;
  const result = judge(G.cs, { suspect: pick.suspect, slot: pick.slot, item });
  const rec = { at: at(now), suspect: pick.suspect, slot: pick.slot, item, result };
  run.accusations.push(rec);
  log('accuse', { suspect: pick.suspect, slot: pick.slot, item, result });
  if (result === 'solved') {
    run.solvedAt = now;
    run.phase = 'solved';
    log('solved');
    audio.music.stop();
    // 팡파르('solved')는 곧 뜨는 결말 화면이 낸다. 여기서도 내면 겹쳐 들린다.
    audio.sfx('stamp');
  } else if (result === 'deny') {
    penalize(RULES.denyMs);
    audio.sfx('deny');
  } else {
    run.badges = Math.max(0, run.badges - 1);
    penalize(RULES.wrongMs);
    audio.sfx('wrong');
    buzz([120, 80, 120]);
    if (run.badges === 0) {
      run.suspendUntil = now + RULES.suspendMs;
      log('suspend');
    }
  }
  commit('accuse');
  return result;
}

/** 판정 결과를 보여 준다. solved 면 결말로 넘긴다. */
export function showVerdict(result, pick, { instant = false } = {}) {
  if (result === 'solved') {
    if (instant) emit('solved');
    return;
  }
  if (result === 'suspended') return;
  document.querySelectorAll('.verdict').forEach((n) => n.remove());
  const cs = G.cs;
  const who = cs.suspects[pick.suspect];
  const face = avatar(who, 'big');
  let body;
  if (result === 'deny') {
    body = [
      h('div', { class: 'vd-face shake-slow' }, face, h('div', { class: 'vd-bubble', text: '그게 증거라고? 난 모르는 일이야!' })),
      h('p', { class: 'vd-main', text: '범인은 당황했어. 하지만 그 말이 거짓이라는 걸 보여 줄 증거가 아니야.' }),
      h('p', { class: 'vd-sub', text: '거짓말과 딱 부딪치는 걸 찾아봐.' }),
      h('div', { class: 'vd-cost' }, h('span', { class: 'chip', text: '⏱ 시간 -' + mmss(RULES.denyMs) })),
    ];
  } else {
    const mine = innocenceReasons(cs, pick.suspect).filter(owned).slice(0, 1);
    const name = josa(who.name, '은/는');
    body = [
      h('div', { class: 'vd-face' }, face, h('div', { class: 'vd-bubble', text: '억울해! 나는 범인이 아니야!' })),
      mine.length
        ? [h('p', { class: 'vd-main', text: name + ' 범인이 아니야. 이걸 다시 봐.' }), mine.map((it) => h('p', { class: 'vd-reason', text: itemText(cs, it) }))]
        : h('p', { class: 'vd-main', text: name + ' 범인이 아니야. 아직 못 찾은 단서가 ' + who.name + '의 결백을 말해 줘.' }),
      h('div', { class: 'vd-cost' }, h('span', { class: 'chip', text: '★ 배지 -1' }), h('span', { class: 'chip', text: '⏱ 시간 -' + mmss(RULES.wrongMs) })),
      G.run.suspendUntil > Date.now()
        ? h('p', { class: 'vd-sub', text: '배지를 다 썼어. 서장님께 보고하는 동안 ' + Math.round(RULES.suspendMs / 60000) + '분 동안 고발할 수 없어.' })
        : null,
    ];
  }
  const close = () => back.remove();
  const back = h(
    'div',
    { class: 'modal-backdrop verdict ' + result },
    h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      h('span', { class: 'stamp vd-stamp', text: result === 'deny' ? '증거 불충분' : '잘못된 고발' }),
      body,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary vd-ok', type: 'button', text: '다시 수사하기', onClick: close }))
    )
  );
  document.body.append(back);
}

// ---------- 화면 ----------

export function renderAccuse(main, again) {
  rerender = again;
  countEl = null;
  const run = G.run;
  main.append(
    h(
      'div',
      { class: 'card ac-head' + (W.step > 1 && !(run.suspendUntil > Date.now()) ? ' compact' : '') },
      h(
        'div',
        { class: 'ac-badges' },
        Array.from({ length: RULES.badges }, (_, i) => h('i', { class: 'badge' + (i < run.badges ? ' on' : ''), text: '★' })),
        h('span', { text: '남은 배지 ' + run.badges + '개' })
      ),
      h('p', { class: 'ac-lead', text: '범인, 거짓말, 그리고 거짓말을 깨는 증거. 셋을 골라 고발해.' }),
      h('p', { class: 'soft', text: '범인이 아닌 사람을 고발하면 배지 하나와 시간 ' + mmss(RULES.wrongMs) + '이 깎여.' })
    )
  );
  if (run.suspendUntil > Date.now()) {
    countEl = h('p', { class: 'ac-count' });
    main.append(
      h(
        'div',
        { class: 'card ac-suspend' },
        h('div', { class: 'ac-chief', text: '👮' }),
        h('h3', { text: '서장님께 보고 중…' }),
        countEl,
        h('p', { class: 'soft', text: '배지를 다 써서 잠깐 기다려야 해. 시계는 계속 가니까 그동안 수첩과 정리표를 다시 봐.' })
      )
    );
    tickAccuse(Date.now());
    return;
  }
  main.append(stepper(), stepView());
}

export function tickAccuse(now) {
  if (countEl) countEl.textContent = mmss(Math.max(0, G.run.suspendUntil - now));
}

function stepper() {
  const names = ['범인', '거짓말', '근거', '확인'];
  return h(
    'ol',
    { class: 'ac-steps' },
    names.map((n, i) => h('li', { class: i + 1 === W.step ? 'on' : i + 1 < W.step ? 'past' : '' }, h('b', { text: String(i + 1) }), h('span', { text: n })))
  );
}

function go(step) {
  W.step = step;
  audio.sfx('page');
  rerender();
  // 작은 화면에서도 지금 단계가 바로 보이게 (확인 단계는 "고발한다!" 버튼까지)
  const main = document.getElementById('tabview');
  const steps = main && main.querySelector('.ac-steps');
  if (!steps) return;
  if (step === 4) main.scrollTop = main.scrollHeight;
  else main.scrollTop += steps.getBoundingClientRect().top - main.getBoundingClientRect().top - 8;
}

function backBtn(step, text) {
  return h('button', { class: 'btn ghost small ac-back', type: 'button', text: '← ' + text, onClick: () => go(step) });
}

function stepView() {
  const cs = G.cs;
  if (W.step === 1) {
    const any = cs.suspects.some((_, s) => heardAny(s));
    return h(
      'section',
      { class: 'ac-step' },
      h('h3', { class: 'ac-q', text: '누가 범인일까?' }),
      any ? null : h('p', { class: 'soft', text: '아직 아무도 탐문하지 않았어. 용의자 쪽지부터 찾아봐.' }),
      h(
        'div',
        { class: 'ac-grid' },
        cs.suspects.map((who, s) => {
          const ok = heardAny(s);
          const node = h(
            'button',
            { class: 'ac-pick' + (ok ? '' : ' off'), type: 'button', 'data-suspect': s, 'aria-disabled': ok ? null : 'true' },
            avatar(who),
            h('b', { text: who.name }),
            ok ? null : h('small', { text: '먼저 만나서 물어봐야 해' })
          );
          node.addEventListener('click', () => {
            if (!ok) {
              replay(node, 'shake');
              return;
            }
            W.suspect = s;
            W.slot = null;
            W.item = null;
            go(2);
          });
          return node;
        })
      )
    );
  }
  const who = cs.suspects[W.suspect];
  if (W.step === 2) {
    return h(
      'section',
      { class: 'ac-step' },
      backBtn(1, '범인 다시 고르기'),
      h('div', { class: 'ac-who' }, avatar(who, 'small'), h('h3', { class: 'ac-q', text: josa(who.name, '이/가') + ' 한 말 중에 거짓말은?' })),
      h(
        'div',
        { class: 'ac-list' },
        cs.slots.map((label, t) =>
          heard(W.suspect, t)
            ? pickBtn(
                { 'data-slot': t },
                () => {
                  W.slot = t;
                  W.item = null;
                  go(3);
                },
                h('span', { class: 'chip ac-slot', text: label }),
                h('span', { class: 'ac-text', text: statementNote(cs, W.suspect, t) })
              )
            : h('div', { class: 'ac-item off' }, h('span', { class: 'chip ac-slot', text: label }), h('span', { class: 'ac-text soft', text: '아직 못 들음' }))
        )
      )
    );
  }
  if (W.step === 3) {
    return h(
      'section',
      { class: 'ac-step' },
      backBtn(2, '거짓말 다시 고르기'),
      h('p', { class: 'ac-lie' }, h('small', { text: '거짓말' }), statementLine(cs, W.suspect, W.slot)),
      h('h3', { class: 'ac-q', text: '이 말이 거짓이라는 근거는?' }),
      evidenceGroups()
    );
  }
  // 확인
  const lieText = statementLine(cs, W.suspect, W.slot).replace(/^[^:]+:\s*/, '');
  return h(
    'section',
    { class: 'ac-step ac-confirm' },
    backBtn(3, '근거 다시 고르기'),
    h('h3', { class: 'ac-q', text: '이대로 고발할까?' }),
    h(
      'div',
      { class: 'ac-three' },
      h('div', { class: 'ac-card' }, h('small', { text: '범인' }), avatar(who), h('b', { text: who.name })),
      h('div', { class: 'ac-card' }, h('small', { text: '거짓말' }), h('p', { text: lieText })),
      h('div', { class: 'ac-card' }, h('small', { text: '근거' }), h('p', { text: itemText(cs, W.item) }))
    ),
    h('button', { class: 'btn primary block ac-go', type: 'button', text: '고발한다!', onClick: doAccuse })
  );
}

function pickBtn(attrs, onPick, ...children) {
  const node = h('button', Object.assign({ class: 'ac-item', type: 'button' }, attrs), ...children);
  node.addEventListener('click', onPick);
  return node;
}

/** 근거 후보: 다른 용의자에게 들은 진술과 조사한 증거. 고른 시각을 맨 위에. */
function evidenceGroups() {
  const cs = G.cs;
  const groups = new Map();
  const add = (g, node) => {
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(node);
  };
  const choose = (item) => () => {
    W.item = item;
    go(4);
  };
  cs.slots.forEach((_, t) =>
    cs.suspects.forEach((p, s) => {
      if (s === W.suspect || !heard(s, t)) return;
      const item = { type: 'statement', who: s, slot: t };
      add(t, pickBtn({ 'data-item': 's:' + s + ':' + t }, choose(item), avatar(p, 'small'), h('span', { class: 'ac-text' }, h('b', { text: p.name }), ' ' + statementNote(cs, s, t))));
    })
  );
  cs.evidence.forEach((ev, index) => {
    if (!evDone(index)) return;
    const item = { type: 'evidence', index };
    const g = typeof ev.fact.slot === 'number' ? ev.fact.slot : -1;
    add(g, pickBtn({ 'data-item': 'e:' + index }, choose(item), h('span', { class: 'ac-ev', text: evidenceIcon(ev) }), h('span', { class: 'ac-text' }, h('b', { text: evidenceTitle(cs, ev) }), ' ' + factText(cs, ev))));
  });
  if (!groups.size) return h('p', { class: 'soft', text: '아직 근거가 없어. 다른 용의자를 탐문하거나 증거를 조사해 봐.' });
  const order = [W.slot, ...cs.slots.map((_, t) => t).filter((t) => t !== W.slot), -1].filter((g) => groups.has(g));
  return order.map((g) =>
    h('div', { class: 'ac-group' + (g === W.slot ? ' same' : '') }, h('h4', { text: g < 0 ? '시각과 상관없는 증거' : cs.slots[g] + (g === W.slot ? ' (고른 시각)' : '') }), h('div', { class: 'ac-list' }, groups.get(g)))
  );
}

/** "고발한다!" — 뜸을 들인 뒤 판정 */
function doAccuse() {
  if (busy || W.item === null) return;
  busy = true;
  const pick = { suspect: W.suspect, slot: W.slot, item: W.item };
  const who = G.cs.suspects[pick.suspect];
  audio.sfx('accuse');
  buzz([60, 120, 60]);
  const line = h('p', { class: 'sus-line', text: josa(who.name, '아/야') + ', 범인은 바로 너야!' });
  const cover = h('div', { class: 'suspense' }, h('div', { class: 'sus-spot' }, avatar(who, 'big')), line, h('p', { class: 'sus-drum', text: '두근… 두근…' }));
  document.body.append(cover);
  setTimeout(() => {
    const result = applyAccusation(pick);
    resetWizard();
    if (result === 'solved') {
      cover.classList.add('caught');
      cover.append(h('span', { class: 'stamp sus-stamp', text: '범인 검거' }));
      setTimeout(() => {
        cover.remove();
        busy = false;
        emit('solved');
      }, 1100);
      return;
    }
    cover.remove();
    busy = false;
    rerender();
    showVerdict(result, pick);
  }, 1300);
}
