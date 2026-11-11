// 4단계 보안 토큰 (선택): 현실 미션.
// 부모가 번호를 적은 쪽지를 집 안에 숨겨 둔다. 아이는 부모가 읽어 주는 힌트를 듣고
// 실제로 쪽지를 찾아와 번호를 입력한다. 그동안에도 시계는 계속 간다.
// 힌트 문구는 부모 폰에만 저장되어 있어 여기에는 들어 있지 않다.

import { tokenNumber } from '../synccode.js';

export const id = 'token';
export const kind = 'real';

const LENGTH = 4;

export function manual() {
  return { digits: LENGTH };
}

export function device(ctx) {
  return { digits: LENGTH, code: tokenNumber({ seed: ctx.seed }).split('').map(Number) };
}

export function createSim(dev) {
  let status = 'open';
  let entered = [];
  return {
    view: () => ({ entered: entered.slice(), length: LENGTH }),
    act(action) {
      if (status !== 'open') return { status, events: [] };
      if (action.type === 'clear') {
        entered = [];
        return { status, events: [{ type: 'cleared' }] };
      }
      if (action.type !== 'digit') return { status, events: [] };
      entered.push(action.d);
      if (entered.length < LENGTH) return { status, events: [{ type: 'key', d: action.d }] };
      const ok = entered.every((d, i) => d === dev.code[i]);
      status = ok ? 'solved' : 'fault';
      return { status, events: [{ type: ok ? 'granted' : 'denied' }] };
    },
  };
}

/** 쪽지를 찾아온 것으로 치고 번호를 입력한다. note 는 쪽지에 적힌 번호. */
export function solve(m, sim, note) {
  let result = { status: 'open' };
  for (const ch of String(note)) result = sim.act({ type: 'digit', d: Number(ch) });
  return result.status;
}

export function audit(m, dev) {
  return dev.code.length === LENGTH ? [] : ['토큰 번호가 4자리가 아님'];
}
