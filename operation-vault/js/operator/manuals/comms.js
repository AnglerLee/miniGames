// 0단계 교신 점검 매뉴얼: 암구호 한 단어.

import { h } from '../../shared/dom.js';
import { manualHeader } from './common.js';

export function renderComms(view, manual) {
  manualHeader(view, {
    script: '여기는 본부. 교신 상태를 확인한다. 지금 부르는 암구호를 화면에서 골라라.',
    steps: [
      '아래 <b>암구호</b>를 아이에게 말해 주세요.',
      '아이가 맞게 고르면 작전이 시작되고 시계가 돌기 시작합니다.',
      '단계가 바뀔 때마다 아이 화면의 주파수가 바뀝니다. 그때마다 <b>주파수 바꾸기</b>를 눌러 새 숫자를 입력하세요.',
    ],
  });
  view.append(
    h(
      'div',
      { class: 'card center' },
      h('div', { class: 'section-title', text: '암구호' }),
      h('div', { id: 'comms-word', style: { fontSize: '40px', fontWeight: '900', color: 'var(--gold)' }, text: manual.word })
    )
  );
}
