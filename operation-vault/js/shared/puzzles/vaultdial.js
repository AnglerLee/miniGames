// 5단계 금고실: 다이얼.
// 1) 탐지: 아이가 다이얼을 천천히 돌리며 딸깍 소리, 바늘 떨림, 진동으로 숨은 번호 3개를 찾는다.
// 2) 변환: 금고 명판의 표식에 맞는 변환표가 부모에게 있다. 찾은 번호를 실제 번호로 바꾼다.
// 3) 입력: 아이가 오른쪽-왼쪽-오른쪽으로 돌려 실제 번호에 맞추고, 멈춘 채 버텨 확정한다.
//
// 다이얼 눈금은 0~39. 오른쪽(시계 방향)으로 돌리면 숫자가 커진다.

import { stream } from '../prng.js';
import { allTags, sameTag } from '../tags.js';

export const id = 'vault';
export const kind = 'sense';

export const DIAL = 40;
export const TURNS = ['right', 'left', 'right'];
/** 입력 단계에서 반대 방향으로 흔들려도 봐주는 눈금 수. */
export const REVERSE_SLACK = 2;

// 난이도별: 명판 종류 수, 순서 바꾸기 여부, 더하는 수의 최대 크기
const CONFIG = [
  { plates: 2, reorder: false, maxAdd: 9 },
  { plates: 3, reorder: true, maxAdd: 15 },
  { plates: 4, reorder: true, maxAdd: 19 },
];

const ORDERS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

const wrap = (n) => ((n % DIAL) + DIAL) % DIAL;

export function manual(ctx) {
  const cfg = CONFIG[ctx.difficulty];
  const rng = stream(ctx.seed, id, 'manual', ctx.channel);
  const tags = rng.sample(allTags(), cfg.plates);
  const plates = tags.map((tag) => ({
    tag,
    // order[i]: i 번째로 맞출 번호가 찾은 번호 중 몇 번째로 작은 수인가 (0 가장 작은 수)
    order: cfg.reorder ? rng.pick(ORDERS) : ORDERS[0],
    // add[i]: i 번째 번호에 더하는 수 (음수면 뺀다)
    add: [0, 1, 2].map(() => rng.range(1, cfg.maxAdd) * (rng.bool() ? 1 : -1)),
  }));
  return { dial: DIAL, turns: TURNS, plates };
}

/** 찾은 번호 세 개와 명판 규칙으로 실제 번호를 계산한다. */
export function convert(plate, found) {
  const sorted = found.slice().sort((a, b) => a - b);
  return [0, 1, 2].map((i) => wrap(sorted[plate.order[i]] + plate.add[i]));
}

export function device(ctx, attempt) {
  const m = manual(ctx);
  const rng = stream(ctx.seed, id, 'device', ctx.channel, attempt);
  for (let tries = 0; tries < 200; tries++) {
    const plate = rng.pick(m.plates);
    const gates = rng.sample([...Array(DIAL).keys()], 3).sort((a, b) => a - b);
    // 숨은 번호끼리 너무 붙어 있으면 구분하기 어렵다
    const gaps = [gates[1] - gates[0], gates[2] - gates[1], gates[0] + DIAL - gates[2]];
    if (gaps.some((g) => g < 4)) continue;
    const target = convert(plate, gates);
    // 같은 번호가 연달아 나오면 한 바퀴를 통째로 돌려야 해서 헷갈린다
    if (target[0] === target[1] || target[1] === target[2]) continue;
    // 첫 번호가 숨은 번호와 같으면 탐지를 끝낸 자리에서 바로 한 바퀴를 돌려야 할 수 있다
    if (gates.includes(target[0])) continue;
    const start = rng.int(DIAL);
    return { plate: plate.tag, gates, target, start };
  }
  throw new Error('금고 다이얼을 만들지 못했습니다');
}

export function createSim(dev) {
  let value = dev.start;
  let phase = 'detect';
  let marked = [];
  let step = 0;
  let reverse = 0; // 입력 단계에서 반대 방향으로 움직인 눈금 수
  let status = 'open';

  return {
    view: () => ({ value, phase, marked: marked.slice(), step, plate: dev.plate, dial: DIAL }),
    act(action) {
      if (status !== 'open') return { status, events: [] };

      if (action.type === 'rotate') {
        const delta = action.delta > 0 ? 1 : -1;
        value = wrap(value + delta);
        const events = [{ type: 'tick', value }];
        if (phase === 'detect') {
          // 천천히 돌릴 때만 걸림이 느껴진다
          if (action.slow && dev.gates.includes(value) && !marked.includes(value)) {
            events.push({ type: 'gate', value });
          }
        } else {
          const wanted = TURNS[step] === 'right' ? 1 : -1;
          if (delta !== wanted) reverse++;
        }
        return { status, events };
      }

      if (action.type === 'hold') {
        if (phase === 'detect') {
          if (!dev.gates.includes(value) || marked.includes(value)) {
            return { status, events: [{ type: 'nothing', value }] };
          }
          marked.push(value);
          const events = [{ type: 'marked', value, count: marked.length }];
          if (marked.length === 3) {
            phase = 'enter';
            reverse = 0;
            events.push({ type: 'phase', phase });
          }
          return { status, events };
        }
        const wrongWay = reverse > REVERSE_SLACK;
        if (value !== dev.target[step] || wrongWay) {
          status = 'fault';
          return { status, events: [{ type: wrongWay ? 'wrong-direction' : 'wrong-number', value }] };
        }
        step++;
        reverse = 0;
        if (step === 3) {
          status = 'solved';
          return { status, events: [{ type: 'commit', step }, { type: 'open' }] };
        }
        return { status, events: [{ type: 'commit', step }] };
      }

      return { status, events: [] };
    },
  };
}

export function solve(m, sim) {
  // 1) 한 바퀴 천천히 돌리며 걸리는 번호를 표시한다
  for (let i = 0; i < DIAL && sim.view().phase === 'detect'; i++) {
    const { events } = sim.act({ type: 'rotate', delta: 1, slow: true });
    if (events.some((e) => e.type === 'gate')) sim.act({ type: 'hold' });
  }
  const seen = sim.view();
  if (seen.phase !== 'enter') return 'not-found';

  // 2) 명판에 맞는 변환표로 실제 번호를 구한다
  const plate = m.plates.find((p) => sameTag(p.tag, seen.plate));
  if (!plate) return 'no-plate';
  const target = convert(plate, seen.marked);

  // 3) 정해진 방향으로 돌려 맞춘다
  let result = { status: 'open' };
  for (let step = 0; step < 3; step++) {
    const delta = m.turns[step] === 'right' ? 1 : -1;
    do {
      sim.act({ type: 'rotate', delta, slow: false });
    } while (sim.view().value !== target[step]);
    result = sim.act({ type: 'hold' });
    if (result.status === 'fault') return 'fault';
  }
  return result.status;
}

export function audit(m, dev) {
  const problems = [];
  const names = m.plates.map((p) => p.tag.c * 10 + p.tag.s);
  if (new Set(names).size !== names.length) problems.push('명판 표식이 겹침');
  if (!m.plates.some((p) => sameTag(p.tag, dev.plate))) problems.push('변환표에 없는 명판임');
  if (new Set(dev.gates).size !== 3) problems.push('숨은 번호가 3개가 아님');
  if (dev.target.some((t) => t < 0 || t >= DIAL)) problems.push('실제 번호가 눈금을 벗어남');
  return problems;
}
