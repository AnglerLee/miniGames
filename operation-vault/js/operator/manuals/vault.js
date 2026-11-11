// 5단계 금고실 매뉴얼: 명판별 변환표.

import { h } from '../../shared/dom.js';
import { tagName } from '../../shared/tags.js';
import { tagCanvas } from '../../shared/draw2d/tags.js';
import { manualHeader } from './common.js';

const WHICH = ['가장 작은 수', '가운데 수', '가장 큰 수'];
const NTH = ['첫째', '둘째', '셋째'];
const TURN = { right: '오른쪽으로 ↻', left: '왼쪽으로 ↺' };

export function renderVault(view, manual) {
  manualHeader(view, {
    script: '금고 앞이다. 다이얼을 아주 천천히 돌리면서 딸깍 걸리는 번호 세 개를 찾아라.',
    steps: [
      '<b>탐지</b>: 아이가 천천히 돌리다 걸리는 번호에서 손가락을 떼지 않고 멈춰 있으면 표시됩니다. 세 개를 찾습니다. 빨리 돌리면 느껴지지 않습니다.',
      '<b>변환</b>: 금고 <b>명판의 표식</b>을 물어보고 아래에서 같은 표식의 변환표를 봅니다. 찾은 번호를 작은 순서로 놓고 계산하세요.',
      `계산 결과가 <b>${manual.dial} 이상이면 ${manual.dial}을 빼고</b>, 0보다 작으면 ${manual.dial}을 더합니다. (눈금은 0부터 ${manual.dial - 1}까지)`,
      '<b>입력</b>: 첫째 번호는 오른쪽으로, 둘째는 왼쪽으로, 셋째는 오른쪽으로 돌려 맞춘 뒤, 손가락을 떼지 않고 멈춰서 확정합니다.',
      '지나쳤으면 되돌리지 말고 <b>같은 방향으로 한 바퀴 더</b> 돌려야 합니다. 틀리면 숨은 번호가 바뀝니다.',
    ],
  });

  for (const plate of manual.plates) {
    view.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'plate' }, tagCanvas(plate.tag, 32), `명판: ${tagName(plate.tag)}`),
        h(
          'div',
          { class: 'plate-rule' },
          [0, 1, 2].flatMap((i) => [
            h('span', { class: 'step', text: `${NTH[i]} · ${TURN[manual.turns[i]]}` }),
            h('span', {}, `${WHICH[plate.order[i]]} `, h('b', { text: plate.add[i] > 0 ? `+ ${plate.add[i]}` : `− ${-plate.add[i]}` })),
          ])
        )
      )
    );
  }
}
