// 출항 점검 화면: 모든 구역을 한 번씩 돌며 전원을 켠다. 시간 제한이 없고, 이때의 걸음이 기준이 된다.

import { h } from '../shared/dom.js';
import { STAGES } from '../shared/content.js';
import { G } from './game.js';
import { dot } from './art.js';
import { replay } from './fx.js';

export function dockView() {
  const count = h('b', { class: 'dock-count' });
  const rows = G.stations.map((st) =>
    h(
      'li',
      { class: 'dock-row', style: { '--c': st.role.color } },
      dot(st),
      h('span', { class: 'dock-name' }, h('b', { text: st.role.name }), h('span', { text: st.room.name })),
      h('span', { class: 'dock-state' })
    )
  );
  const el = h(
    'div',
    { class: 'dock' },
    h('p', { class: 'kicker', text: STAGES[0].name }),
    h('h2', { class: 'dock-title' }, h('span', { text: '모든 구역의 전원을 켜자' }), count),
    h('ul', { class: 'dock-list' }, rows),
    h('p', { class: 'dock-note' }, h('b', { text: '⏱️ 시간 제한 없어.' }), ' 평소 걸음으로 걸어. 이 걸음이 기준이 돼.')
  );
  let lastKey = null;
  return {
    el,
    update(s) {
      const key = s.visited.join(',');
      if (key === lastKey) return;
      const animate = lastKey !== null;
      lastKey = key;
      count.replaceChildren(String(s.visited.length), h('small', { text: '/' + G.stations.length }));
      rows.forEach((row, i) => {
        const on = s.visited.includes(i);
        if (on && animate && !row.classList.contains('on')) replay(row, 'light');
        row.classList.toggle('on', on);
        row.lastChild.textContent = on ? '켜짐' : '꺼짐';
      });
    },
  };
}
