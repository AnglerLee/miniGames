// 그림 조각: 잠수함(인라인 SVG), 구역 동그라미, 선체 칸. 이미지 파일 없이 그린다.

import { h } from '../shared/dom.js';

/** 옆에서 본 잠수함. 뱃머리가 오른쪽이다. */
export function subSvg(body = '#ffb703') {
  return (
    '<svg viewBox="0 0 72 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    `<path d="M41 5V1.5h7" fill="none" stroke="${body}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<rect x="30" y="5" width="16" height="11" rx="4" fill="${body}"/>` +
    `<path d="M9 22c0-6 8-9 21-9h19c10 0 17 4 17 9s-7 9-17 9H30C17 31 9 28 9 22z" fill="${body}"/>` +
    `<path d="M10 22L2 14v16z" fill="${body}"/>` +
    '<path d="M14 18h48" stroke="rgba(255,255,255,0.35)" stroke-width="1.6" stroke-linecap="round"/>' +
    [32, 43, 54].map((x) => `<circle cx="${x}" cy="23" r="3.3" fill="#04121d"/><circle cx="${x - 0.8}" cy="22.2" r="1.3" fill="#4cc9f0"/>`).join('') +
    '</svg>'
  );
}

export function subIcon(cls = '', body) {
  return h('span', { class: ('sub-art ' + cls).trim(), html: subSvg(body) });
}

/** 구역 동그라미 (base.css 의 .station-dot) */
export function dot(st, cls = '') {
  return h('span', { class: ('station-dot ' + cls).trim(), style: { '--c': st.role.color }, text: st.role.icon });
}

/** 선체 칸 줄. 깨진 칸은 빈 칸으로 남는다 */
export function hullCells(hull, hullMax, cls = '') {
  return h(
    'span',
    { class: ('cells ' + cls).trim(), 'aria-label': '선체 ' + hull + ' / ' + hullMax },
    Array.from({ length: hullMax }, (_, i) => h('i', { class: i < hull ? 'on' : '' }))
  );
}
