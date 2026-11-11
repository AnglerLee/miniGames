// 탭 3 "정리표": 용의자 × 세 시각 표. 시계를 조사하면 사건 시각 열이 빛난다.
// 좁은 폭(320)에서도 6명이 읽히게 아이콘을 앞세우고 방 이름은 3자로 줄인다.

import { h, fill, avatar } from '../shared/dom.js';
import { evidenceTitle, evidenceIcon, itemText } from '../shared/text.js';
import { G, heard, evDone, short, shortRoom } from './game.js';
import { markOf } from './notebook.js';
import { audio } from './audio.js';

export function renderBoard(main) {
  const cs = G.cs;
  const crime = evDone(0) ? cs.crimeSlot : -1;
  const detailText = h('p', { class: 'soft', text: '칸을 누르면 전체 문장이 여기 나와.' });
  const detail = h('div', { class: 'bd-detail', 'aria-live': 'polite' }, detailText);
  let picked = null;

  function show(node, item) {
    if (picked) picked.classList.remove('picked');
    picked = node;
    node.classList.add('picked');
    detailText.className = '';
    detailText.textContent = itemText(cs, item);
    audio.sfx('tap');
  }

  const grid = h('div', { class: 'bd-grid', role: 'table', 'aria-label': '정리표' });
  grid.append(h('div', { class: 'bd-corner', text: '용의자' }));
  cs.slots.forEach((label, t) =>
    grid.append(
      h('div', { class: 'bd-col' + (t === crime ? ' crime' : ''), role: 'columnheader' }, t === crime ? h('span', { class: 'bd-crime', text: '사건 시각' }) : null, h('b', { text: label }))
    )
  );
  cs.suspects.forEach((who, s) => {
    grid.append(h('div', { class: 'bd-who', role: 'rowheader' }, avatar(who, 'small'), h('span', { text: short(who.name, 4) })));
    cs.slots.forEach((_, t) => grid.append(cell(s, t, t === crime, show)));
  });

  const chips = cs.evidence
    .map((ev, index) => ({ ev, index }))
    .filter(({ index }) => evDone(index))
    .map(({ ev, index }) => {
      const slotName = typeof ev.fact.slot === 'number' ? ' · ' + cs.slots[ev.fact.slot] : '';
      const node = h('button', { class: 'chip bd-chip' + (ev.fact.slot === crime ? ' crime' : ''), type: 'button', 'data-ev': index }, evidenceIcon(ev) + ' ' + evidenceTitle(cs, ev) + slotName);
      node.addEventListener('click', () => show(node, { type: 'evidence', index }));
      return node;
    });

  fill(main,
    detail,
    h('div', { class: 'card bd-card' }, grid),
    h('h2', { class: 'nb-h', text: '조사한 증거' }),
    chips.length ? h('div', { class: 'bd-chips' }, chips) : h('p', { class: 'soft', text: '아직 조사한 증거가 없어.' }),
    crime < 0 ? h('p', { class: 'soft bd-tip', text: '💡 사건 현장의 시계를 조사하면 사건 시각을 알 수 있어.' }) : null
  );
}

function cell(s, t, crime, show) {
  const cs = G.cs;
  if (!heard(s, t)) return h('div', { class: 'bd-cell none' + (crime ? ' crime' : ''), role: 'cell', text: '…' });
  const st = cs.statements[s][t];
  const room = cs.rooms[st.room];
  const c = st.comp;
  let comp = '';
  if (c && c.kind === 'alone') comp = '혼자';
  else if (c && c.kind === 'with') comp = '👥' + short(cs.suspects[c.who].name, 3);
  else if (c && c.kind === 'without') comp = '🚫' + short(cs.suspects[c.who].name, 3);
  const node = h(
    'button',
    { class: 'bd-cell' + (crime ? ' crime' : ''), type: 'button', role: 'cell', 'data-cell': s + ':' + t, 'data-mark': markOf('s:' + s + ':' + t) },
    h('span', { class: 'bd-room' }, h('i', { text: room.icon }), shortRoom(room.name)),
    comp ? h('small', { class: 'bd-comp', text: comp }) : null
  );
  node.addEventListener('click', () => show(node, { type: 'statement', who: s, slot: t }));
  return node;
}
