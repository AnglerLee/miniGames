// 판 위쪽의 얇은 띠: 판이 떠 있어도 가장 급한 경보(또는 크레인)의 남은 시간이 보이게 한다.
// 수리 판에서는 그 판의 경보를 빼고 "다른 경보"만 보여 준다 (그쪽이 더 급하면 판을 닫고 갈 수 있게).

import { h } from '../shared/dom.js';
import { remaining } from '../shared/engine.js';
import { G, urgentFirst, secs, ratioOf, levelOf, routeLeft } from './game.js';

export function urgentStrip({ exceptId = null } = {}) {
  const icon = h('span', { class: 'ustrip-icon' });
  const text = h('span', { class: 'ustrip-text' });
  const num = h('b', { class: 'ustrip-num' });
  const fill = h('i');
  const el = h('div', { class: 'ustrip' }, icon, text, num, h('span', { class: 'ustrip-bar' }, fill));
  let lastId = undefined;

  function update(s) {
    let ms = null;
    let ratio = 1;
    let id = null;
    if (s.phase === 'run') {
      const a = urgentFirst(s).find((x) => x.id !== exceptId);
      if (a) {
        id = a.id;
        ms = remaining(s, a);
        ratio = ratioOf(s, a);
        if (id !== lastId) {
          const st = G.stations[a.station];
          el.style.setProperty('--c', st.role.color);
          icon.textContent = st.role.icon;
          text.textContent = (exceptId ? '다른 경보 · ' : '') + st.role.name + ' · ' + st.room.name;
        }
      }
    } else if (s.phase === 'route' && s.route) {
      id = 'route';
      ms = routeLeft(s);
      ratio = Math.min(1, ms / s.route.limitMs);
      if (id !== lastId) {
        el.style.setProperty('--c', 'var(--amber)');
        icon.textContent = '🏗️';
        text.textContent = '크레인 순서';
      }
    } else if (s.phase === 'dock') {
      id = 'dock';
      if (id !== lastId) {
        el.style.setProperty('--c', 'var(--cyan)');
        icon.textContent = '⏱️';
        text.textContent = '출항 점검 · 시간 제한 없어';
      }
    }
    lastId = id;
    el.hidden = id === null;
    el.dataset.level = ms === null ? 'ok' : levelOf(ratio);
    num.textContent = ms === null ? '' : secs(ms) + '초';
    fill.style.transform = 'scaleX(' + (ms === null ? 0 : ratio).toFixed(4) + ')';
  }

  update(G.state);
  return { el, update };
}
