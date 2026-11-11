// 탭 2 "수첩": 수사 규칙, 용의자 카드(무늬, 지문, 들은 진술), 조사한 증거.
// 줄을 누르면 아이의 표시가 돈다: 없음 → ✔ 믿음 → ✖ 의심. 판정에는 쓰지 않는다.

import { h, fill, avatar } from '../shared/dom.js';
import { saveRun } from '../shared/store.js';
import { traitCanvas } from '../shared/draw.js';
import { FOOT_PATTERNS, PRINT_TYPES } from '../shared/content.js';
import { rules, statementNote, personaName, evidenceTitle, evidenceIcon, factText } from '../shared/text.js';
import { G, met, heard, evDone } from './game.js';
import { audio } from './audio.js';

let rulesOpen = false;
const MARKS = [
  { icon: '', label: '' },
  { icon: '✔', label: '믿음' },
  { icon: '✖', label: '의심' },
];

export function markOf(key) {
  return (G.run.marks && G.run.marks[key]) || 0;
}

/** 표시를 한 칸 돌린다. 수첩 안에서만 바뀌므로 전체를 다시 그리지 않는다. */
function cycleMark(key, node) {
  const next = (markOf(key) + 1) % 3;
  if (next) G.run.marks[key] = next;
  else delete G.run.marks[key];
  saveRun(G.run);
  audio.sfx('tap');
  paintMark(node, next);
}

function paintMark(node, m) {
  node.dataset.mark = m;
  const badge = node.querySelector('.mark');
  badge.textContent = MARKS[m].icon;
  badge.setAttribute('aria-label', MARKS[m].label || '표시 없음');
}

function markable(key, cls, ...children) {
  const node = h('button', { class: 'nb-line ' + cls, type: 'button', 'data-key': key }, ...children, h('span', { class: 'mark' }));
  node.addEventListener('click', () => cycleMark(key, node));
  paintMark(node, markOf(key));
  return node;
}

export function renderNotebook(main) {
  const cs = G.cs;
  const rulesBox = h(
    'details',
    { class: 'card nb-rules', open: rulesOpen },
    h('summary', { text: '📜 수사 규칙' }),
    h('ol', {}, rules(cs).map((r) => h('li', { text: r })))
  );
  rulesBox.addEventListener('toggle', () => (rulesOpen = rulesBox.open));

  const suspects = cs.suspects.map((who, s) => {
    const seen = met(s);
    const lines = cs.slots.map((label, t) =>
      heard(s, t)
        ? markable('s:' + s + ':' + t, 'heard', h('span', { class: 'nb-slot', text: label.replace('오후 ', '') }), h('span', { class: 'nb-text', text: statementNote(cs, s, t) }))
        : h('div', { class: 'nb-line empty' }, h('span', { class: 'nb-slot', text: label.replace('오후 ', '') }), h('span', { class: 'nb-text soft', text: seen ? '아직 못 들음' : '…' }))
    );
    return h(
      'section',
      { class: 'card nb-suspect' + (seen ? '' : ' unmet'), 'data-suspect': s },
      h(
        'div',
        { class: 'nb-who' },
        avatar(who),
        h('div', { class: 'nb-name' }, h('h3', { text: who.name }), h('span', { class: 'soft', text: seen ? personaName(cs, s) : '말투 ?' })),
        h(
          'div',
          { class: 'traits' },
          trait('foot', who.foot, FOOT_PATTERNS[who.foot], '발자국'),
          trait('print', who.print, PRINT_TYPES[who.print], '지문')
        )
      ),
      h('div', { class: 'nb-lines' }, lines),
      seen ? null : h('span', { class: 'stamp unmet-stamp', text: '아직 못 만남' })
    );
  });

  const done = cs.evidence.map((ev, i) => ({ ev, i })).filter(({ i }) => evDone(i));
  const evidence = done.length
    ? done.map(({ ev, i }) =>
        markable(
          'e:' + i,
          'nb-ev',
          h('span', { class: 'nb-ev-icon', text: evidenceIcon(ev) }),
          h(
            'span',
            { class: 'nb-text' },
            h('b', { text: evidenceTitle(cs, ev) }),
            h('span', { text: factText(cs, ev) }),
            h('small', { class: 'soft', text: '📍 ' + cs.rooms[ev.room].name })
          )
        )
      )
    : [h('p', { class: 'soft nb-none', text: '아직 조사한 증거가 없어. 방에 붙은 쪽지를 찾아봐.' })];

  fill(main,
    rulesBox,
    h('h2', { class: 'nb-h', text: '용의자' }),
    h('p', { class: 'nb-sub soft', text: '줄을 누르면 ✔ 믿음 → ✖ 의심 표시를 할 수 있어.' }),
    suspects,
    h('h2', { class: 'nb-h', text: '증거 ' + done.length + '/' + cs.evidence.length }),
    h('div', { class: 'card nb-evs' }, evidence)
  );
}

function trait(kind, value, name, label) {
  return h('figure', { class: 'trait' }, traitCanvas(kind, value, 44), h('figcaption', {}, h('small', { text: label }), h('span', { text: name })));
}
