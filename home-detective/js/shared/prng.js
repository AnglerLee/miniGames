// 시드 기반 난수.
// 두 폰이 서버 없이 같은 내용을 만들어 내야 하므로 정수 연산만 쓴다.
// (Math.sin 같은 부동소수 함수는 기기마다 결과가 다를 수 있어 쓰지 않는다.)

/** 여러 값을 섞어 32비트 해시를 만든다 (FNV-1a + 마무리 섞기). */
export function hash32(...parts) {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // 값 사이 구분자: ('ab','c')와 ('a','bc')가 같은 해시가 되지 않게 한다
    h ^= 0x1f;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 난수 생성기. */
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
  const int = (n) => next() % n;
  const shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  };
  return {
    next,
    /** 0 이상 n 미만의 정수 */
    int,
    /** lo 이상 hi 이하의 정수 */
    range: (lo, hi) => lo + int(hi - lo + 1),
    bool: () => (next() & 1) === 1,
    pick: (arr) => arr[int(arr.length)],
    /** 원본을 건드리지 않고 섞은 복사본을 돌려준다 (피셔-예이츠) */
    shuffle,
    sample: (arr, k) => shuffle(arr).slice(0, k),
  };
}

/**
 * 용도별로 독립된 난수 흐름을 만든다.
 * 한 곳에서 난수를 한 번 더 뽑아도 다른 곳의 결과가 밀리지 않는다.
 */
export function stream(seed, ...labels) {
  return makeRng(hash32(seed, ...labels));
}
