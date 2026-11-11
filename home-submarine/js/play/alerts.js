// 가운데 화면: 경보 카드(급한 순), 경보가 없을 때의 소나.
// 걸으면서 보는 카드라 "어느 방으로"가 가장 크고, 남은 초가 그다음으로 크다.

import { h } from '../shared/dom.js';
import { remaining } from '../shared/engine.js';
import { PARTS } from '../shared/content.js';
import { alertGuide } from '../shared/text.js';
import { G, urgentFirst, secs, ratioOf, levelOf } from './game.js';
import { subIcon } from './art.js';
import { replay } from './fx.js';

/** 이미 보여 준 경보. 처음 뜬 카드만 들어오는 연출을 한다 (부품을 챙겨 카드가 다시 그려질 때는 하지 않는다) */
const seen = new Set();

/** 지금 해야 할 일을 그림 하나로 */
function guideIcon(a) {
  if (a.kind === 'fetch') return a.hasPart ? '🔧' : PARTS[a.part].icon;
  if (a.kind === 'relay') return a.sawCode ? '⌨️' : '👀';
  return '🔧';
}

function card(a) {
  const st = G.stations[a.station];
  const num = h('b', { class: 'acard-num' });
  const fill = h('i');
  const el = h(
    'article',
    { class: 'acard', 'data-id': a.id, 'data-station': a.station, style: { '--c': st.role.color } },
    // 윗줄: 그림 · 어디로 · 남은 초 (가장 크게). 아랫줄은 카드 폭을 다 써서 좁은 화면에서도 덜 꺾인다.
    h(
      'div',
      { class: 'acard-main' },
      h('span', { class: 'acard-icon', text: st.role.icon }),
      h('h3', { class: 'acard-where' }, h('span', { class: 'role', text: st.role.name }), h('span', { class: 'sep', text: ' · ' }), h('span', { class: 'room', text: st.room.name })),
      h(
        'div',
        { class: 'acard-time' },
        h('span', { class: 'acard-sec' }, num, h('small', { text: '초' })),
        h('span', { class: 'acard-sev', title: '놓치면 선체 -' + a.severity, text: '💥'.repeat(a.severity) })
      )
    ),
    h('p', { class: 'acard-title', text: a.title }),
    h('p', { class: 'acard-guide' }, h('i', { text: guideIcon(a) }), h('span', { text: alertGuide(a, G.stations) })),
    h('div', { class: 'acard-bar' }, fill)
  );
  if (!seen.has(a.id)) {
    seen.add(a.id);
    el.classList.add('enter');
  }
  let lastSec = null;
  let lastLevel = null;
  return {
    el,
    update(s) {
      const live = s.active.find((x) => x.id === a.id);
      if (!live) return;
      const r = ratioOf(s, live);
      const sec = secs(remaining(s, live));
      const lv = levelOf(r);
      if (lv !== lastLevel) {
        el.dataset.level = lv;
        lastLevel = lv;
      }
      if (sec !== lastSec) {
        num.textContent = sec;
        // 빨강일 때는 초마다 숫자가 뛴다
        if (lv === 'red' && lastSec !== null) replay(num, 'beat');
        lastSec = sec;
      }
      fill.style.transform = 'scaleX(' + r.toFixed(4) + ')';
    },
  };
}

export function alertsView(s) {
  const cards = urgentFirst(s).map(card);
  const el = h('div', { class: 'alerts n' + cards.length }, cards.map((c) => c.el));
  return {
    el,
    update(st) {
      for (const c of cards) c.update(st);
    },
  };
}

export function calmView() {
  const el = h(
    'div',
    { class: 'calm' },
    h(
      'div',
      { class: 'sonar' },
      h('i', { class: 'sonar-ring r1' }),
      h('i', { class: 'sonar-ring r2' }),
      h('i', { class: 'sonar-ring r3' }),
      h('i', { class: 'sonar-sweep' }),
      h('i', { class: 'sonar-blip b1' }),
      h('i', { class: 'sonar-blip b2' }),
      subIcon('sonar-sub', '#4cc9f0')
    ),
    h('p', { class: 'calm-title', text: '이상 없음' }),
    h('p', { class: 'calm-sub', text: '다음 경보를 기다리는 중' })
  );
  return { el, update() {} };
}
