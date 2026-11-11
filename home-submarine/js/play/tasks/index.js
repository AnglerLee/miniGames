// 수리 놀이 모음.
//
// 수리 놀이 하나는 구역에 도착해서 손으로 하는 8~15초짜리 짧은 놀이다.
// 경보 시계가 계속 가는 동안 하므로, 보자마자 무엇을 할지 알 수 있어야 하고 글을 읽게 하면 안 된다.
//
// 규격
//   export function mount(root, ctx) → { destroy(), solve() }
//
//   root   놀이가 그려질 빈 요소. 세로로 긴 상자이며 (대략 폭 300~400, 높이 360~520 CSS px)
//          display:flex; flex-direction:column 이다. 놀이는 이 안에서만 그린다.
//   ctx    {
//            data,          { type, level }   level: 0 쉬움 / 1 보통 / 2 어려움
//            rng,           씨앗 난수 (js/shared/prng.js 의 makeRng 결과). 배치와 정답을 정할 때 쓴다.
//            color,         이 구역의 색 (#rrggbb). 강조색으로 쓴다.
//            done(),        다 고쳤을 때 한 번만 부른다
//            miss(),        실수했을 때 부른다 (바깥이 횟수를 센다). 실수해도 계속할 수 있어야 한다.
//            sfx(name),     효과음 ('tap' 'good' 'bad' 'turn' 'click' 'water' 'pump' 'beep' 'fixed' 중에서)
//            buzz(pattern), 진동
//          }
//   destroy()  타이머, requestAnimationFrame, 전역 이벤트를 모두 정리한다
//   solve()    검증용. 아이가 고친 것과 같은 결과가 되게 하고 ctx.done() 을 부른다.
//
// 놀이 종류 (content.js 의 TASKS 와 같다)
//   valve   밸브 돌리기      손가락으로 원을 그려 바퀴를 돌린다
//   pipes   배관 잇기        조각을 눌러 돌려서 물길을 잇는다
//   gauge   압력 맞추기      흔들리는 바늘이 초록 칸에 올 때 누른다
//   leak    물 새는 곳 막기  물이 새는 곳을 눌러 막는다
//   pump    펌프질           손잡이를 위아래로 움직여 채운다
//   reboot  재시동 암호      불이 켜진 순서를 따라 누른다

import * as valve from './valve.js';
import * as pipes from './pipes.js';
import * as gauge from './gauge.js';
import * as leak from './leak.js';
import * as pump from './pump.js';
import * as reboot from './reboot.js';

export const TASK_MODULES = { valve, pipes, gauge, leak, pump, reboot };

/** 놀이를 띄운다. 모르는 종류면 바로 done 을 부르는 빈 놀이를 돌려준다. */
export function mountTask(root, ctx) {
  const mod = TASK_MODULES[ctx.data.type];
  if (!mod) {
    queueMicrotask(() => ctx.done());
    return { destroy() {}, solve() {} };
  }
  return mod.mount(root, ctx);
}
