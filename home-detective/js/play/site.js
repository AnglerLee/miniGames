// 탭 1 "현장": 방마다 숨은 쪽지 칸. 찾은 쪽지는 눌러서 다시 연다.

import { h, fill, avatar, toast } from '../shared/dom.js';
import { codeText } from '../shared/case.js';
import { evidenceTitle, evidenceIcon } from '../shared/text.js';
import { G, foundOf, progress, heardAll } from './game.js';
import { openTag } from './pad.js';
import { replay } from './fx.js';

export function renderSite(main) {
  const cs = G.cs;
  const pr = progress();
  const kindHint = cs.difficulty < 2;

  const rooms = cs.rooms.map((room, r) => {
    const tags = cs.tags.filter((t) => t.room === r);
    const crime = r === cs.crimeRoom;
    return h(
      'section',
      { class: 'card room' + (crime ? ' crime' : ''), 'data-room': r },
      h(
        'div',
        { class: 'room-head' },
        h('span', { class: 'room-icon', text: room.icon }),
        h('h3', { text: room.name }),
        crime ? h('span', { class: 'crime-tag', text: '사건 현장' }) : null,
        h('span', { class: 'room-count soft', text: tags.filter((t) => foundOf(t)).length + '/' + tags.length })
      ),
      h('div', { class: 'slots' }, tags.map((tag) => slot(tag, kindHint)))
    );
  });

  fill(main,
    h(
      'div',
      { class: 'site-top' },
      h('p', { class: 'site-lead' }, '찾은 쪽지 ', h('b', { text: pr.found + ' / ' + pr.tags })),
      h('p', { class: 'soft', text: '쪽지를 찾으면 가운데 버튼을 눌러 기호를 넣어.' })
    ),
    rooms
  );
}

function slot(tag, kindHint) {
  const cs = G.cs;
  const f = foundOf(tag);
  if (!f) {
    const node = h(
      'button',
      { class: 'slot unknown', type: 'button', 'data-tag': tag.id, 'aria-label': '아직 못 찾은 쪽지' },
      h('span', { class: 'slot-q', text: '?' }),
      kindHint ? h('small', { text: tag.kind === 'suspect' ? '용의자' : '증거' }) : null
    );
    node.addEventListener('click', () => {
      replay(node, 'shake');
      toast('아직 못 찾은 쪽지야. 이 방을 뒤져 봐');
    });
    return node;
  }
  const done = tag.kind === 'suspect' ? heardAll(tag.ref) : f.done;
  const face = tag.kind === 'suspect' ? avatar(cs.suspects[tag.ref], 'small') : h('span', { class: 'slot-ev', text: evidenceIcon(cs.evidence[tag.ref]) });
  const name = tag.kind === 'suspect' ? cs.suspects[tag.ref].name : evidenceTitle(cs, cs.evidence[tag.ref]);
  return h(
    'button',
    { class: 'slot found' + (done ? ' done' : ' doing'), type: 'button', 'data-tag': tag.id, onClick: () => openTag(tag, false) },
    h('span', { class: 'slot-code', text: codeText(tag.code) }),
    face,
    h('span', { class: 'slot-name', text: name }),
    done ? null : h('span', { class: 'slot-doing', text: '조사 중' })
  );
}
