// 크레인 순서. 보여 주는 동안에는 구역 동그라미가 차례로 뜨고("외워!"),
// 그 뒤에는 순서를 숨긴 채 진행 점과 남은 시간만 보인다. 다시 보기는 시간이 깎인다.

import { h } from '../shared/dom.js';
import { G, send, secs, routeLeft, levelOf } from './game.js';
import { dot } from './art.js';
import { replay } from './fx.js';

// 보여 주는 구간의 길이. 다시 보기는 절반만 보여 주므로 막대 기준을 그때마다 잡는다.
let span = { until: null, ms: 1 };
function showSpan(s) {
  if (span.until !== s.route.shownUntil) span = { until: s.route.shownUntil, ms: Math.max(1, s.route.shownUntil - s.clock) };
  return span.ms;
}

export function routeShowView(s) {
  const fill = h('i');
  const el = h(
    'div',
    { class: 'route show' },
    h('p', { class: 'kicker', text: '크레인 순서' }),
    h('h2', { class: 'route-title', text: '외워!' }),
    h(
      'ol',
      { class: 'route-seq n' + s.route.order.length },
      s.route.order.map((idx, i) => {
        const st = G.stations[idx];
        return h('li', { style: { '--c': st.role.color, '--i': i } }, h('em', { text: String(i + 1) }), dot(st), h('b', { text: st.room.name }));
      })
    ),
    h('div', { class: 'meter' }, fill),
    h('p', { class: 'route-sub', text: '이 순서대로 구역을 돌며 버튼을 눌러' })
  );
  return {
    el,
    update(st) {
      const ms = showSpan(st);
      fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (st.route.shownUntil - st.clock) / ms)).toFixed(4) + ')';
    },
  };
}

export function routeGoView(s) {
  const n = s.route.order.length;
  const dots = s.route.order.map(() => h('span', { class: 'rdot' }));
  const stepEl = h('p', { class: 'route-step' });
  const num = h('b');
  const fill = h('i');
  const el = h(
    'div',
    { class: 'route go' },
    h('p', { class: 'kicker', text: '크레인 인양' }),
    h('h2', { class: 'route-title', text: '순서대로 구역을 돌아' }),
    h('div', { class: 'route-dots' }, dots),
    stepEl,
    h('div', { class: 'route-time' }, num, h('small', { text: '초' })),
    h('div', { class: 'meter' }, fill),
    h('button', { class: 'btn ghost block route-peek', type: 'button', 'data-act': 'peek', text: '순서 다시 보기 (-5초)', onClick: () => send({ type: 'peek' }) })
  );
  let lastStep = null;
  let lastSec = null;
  return {
    el,
    update(st) {
      const r = st.route;
      if (r.step !== lastStep) {
        dots.forEach((d, i) => {
          const where = G.stations[r.order[i]];
          const done = i < r.step;
          d.className = 'rdot' + (done ? ' done' : i === r.step ? ' cur' : '');
          d.textContent = done ? where.role.icon : '?';
          if (done) d.style.setProperty('--c', where.role.color);
          else d.style.removeProperty('--c');
          if (done && lastStep !== null && i === r.step - 1) replay(d, 'pop');
        });
        stepEl.textContent = r.step + ' / ' + n;
        lastStep = r.step;
      }
      const left = routeLeft(st);
      const ratio = Math.max(0, Math.min(1, left / r.limitMs));
      const sec = secs(left);
      if (sec !== lastSec) {
        num.textContent = sec;
        lastSec = sec;
      }
      fill.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
      el.dataset.level = levelOf(ratio);
    },
  };
}
