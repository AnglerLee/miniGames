// 3단계 전력실 매뉴얼: 배전표. 어느 스위치가 어느 장치로 전기를 보내는지 나와 있다.

import { h } from '../../shared/dom.js';
import { tagName } from '../../shared/tags.js';
import { LOADS, SWITCHES } from '../../shared/puzzles/powergrid.js';
import { tagCanvas } from '../../shared/draw2d/tags.js';
import { manualHeader } from './common.js';

const LOAD_COLORS = ['#4da3ff', '#ffb547', '#ff4d5e'];

export function renderPower(view, manual) {
  manualHeader(view, {
    script: '전력실이다. 배전반의 스위치 중 지금 켜져 있는 것을 표식으로 말해라.',
    steps: [
      '목표: <b>잠금장치와 카메라는 꺼지고, 경보 회로는 계속 켜져 있어야</b> 합니다.',
      '장치는 연결된 스위치가 <b>하나라도</b> 켜져 있으면 작동합니다.',
      '경보 회로가 <b>한순간이라도</b> 꺼지면 실수입니다. 경보를 살리는 스위치를 끄기 전에 다른 경보 스위치를 먼저 켜세요.',
      manual.limited
        ? `동시에 켤 수 있는 스위치는 <b>${manual.maxOn}개</b>까지입니다. 넘으면 과부하로 실수가 됩니다.`
        : null,
      '실수하면 스위치 상태가 바뀝니다. 무엇이 켜져 있는지 다시 물어보세요.',
    ].filter(Boolean),
  });

  const rows = [];
  for (let i = 0; i < SWITCHES; i++) {
    rows.push(
      h(
        'tr',
        {},
        h('td', { class: 'name' }, tagCanvas(manual.tags[i], 28), tagName(manual.tags[i])),
        LOADS.map((load, k) =>
          h('td', {}, manual.feeds[i] & load.bit ? h('span', { class: 'dot', style: { background: LOAD_COLORS[k] } }) : '')
        )
      )
    );
  }
  view.append(
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'section-title', text: '배전표 (● 표시된 장치로 전기를 보냄)' }),
      h(
        'table',
        { class: 'grid', id: 'power-table' },
        h('thead', {}, h('tr', {}, h('th', { text: '스위치' }), LOADS.map((l) => h('th', { text: l.name })))),
        h('tbody', {}, rows)
      )
    )
  );
}
