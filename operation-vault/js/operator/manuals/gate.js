// 1단계 정문 게이트 매뉴얼: 문양 사전과 색 보정표.

import { h } from '../../shared/dom.js';
import { COLORS } from '../../shared/tags.js';
import { FRAMES } from '../../shared/puzzles/glyphgate.js';
import { glyphCanvas } from '../../shared/draw2d/glyph.js';
import { manualHeader } from './common.js';

export function renderGate(view, manual) {
  const hasColors = manual.colors.length > 0;
  manualHeader(view, {
    script: '정문 게이트다. 단말기에 뜬 문양 네 개를 왼쪽부터 하나씩 설명해라.',
    steps: [
      '아이가 설명하는 문양을 사전에서 찾아 <b>숫자</b>를 불러 주세요. 아이가 키패드에 네 자리를 입력합니다.',
      '<b>테두리 → 안쪽 무늬 → 아래 점 개수</b> 순서로 물어보면 빠릅니다. 한 군데만 다른 문양이 있으니 끝까지 확인하세요.',
      hasColors
        ? '문양의 <b>색</b>에 따라 숫자를 더합니다. 10 이상이면 일의 자리만 씁니다. (예: 8 + 3 = 11 → 1)'
        : null,
      `${manual.sessionSec}초가 지나면 문양이 바뀝니다. 틀리면 경보가 오르고 문양이 바뀝니다.`,
    ].filter(Boolean),
  });

  if (hasColors) {
    view.append(
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'section-title', text: '색 보정표' }),
        h(
          'div',
          { class: 'color-table' },
          manual.colors.map((x) =>
            h('div', {}, h('i', { style: { background: COLORS[x.c].hex } }), `${COLORS[x.c].name} +${x.add}`)
          )
        )
      )
    );
  }

  const dictionary = h('div', { class: 'card', id: 'dictionary' }, h('div', { class: 'section-title', text: '문양 사전' }));
  FRAMES.forEach((frame, index) => {
    const entries = manual.entries.filter((e) => e.frame === index);
    if (!entries.length) return;
    dictionary.append(
      h(
        'div',
        { class: 'glyph-group' },
        h('div', { class: 'small dim', style: { marginBottom: '4px' }, text: `${frame.name} 테두리` }),
        h(
          'div',
          { class: 'glyph-grid' },
          entries.map((e) =>
            h('div', { class: 'glyph-tile' }, glyphCanvas({ ...e, color: -1 }, 58), h('b', { text: String(e.digit) }))
          )
        )
      )
    );
  });
  view.append(dictionary);
}
