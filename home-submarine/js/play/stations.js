// 아래 구역 버튼 줄. 도착한 방의 버튼을 누르면 도착 확인 판이 뜬다.
// 경보가 걸린 구역은 테두리가 깜빡이고, 먼저 들러야 할 곳(부품 창고, 좌표를 보는 곳)에는 작은 표가 붙는다.

import { h } from '../shared/dom.js';
import { PARTS } from '../shared/content.js';
import { G } from './game.js';

export function mountStations(onPick) {
  const n = G.stations.length;
  const buttons = G.stations.map((st) => {
    const badge = h('span', { class: 'sbtn-badge' });
    const btn = h(
      'button',
      { class: 'sbtn', type: 'button', 'data-station': st.idx, style: { '--c': st.role.color }, 'aria-label': st.role.name + ' ' + st.room.name, onClick: () => onPick(st.idx) },
      h('span', { class: 'sbtn-dot' }, h('span', { class: 'sbtn-icon', text: st.role.icon }), badge),
      // 긴 방 이름은 글자를 줄여 한 줄에 둔다 (한 글자만 다음 줄로 넘어가면 읽기 어렵다)
      h('span', { class: 'sbtn-room' + (st.room.name.length >= 7 ? ' xl' : st.room.name.length >= 6 ? ' l' : ''), text: st.room.name }),
      h('span', { class: 'sbtn-here', text: '여기' })
    );
    return { btn, badge };
  });
  const el = h('nav', { class: 'bar n' + n + (n > 4 ? ' two' : '') }, buttons.map((b) => b.btn));
  let lastKey = null;

  function update(s) {
    const alertAt = new Set();
    const stopAt = new Map(); // 먼저 들를 곳 → 표
    if (s.phase === 'run') {
      for (const a of s.active) {
        alertAt.add(a.station);
        if (a.kind === 'fetch' && !a.hasPart) stopAt.set(a.source, PARTS[a.part].icon);
        if (a.kind === 'relay' && !a.sawCode) stopAt.set(a.source, '👀');
      }
    }
    const here = s.lastCheckin ? s.lastCheckin.station : -1;
    const lit = s.phase === 'dock' ? s.visited : [];
    const key = [s.phase, [...alertAt].join(), [...stopAt].join(), here, lit.join()].join('|');
    if (key === lastKey) return;
    lastKey = key;
    el.classList.toggle('docking', s.phase === 'dock');
    buttons.forEach(({ btn, badge }, i) => {
      btn.classList.toggle('alert', alertAt.has(i));
      btn.classList.toggle('stop', stopAt.has(i));
      btn.classList.toggle('here', i === here);
      btn.classList.toggle('lit', lit.includes(i));
      badge.textContent = stopAt.get(i) || '';
    });
  }

  return { el, update };
}
