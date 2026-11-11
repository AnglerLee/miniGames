// 3단계 전력실: 배전반.
// 스위치 6개가 세 장치(잠금장치, 카메라, 경보 회로)에 전기를 보낸다.
// 장치는 연결된 스위치 중 하나라도 켜져 있으면 작동한다.
// 목표: 잠금장치와 카메라를 끄되, 경보 회로는 한순간도 꺼지면 안 된다.
// 어느 스위치가 어디로 가는지는 부모의 배전표에만 있고, 지금 무엇이 켜져 있는지는
// 아이만 볼 수 있다. 보통 이상에서는 동시에 켤 수 있는 스위치 수에도 제한이 있다.

import { stream } from '../prng.js';
import { allTags } from '../tags.js';

export const id = 'power';
export const kind = 'logic';

export const SWITCHES = 6;
export const LOCK = 1;
export const CAM = 2;
export const ALARM = 4;
export const LOADS = [
  { bit: LOCK, name: '잠금장치' },
  { bit: CAM, name: '카메라' },
  { bit: ALARM, name: '경보 회로' },
];

// 난이도별: 동시에 켤 수 있는 스위치 수, 최소 조작 횟수
const CONFIG = [
  { maxOn: 6, minMoves: 2 },
  { maxOn: 4, minMoves: 3 },
  { maxOn: 3, minMoves: 4 },
];

const ALL_STATES = 1 << SWITCHES;

function countOn(state) {
  let n = 0;
  for (let i = 0; i < SWITCHES; i++) if (state & (1 << i)) n++;
  return n;
}

/** 현재 스위치 상태에서 전기가 들어오는 장치들 (비트 합). */
export function powered(feeds, state) {
  let mask = 0;
  for (let i = 0; i < SWITCHES; i++) if (state & (1 << i)) mask |= feeds[i];
  return mask;
}

const isGoal = (feeds, state) => powered(feeds, state) === ALARM;

/** 이 상태가 되는 순간 실수로 처리되는가. 이유를 돌려주고, 괜찮으면 null. */
export function faultOf(m, state) {
  if (countOn(state) > m.maxOn) return 'overload';
  if (!(powered(m.feeds, state) & ALARM)) return 'alarm-cut';
  return null;
}

/** 실수 없이 목표에 닿는 가장 짧은 조작 순서. 없으면 null. */
export function shortestPlan(m, from) {
  const prev = new Array(ALL_STATES).fill(-2);
  const via = new Array(ALL_STATES).fill(-1);
  prev[from] = -1;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (isGoal(m.feeds, cur)) {
      const plan = [];
      for (let s = cur; prev[s] >= 0; s = prev[s]) plan.unshift(via[s]);
      return plan;
    }
    for (let i = 0; i < SWITCHES; i++) {
      const next = cur ^ (1 << i);
      if (prev[next] !== -2 || faultOf(m, next)) continue;
      prev[next] = cur;
      via[next] = i;
      queue.push(next);
    }
  }
  return null;
}

/** 함정: 꺼야 하는 스위치인데 지금 경보 회로를 혼자 살리고 있어 바로 끄면 실수가 된다. */
function hasTrap(m, state) {
  for (let i = 0; i < SWITCHES; i++) {
    if (!(state & (1 << i))) continue;
    const mustTurnOff = (m.feeds[i] & (LOCK | CAM)) !== 0;
    if (mustTurnOff && faultOf(m, state ^ (1 << i)) === 'alarm-cut') return true;
  }
  return false;
}

function validStarts(m, minMoves) {
  const out = [];
  for (let s = 0; s < ALL_STATES; s++) {
    if (faultOf(m, s) || isGoal(m.feeds, s) || !hasTrap(m, s)) continue;
    const plan = shortestPlan(m, s);
    if (plan && plan.length >= minMoves) out.push(s);
  }
  return out;
}

export function manual(ctx) {
  const cfg = CONFIG[ctx.difficulty];
  const rng = stream(ctx.seed, id, 'manual', ctx.channel);
  const tags = rng.sample(allTags(), SWITCHES);

  for (let tries = 0; tries < 500; tries++) {
    // 꼭 있어야 하는 스위치 세 종류를 먼저 넣고 나머지는 무작위로 채운다
    const feeds = [
      ALARM, // 경보 회로만 살리는 안전한 스위치
      ALARM | rng.pick([LOCK, CAM]), // 함정: 꺼야 하지만 경보도 살리고 있다
      rng.pick([LOCK, CAM, LOCK | CAM]),
    ];
    while (feeds.length < SWITCHES) feeds.push(rng.int(8));
    const m = { feeds: rng.shuffle(feeds), tags, maxOn: cfg.maxOn };
    const all = powered(m.feeds, ALL_STATES - 1);
    if (!(all & LOCK) || !(all & CAM)) continue;
    const starts = validStarts(m, cfg.minMoves);
    if (starts.length < 4) continue;
    m.starts = starts;
    m.limited = cfg.maxOn < SWITCHES;
    return m;
  }
  throw new Error('배전반을 만들지 못했습니다');
}

export function device(ctx, attempt) {
  const m = manual(ctx);
  const rng = stream(ctx.seed, id, 'device', ctx.channel);
  const order = rng.shuffle(m.starts);
  return { feeds: m.feeds, tags: m.tags, maxOn: m.maxOn, state: order[attempt % order.length] };
}

export function createSim(dev) {
  let state = dev.state;
  let status = 'open';
  const view = () => {
    const mask = powered(dev.feeds, state);
    return {
      switches: dev.tags.map((tag, i) => ({ tag, on: (state & (1 << i)) !== 0 })),
      lamps: { lock: (mask & LOCK) !== 0, cam: (mask & CAM) !== 0, alarm: (mask & ALARM) !== 0 },
      load: countOn(state),
      maxOn: dev.maxOn,
    };
  };
  return {
    view,
    act(action) {
      if (status !== 'open' || action.type !== 'flip') return { status, events: [] };
      state ^= 1 << action.index;
      const events = [{ type: 'flipped', index: action.index, on: (state & (1 << action.index)) !== 0 }];
      const fault = faultOf(dev, state);
      if (fault) {
        status = 'fault';
        events.push({ type: fault });
      } else if (isGoal(dev.feeds, state)) {
        status = 'solved';
        events.push({ type: 'unlocked' });
      }
      return { status, events };
    },
  };
}

export function solve(m, sim) {
  let state = 0;
  sim.view().switches.forEach((sw, i) => {
    if (sw.on) state |= 1 << i;
  });
  const plan = shortestPlan(m, state);
  if (!plan) return 'unsolvable';
  let result = { status: 'open' };
  for (const index of plan) result = sim.act({ type: 'flip', index });
  return result.status;
}

export function audit(m, dev) {
  const problems = [];
  const names = m.tags.map((t) => t.c * 10 + t.s);
  if (new Set(names).size !== SWITCHES) problems.push('스위치 표식이 겹침');
  if (faultOf(m, dev.state)) problems.push('시작부터 실수 상태임');
  if (isGoal(m.feeds, dev.state)) problems.push('시작부터 목표 상태임');
  if (!hasTrap(m, dev.state)) problems.push('순서가 중요한 함정이 없음');
  if (!shortestPlan(m, dev.state)) problems.push('풀 수 없음');
  return problems;
}
