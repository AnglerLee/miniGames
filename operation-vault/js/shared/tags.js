// 표식: 색 + 도형 조합. 덕트 벽, 배전반 스위치, 금고 명판에 쓰인다.
// 경보등이 붉게 켜져도 구분되도록 색은 다섯 가지 이름만 쓴다.

export const COLORS = [
  { id: 'R', name: '빨강', hex: '#ff4d4d' },
  { id: 'Y', name: '노랑', hex: '#ffd23f' },
  { id: 'G', name: '초록', hex: '#3ddc84' },
  { id: 'B', name: '파랑', hex: '#4da3ff' },
  { id: 'W', name: '흰색', hex: '#f4f4f4' },
];

export const SHAPES = [
  { id: 'circle', name: '원' },
  { id: 'tri', name: '세모' },
  { id: 'square', name: '네모' },
  { id: 'star', name: '별' },
  { id: 'cross', name: '십자' },
];

/** 가능한 표식 25가지를 모두 만든다. c 는 색 번호, s 는 도형 번호. */
export function allTags() {
  const out = [];
  for (let c = 0; c < COLORS.length; c++) {
    for (let s = 0; s < SHAPES.length; s++) out.push({ c, s });
  }
  return out;
}

export const tagKey = (t) => t.c * 10 + t.s;
export const sameTag = (a, b) => a.c === b.c && a.s === b.s;
export const tagName = (t) => `${COLORS[t.c].name} ${SHAPES[t.s].name}`;
