// 쪽지 입력판: 모양 6개 + 숫자 1~9. 기호가 맞으면 탐문이나 증거 조사로 넘어간다.

import { h, buzz } from '../shared/dom.js';
import { CODE_SHAPES, CODE_SHAPE_NAMES } from '../shared/content.js';
import { findTag } from '../shared/case.js';
import { RULES } from '../shared/score.js';
import { G, on, commit, log, discover } from './game.js';
import { openOverlay, closeAll, toggleOff } from './overlay.js';
import { openInterrogate } from './interrogate.js';
import { openEvidence } from './evidence.js';
import { audio } from './audio.js';

/**
 * 기호를 넣는다 (판과 검증 손잡이가 함께 쓴다).
 * 돌려주는 값: 'locked' | 'none' | 'lock'(이번에 잠김) | 'new' | 'again'
 */
export function enterCode(shape, digit) {
  const run = G.run;
  const now = Date.now();
  if (run.lockUntil > now) return 'locked';
  const tag = findTag(G.cs, shape, digit);
  if (!tag) {
    run.wrongCodes++;
    run.codeStreak++;
    log('wrongCode');
    let result = 'none';
    if (run.codeStreak >= RULES.wrongCodeStreak) {
      run.lockUntil = now + RULES.wrongCodeLockMs;
      run.codeStreak = 0;
      log('lock');
      audio.sfx('lock');
      buzz([80, 60, 80]);
      result = 'lock';
    } else {
      audio.sfx('bad');
      buzz(60);
    }
    commit('code');
    return result;
  }
  run.codeStreak = 0;
  if (discover(tag)) {
    audio.sfx('found');
    buzz([40, 50, 120]);
    commit('find');
    openTag(tag, true);
    return 'new';
  }
  commit('code');
  openTag(tag, false);
  return 'again';
}

/** 쪽지에 맞는 화면을 연다 (다른 판은 모두 닫는다) */
export function openTag(tag, isNew) {
  closeAll();
  if (tag.kind === 'suspect') openInterrogate(tag.ref, isNew);
  else openEvidence(tag.ref, isNew);
}

export function openPad() {
  if (toggleOff('pad')) return;
  const ov = openOverlay('pad', { variant: 'bottom', title: '쪽지 기호 넣기' });
  audio.sfx('open');
  let shape = null;
  let digit = null;

  const noteShape = h('span', { class: 'pad-shape-out', text: '?' });
  const noteDigit = h('span', { class: 'pad-digit-out', text: '?' });
  const note = h('div', { class: 'note-code pad-note' }, noteShape, noteDigit);
  const msg = h('p', { class: 'pad-msg' });
  const ok = h('button', { class: 'btn primary pad-ok', type: 'button', text: '확인', onClick: submit });

  const shapeBtns = CODE_SHAPES.map((glyph, i) =>
    h(
      'button',
      { class: 'pad-key shape', type: 'button', 'data-shape': i, 'aria-label': CODE_SHAPE_NAMES[i], onClick: () => pickShape(i) },
      h('b', { text: glyph }),
      h('small', { text: CODE_SHAPE_NAMES[i] })
    )
  );
  const digitBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) =>
    h('button', { class: 'pad-key digit', type: 'button', 'data-digit': d, onClick: () => pickDigit(d), text: String(d) })
  );
  const clear = h('button', { class: 'pad-key clear', type: 'button', 'aria-label': '지우기', text: '지우기', onClick: reset });

  ov.body.append(
    h('div', { class: 'pad-top' }, note, h('div', { class: 'pad-top-r' }, msg, ok)),
    h('div', { class: 'pad-shapes' }, shapeBtns),
    h('div', { class: 'pad-digits' }, digitBtns, clear)
  );

  function pickShape(i) {
    shape = i;
    audio.sfx('tap');
    show();
  }
  function pickDigit(d) {
    digit = d;
    audio.sfx('tap');
    show();
  }
  function reset() {
    shape = null;
    digit = null;
    audio.sfx('tap');
    show();
  }

  function show(text, bad) {
    noteShape.textContent = shape === null ? '?' : CODE_SHAPES[shape];
    noteDigit.textContent = digit === null ? '?' : String(digit);
    note.classList.toggle('empty', shape === null && digit === null);
    shapeBtns.forEach((b, i) => b.classList.toggle('on', i === shape));
    digitBtns.forEach((b, i) => b.classList.toggle('on', i + 1 === digit));
    const lockLeft = G.run.lockUntil - Date.now();
    const locked = lockLeft > 0;
    ov.sheet.classList.toggle('locked', locked);
    ok.disabled = locked || shape === null || digit === null;
    [...shapeBtns, ...digitBtns, clear].forEach((b) => (b.disabled = locked));
    if (locked) {
      msg.textContent = '너무 많이 틀렸어. ' + Math.ceil(lockLeft / 1000) + '초 쉬고 다시 해';
      msg.className = 'pad-msg bad';
    } else if (text) {
      msg.textContent = text;
      msg.className = 'pad-msg' + (bad ? ' bad' : '');
    } else if (shape === null || digit === null) {
      msg.textContent = '쪽지에 적힌 모양과 숫자를 골라';
      msg.className = 'pad-msg';
    } else {
      msg.textContent = '이 기호가 맞아?';
      msg.className = 'pad-msg';
    }
  }

  function submit() {
    if (shape === null || digit === null) return;
    const r = enterCode(shape, digit);
    if (r === 'new' || r === 'again') return; // 판은 이미 닫히고 다음 화면이 열렸다
    note.classList.remove('shake');
    void note.offsetWidth;
    note.classList.add('shake');
    if (r === 'none') show('그런 쪽지는 없어. 다시 봐', true);
    else show();
  }

  // 잠긴 동안 남은 초를 센다
  let wasLocked = false;
  const offTick = on('tick', (now) => {
    const locked = G.run.lockUntil > now;
    if (locked || wasLocked) show();
    wasLocked = locked;
  });
  ov.onClose = offTick;
  show();
  return ov;
}
