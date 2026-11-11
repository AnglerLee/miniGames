// 쪽지 인쇄: 지금 사건의 기호만 A4 에 한 줄 3장씩 늘어놓는다.
// 아이가 쪽지를 봐도 괜찮도록 어디에 둘지와 정답은 인쇄하지 않고, 화면에만 보인다.

import { loadSetup } from './shared/store.js';
import { buildCase, codeText } from './shared/case.js';
import { h } from './shared/dom.js';

function message(title, text) {
  return h(
    'section',
    { class: 'card', style: { marginTop: '20px' } },
    h('h2', { text: title }),
    h('p', { class: 'soft', text }),
    h('a', { class: 'btn primary block', href: 'setup.html', style: { marginTop: '14px' } }, '준비 화면으로')
  );
}

function whereText(cs, t) {
  const room = cs.rooms[t.room].name;
  if (t.kind === 'suspect') return [h('b', { text: cs.suspects[t.ref].name }), '에게 붙여 ', h('b', { text: room }), '에 두기'];
  if (t.room === cs.crimeRoom) return [h('b', { text: room }), '의 간식이 있던 자리 근처에 숨기기'];
  return [h('b', { text: room }), ' 어딘가에 숨기기'];
}

function render() {
  const page = h('div', { class: 'page' });
  document.body.append(page);
  const setup = loadSetup();
  if (!setup) {
    page.append(message('준비 중인 사건이 없어요', '먼저 준비 화면에서 방과 인형을 골라 주세요.'));
    return;
  }
  let cs;
  try {
    cs = buildCase(setup);
  } catch (e) {
    page.append(message('쪽지를 만들 수 없어요', e.message));
    return;
  }
  const footer = '우리 집 탐정 · 사건 No.' + setup.caseNo;

  page.append(
    h(
      'header',
      { class: 'screen-only' },
      h('a', { class: 'link-back', href: 'setup.html' }, '← 준비 화면으로'),
      h('h1', { class: 'wiz-title', text: '쪽지 인쇄' }),
      h('p', { class: 'soft small', style: { marginTop: '4px' }, text: '사건 No.' + setup.caseNo + ' · 쪽지 ' + cs.tags.length + '장 · A4 한 장에 나와요. 점선을 따라 오려 쓰세요.' }),
      h(
        'div',
        { class: 'print-tools' },
        h('button', { class: 'btn primary', type: 'button', id: 'print-btn', onClick: () => window.print() }, '🖨 인쇄'),
        h('a', { class: 'btn ghost', href: 'setup.html' }, '준비 화면')
      )
    ),
    h(
      'section',
      { class: 'sheet', id: 'sheet', 'aria-label': '인쇄할 쪽지' },
      cs.tags.map((t) => h('div', { class: 'slip', 'data-tag': t.id }, h('div', { class: 'code', text: codeText(t.code) }), h('div', { class: 'foot', text: footer })))
    ),
    h(
      'section',
      { class: 'card screen-only', id: 'where', style: { marginTop: '16px' } },
      h('h2', { text: '어느 기호를 어디에' }),
      h('p', { class: 'small muted', style: { marginBottom: '10px' }, text: '이 목록은 화면에만 보이고 인쇄되지 않아요.' }),
      cs.rooms.map((room, r) => {
        const tags = cs.tags.filter((t) => t.room === r);
        if (!tags.length) return null;
        return [
          h('h3', { text: room.icon + ' ' + room.name }),
          h(
            'ul',
            { class: 'where-list' },
            tags.map((t) => h('li', {}, h('span', { class: 'note-code', text: codeText(t.code) }), h('span', {}, whereText(cs, t))))
          ),
        ];
      })
    )
  );
}

render();
