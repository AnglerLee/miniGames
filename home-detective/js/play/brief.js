// 표지(사건 파일)와 브리핑. 시계는 "수사 시작"을 누를 때부터 간다.

import { h, avatar } from '../shared/dom.js';
import { DIFFICULTY } from '../shared/content.js';
import { RULES } from '../shared/score.js';
import { briefing, rules } from '../shared/text.js';
import { G } from './game.js';
import { audio } from './audio.js';

export function showCover(root, onOpen) {
  const setup = G.setup;
  const who = setup.detective ? setup.detective + ' 탐정' : '꼬마 탐정';
  const folder = h(
    'button',
    { class: 'cover', type: 'button', 'aria-label': '사건 파일 열기' },
    h('span', { class: 'cover-tab', text: '사건 파일' }),
    h('div', { class: 'cover-paper' },
      h('p', { class: 'cover-kicker', text: '우리 집 탐정 사무소' }),
      h('h1', { class: 'cover-no' }, '사건 파일 ', h('b', { text: 'No.' + (setup.caseNo || 1) })),
      h('p', { class: 'cover-title', text: '사라진 간식 상자' }),
      h('span', { class: 'stamp cover-stamp', text: '기밀' }),
      h('p', { class: 'cover-who' }, '담당 ', h('b', { text: who })),
      h('p', { class: 'cover-tap', text: '눌러서 열어 봐' })
    )
  );
  folder.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('open');
    folder.classList.add('opening');
    setTimeout(onOpen, 380);
  });
  root.replaceChildren(h('div', { class: 'cover-wrap' }, folder));
}

export function showBriefing(root, onStart) {
  const { cs, setup } = G;
  const D = DIFFICULTY[cs.difficulty] || DIFFICULTY[1];
  const start = h('button', { class: 'btn primary block brief-start', type: 'button', text: '🔎 수사 시작', onClick: onStart });
  root.replaceChildren(
    h(
      'div',
      { class: 'brief' },
      h(
        'div',
        { class: 'brief-scroll' },
        h('div', { class: 'card brief-page' },
          h('div', { class: 'brief-head' }, h('h2', { text: '사건 개요' }), h('span', { class: 'stamp', text: '기밀' })),
          briefing(cs, setup.detective).map((p) => h('p', { class: 'brief-p', text: p })),
          h('p', { class: 'brief-meta' },
            h('span', { class: 'chip', text: '⏱ 제한 ' + setup.minutes + '분' }),
            h('span', { class: 'chip', text: '★ 배지 ' + RULES.badges + '개' }),
            h('span', { class: 'chip', text: '난이도 ' + D.name })
          )
        ),
        h('div', { class: 'card brief-page' },
          h('h2', { text: '용의자 ' + cs.suspects.length + '명' }),
          h('div', { class: 'roster' }, cs.suspects.map((p) => h('div', { class: 'roster-one' }, avatar(p), h('span', { text: p.name }))))
        ),
        h('div', { class: 'card brief-page' },
          h('h2', { text: '수사 규칙' }),
          h('ol', { class: 'rules-list' }, rules(cs).map((r) => h('li', { text: r })))
        ),
        h('div', { class: 'card brief-page' },
          h('h2', { text: '하는 법' }),
          h('ul', { class: 'howto' },
            h('li', {}, h('span', { text: '📝' }), h('p', { text: '쪽지를 찾으면 가운데 "쪽지 발견" 버튼을 눌러 기호를 넣어.' })),
            h('li', {}, h('span', { text: '🗣️' }), h('p', { text: '인형에 붙은 쪽지는 탐문, 방에 숨은 쪽지는 증거 조사야.' })),
            h('li', {}, h('span', { text: '🚨' }), h('p', { text: '범인을 알겠으면 고발해. 틀리면 시간이 깎여.' }))
          )
        )
      ),
      h('div', { class: 'brief-foot' }, start)
    )
  );
}
