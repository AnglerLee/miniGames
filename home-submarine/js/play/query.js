// 도착 확인 판: 그 구역 쪽지를 보고 묻는 숫자를 누른다.
// 맞히면 엔진에 도착을 알리고 그 구역의 일을 연다. 틀리면 잠깐 잠기고 새 질문으로 바뀐다.

import { h, buzz } from '../shared/dom.js';
import { makeQuery, checkAnswer } from '../shared/tags.js';
import { stream } from '../shared/prng.js';
import { CODE_SHAPES, CODE_SHAPE_NAMES, DIFFICULTY } from '../shared/content.js';
import { RULES } from '../shared/score.js';
import { josa } from '../shared/text.js';
import { G, send, timed } from './game.js';
import { openOverlay, closeAll } from './overlay.js';
import { arriveAt, cancelArrival } from './arrive.js';
import { urgentStrip } from './strip.js';
import { shake, flash } from './fx.js';
import { audio } from './audio.js';

/** 지금까지 낸 질문 수. 질문 씨앗(stream(seed, 'query', n))이 된다 */
let asked = 0;
/** 열린 판 { station, query, locked, press(n), unlock() } */
let cur = null;

export function resetQueries(n) {
  asked = n;
}

/** 검증용: 열린 질문 */
export function openQueryInfo() {
  if (!cur) return null;
  return { station: cur.station, kind: cur.query.kind, text: cur.query.text, answer: cur.query.answer.slice(), locked: cur.locked };
}

/** 검증용: 열린 질문에 정답을 누른다 (잠겨 있으면 잠금을 바로 푼다) */
export function answerOpen() {
  if (!cur) return false;
  if (cur.locked) cur.unlock();
  const c = cur;
  for (const n of c.query.answer.slice()) if (cur === c) c.press(n);
  return true;
}

export function openQuery(station) {
  if (!timed() || G.state.paused) return null;
  cancelArrival();
  closeAll('stage');
  const st = G.stations[station];
  const queries = DIFFICULTY[G.state.difficulty].queries;
  const shapeName = CODE_SHAPE_NAMES[st.shape];

  const boxes = Array.from({ length: 4 }, () => h('i', { class: 'qbox' }));
  const textEl = h('p', { class: 'qtext' });
  const slotsEl = h('div', { class: 'qslots' });
  const lockFill = h('i');
  const lockEl = h('div', { class: 'qlock' }, h('strong', { text: '틀렸어. 쪽지를 다시 봐' }), h('span', { text: '곧 새 질문이 나와' }), h('span', { class: 'qlock-bar' }, lockFill));
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
    h('button', { class: 'qkey', type: 'button', 'data-digit': n, text: String(n), onClick: () => press(n) })
  );
  const sheet = h(
    'div',
    { class: 'qsheet', role: 'dialog', 'aria-label': '도착 확인', style: { '--c': st.role.color } },
    h(
      'div',
      { class: 'qhead' },
      h('span', { class: 'station-dot', text: st.role.icon }),
      h('h2', { class: 'qwhere' }, h('span', { class: 'role', text: st.role.name }), h('span', { class: 'room', text: st.room.name })),
      h('button', { class: 'xbtn', type: 'button', 'aria-label': '닫기', 'data-act': 'close', text: '✕', onClick: () => ov.close('x') })
    ),
    h('div', { class: 'qask' }, h('div', { class: 'note-code qnote', 'aria-hidden': 'true' }, h('span', { class: 'qshape', text: CODE_SHAPES[st.shape] }), boxes), textEl),
    slotsEl,
    h('div', { class: 'qpad-wrap' }, h('div', { class: 'qpad' }, keys), lockEl),
    h('button', { class: 'btn ghost block qclose', type: 'button', text: '닫기', onClick: () => ov.close('x') })
  );
  const strip = urgentStrip();

  let query = null;
  let input = [];
  let lockTimer = null;

  const ov = openOverlay('query', {
    backdrop: true,
    onClose() {
      clearTimeout(lockTimer);
      if (cur && cur.ov === ov) cur = null;
    },
  });
  ov.station = station;
  ov.update = (s) => strip.update(s);
  ov.el.append(strip.el, sheet);

  function paintSlots(state = '') {
    slotsEl.className = 'qslots n' + query.answer.length + (state ? ' ' + state : '');
    slotsEl.replaceChildren(
      ...query.answer.map((_, i) => h('span', { class: 'qslot' + (i === input.length ? ' next' : '') }, query.answer.length > 1 ? h('em', { text: i ? '②' : '①' }) : null, h('b', { text: input[i] !== undefined ? String(input[i]) : '' })))
    );
  }

  function newQuestion() {
    query = makeQuery(stream(G.setup.seed, 'query', asked++), st, queries);
    input = [];
    // 쪽지 그림에서 묻는 자리를 밝힌다 (숫자는 보여 주지 않는다. 쪽지 안에서 숫자가 겹치지 않아 자리를 알 수 있다)
    const ask = query.kind === 'pos' || query.kind === 'pair' ? query.answer.map((v) => st.digits.indexOf(v)) : [];
    boxes.forEach((b, i) => {
      const k = ask.indexOf(i);
      b.className = 'qbox' + (k >= 0 ? ' ask' : '');
      b.textContent = k >= 0 ? (query.kind === 'pair' ? (k ? '②' : '①') : '?') : '';
    });
    const tail = query.kind === 'pair' ? ' 눌러' : josa(query.text, '은/는').slice(query.text.length) + '?';
    textEl.replaceChildren(shapeName + ' 쪽지의 ', h('b', { text: query.text }), tail);
    paintSlots();
    if (cur) cur.query = query;
  }

  function press(n) {
    if (ov.closed || cur.locked) return;
    audio.sfx('tap');
    input.push(n);
    if (input.length < query.answer.length) return paintSlots();
    if (checkAnswer(query, input)) {
      paintSlots('good');
      flash('arrive', st.role.color);
      arriveAt(station);
      return;
    }
    paintSlots('bad');
    send({ type: 'wrongQuery' });
    audio.sfx('wrong');
    buzz([90, 60, 90]);
    shake(sheet);
    cur.locked = true;
    sheet.classList.add('locked');
    lockFill.style.animationDuration = RULES.wrongQueryLockMs + 'ms';
    lockTimer = setTimeout(unlock, RULES.wrongQueryLockMs);
  }

  function unlock() {
    clearTimeout(lockTimer);
    if (ov.closed) return;
    cur.locked = false;
    sheet.classList.remove('locked');
    newQuestion();
  }

  cur = { ov, station, query: null, locked: false, press, unlock };
  newQuestion();
  return ov;
}
