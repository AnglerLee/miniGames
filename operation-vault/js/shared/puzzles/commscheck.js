// 0단계 교신 점검.
// 시계가 돌기 전에 두 폰이 같은 내용을 보고 있는지 확인하고, 주파수 주고받기를 익힌다.
// 부모 화면에 암구호가 뜨고, 아이는 네 개 중에서 그것을 고른다.

import { stream } from '../prng.js';

export const id = 'comms';
export const kind = 'lookup';

const WORDS = [
  '독수리', '번개', '은하수', '고래', '화산', '나침반', '솜사탕', '북극곰',
  '도토리', '무지개', '혜성', '팽이', '고슴도치', '등대', '눈사람', '풍선',
  '해바라기', '펭귄', '선인장', '회오리', '반딧불', '돌고래', '초승달', '호두',
];

export function manual(ctx) {
  const rng = stream(ctx.seed, id, 'manual', ctx.channel);
  return { word: rng.pick(WORDS) };
}

export function device(ctx, attempt) {
  const m = manual(ctx);
  const rng = stream(ctx.seed, id, 'device', ctx.channel, attempt);
  const others = rng.sample(WORDS.filter((w) => w !== m.word), 3);
  const options = rng.shuffle([m.word, ...others]);
  return { options, answer: options.indexOf(m.word) };
}

export function createSim(dev) {
  let status = 'open';
  return {
    view: () => ({ options: dev.options }),
    act(action) {
      if (status !== 'open' || action.type !== 'choose') return { status, events: [] };
      status = action.index === dev.answer ? 'solved' : 'fault';
      return { status, events: [{ type: status === 'solved' ? 'ok' : 'wrong' }] };
    },
  };
}

/** 매뉴얼과 화면에 보이는 것만으로 푼다. */
export function solve(m, sim) {
  const index = sim.view().options.indexOf(m.word);
  return sim.act({ type: 'choose', index }).status;
}

export function audit(m, dev) {
  const problems = [];
  if (dev.options.length !== 4) problems.push('보기가 4개가 아님');
  if (new Set(dev.options).size !== 4) problems.push('보기가 겹침');
  if (dev.options[dev.answer] !== m.word) problems.push('정답이 보기에 없음');
  return problems;
}
