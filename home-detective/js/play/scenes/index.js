// 증거 조사 장면 모음.
//
// 장면 하나는 증거 하나를 "손으로 조사하는" 20~40초짜리 짧은 놀이다.
// 장면은 사건 내용을 모른다. 넘겨받은 data 대로 그리고, 아이가 풀면 ctx.done() 을 부른다.
// 증거가 뜻하는 사실(문장)은 장면이 끝난 뒤 바깥 화면이 보여 준다.
//
// 규격
//   export function mount(root, ctx) → { destroy(), solve() }
//
//   root   장면이 그려질 빈 요소. 세로로 긴 상자이며 (대략 폭 340~400, 높이 420~560 CSS px)
//          display:flex; flex-direction:column 이다. 장면은 이 안에서만 그린다.
//   ctx    {
//            data,          사건이 넘겨 준 장면 값 (아래 표)
//            rng,           씨앗 난수 (js/shared/prng.js 의 makeRng 결과). 겉모습을 흩뜨릴 때 쓴다.
//            done(),        다 풀었을 때 한 번만 부른다
//            miss(),        틀린 답을 골랐을 때 부른다 (바깥이 횟수를 센다). 틀려도 계속 풀 수 있어야 한다.
//            sfx(name),     효과음 ('tap' 'good' 'bad' 'rub' 'tick' 'snap' 'reveal' 중에서)
//            buzz(pattern), 진동
//          }
//   destroy()  타이머, requestAnimationFrame, 전역 이벤트를 모두 정리한다
//   solve()    검증용. 아이가 푼 것과 같은 결과가 되게 하고 ctx.done() 을 부른다.
//
// data
//   clock        { hour: 14|15|16, options: ['오후 2시','오후 3시','오후 4시'], answer: 번호, mirrored: bool }
//   dust         { pattern: 0~3, options: [무늬 번호…], answer: options 안의 위치 }
//   fingerprint  { printType: 0~2, options: [지문 번호…], answer: options 안의 위치, rotate: 각도(도) }
//   uv           { marks: 3~5 }   찾아야 할 손자국 수
//   cctv         { count: 0~4, max: 4 }   화면에 보여야 할 인원
//   shred        { lines: [글자 줄…], pieces: 6|9 }

import * as clock from './clock.js';
import * as dust from './dust.js';
import * as fingerprint from './fingerprint.js';
import * as uv from './uv.js';
import * as cctv from './cctv.js';
import * as shred from './shred.js';

export const SCENES = { clock, dust, fingerprint, uv, cctv, shred };

/** 장면을 띄운다. 모르는 종류면 바로 done 을 부르는 빈 장면을 돌려준다. */
export function mountScene(root, ctx) {
  const mod = SCENES[ctx.data.type];
  if (!mod) {
    queueMicrotask(() => ctx.done());
    return { destroy() {}, solve() {} };
  }
  return mod.mount(root, ctx);
}
