// 매뉴얼 내용의 지문(다이제스트)을 만든다.
// 두 폰의 코드 버전이 달라 매뉴얼이 어긋나면 주파수 확인 단계에서 걸러 내기 위함이다.

import { hash32 } from './prng.js';

/** 키 순서에 상관없이 항상 같은 문자열을 만드는 JSON 직렬화. */
export function canon(value) {
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canon(value[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return hash32(canon(value));
}
