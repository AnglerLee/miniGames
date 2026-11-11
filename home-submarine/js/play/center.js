// 임무 화면 가운데: 단계와 상황에 맞는 판을 고른다.
// 구성이 바뀔 때(경보가 뜨거나 사라질 때, 부품을 챙겼을 때)만 다시 만들고, 그 밖에는 숫자와 막대만 바꾼다.

import { h } from '../shared/dom.js';
import { urgentFirst } from './game.js';
import { alertsView, calmView } from './alerts.js';
import { dockView } from './dock.js';
import { routeShowView, routeGoView } from './route.js';

function keyOf(s) {
  if (s.phase === 'dock') return 'dock';
  if (s.phase === 'route') return s.clock < s.route.shownUntil ? 'route-show' : 'route-go';
  const list = urgentFirst(s);
  if (!list.length) return 'calm';
  return 'run:' + list.map((a) => a.id + (a.hasPart ? '+p' : '') + (a.sawCode ? '+s' : '')).join(',');
}

function build(key, s) {
  if (key === 'dock') return dockView(s);
  if (key === 'route-show') return routeShowView(s);
  if (key === 'route-go') return routeGoView(s);
  if (key === 'calm') return calmView(s);
  return alertsView(s);
}

export function mountCenter() {
  const el = h('main', { class: 'center' });
  let key = null;
  let view = null;
  return {
    el,
    update(s) {
      const k = keyOf(s);
      if (k !== key) {
        key = k;
        view = build(k, s);
        el.replaceChildren(view.el);
      }
      view.update(s);
    },
  };
}
