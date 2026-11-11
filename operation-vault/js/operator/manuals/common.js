// 매뉴얼 공통 부분.

import { h } from '../../shared/dom.js';

/** 매뉴얼 머리: 부모가 소리 내어 읽는 대사와 하는 법. steps 는 HTML 문자열 배열. */
export function manualHeader(view, { script, steps }) {
  view.append(
    h('div', { class: 'script' }, h('div', { class: 'who', text: '📻 소리 내어 읽어 주세요' }), h('p', { text: script })),
    h('ol', { class: 'howto' }, steps.map((s) => h('li', { html: s })))
  );
}
